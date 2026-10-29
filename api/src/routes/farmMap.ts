import { Router } from "express";
import { prisma } from "../prisma";
import type { TgAuthedRequest } from "../middleware/telegramAuth";

const router = Router();
const MAP_SIZE = 7;
const CELLS_PER_TILE = 4;

function initialTiles() {
  return Array.from({ length: MAP_SIZE * MAP_SIZE }, (_, i) => {
    const x = i % MAP_SIZE;
    const y = Math.floor(i / MAP_SIZE);
    return { x, y, terrain: "GRASS", unlocked: x >= 2 && x <= 4 && y >= 2 && y <= 4 };
  });
}

// Creates the farm once for a registered user. The unique userId constraint
// prevents duplicate maps if the player sends simultaneous requests.
router.get("/", async (req: TgAuthedRequest, res) => {
  try {
    const rawId = req.telegramUser?.id;
    if (!rawId || !Number.isSafeInteger(rawId)) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const user = await prisma.user.findUnique({
      where: { telegramId: BigInt(rawId) },
      select: { id: true },
    });
    if (!user) {
      return res.status(404).json({ error: "User not found. Open the game first." });
    }

    const tiles = initialTiles();
    // The first request creates the complete 49-tile map atomically.
    const farm = await prisma.farmMap.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        userId: user.id,
        width: MAP_SIZE,
        height: MAP_SIZE,
        tiles: { create: tiles },
      },
      select: { id: true },
    });

    // Also repairs maps left incomplete by an interrupted older import.
    await prisma.farmTile.createMany({
      data: tiles.map(tile => ({ ...tile, farmId: farm.id })),
      skipDuplicates: true,
    });

    const result = await prisma.farmMap.findUniqueOrThrow({
      where: { id: farm.id },
      include: {
        tiles: { orderBy: [{ y: "asc" }, { x: "asc" }] },
        objects: { orderBy: { id: "asc" } },
      },
    });

    return res.json({
      ok: true,
      farm: {
        id: result.id,
        width: result.width,
        houseLevel: result.houseLevel,
        height: result.height,
        cellsPerTile: CELLS_PER_TILE,
        tiles: result.tiles.map(tile => ({
          id: tile.id, x: tile.x, y: tile.y,
          terrain: tile.terrain, unlocked: tile.unlocked,
        })),
        nextPrice: nextPrice(Math.max(0, result.tiles.filter(tile => tile.unlocked).length - 9)),
        objects: result.objects.map(object => ({
          id: object.id, kind: object.kind, x: object.x,
          y: object.y, rotation: object.rotation,
        })),
      },
    });
  } catch (error) {
    console.error("FARM MAP GET ERROR", error);
    return res.status(500).json({ error: "Failed to load farm map" });
  }
});


const FIRST_PRICE = 5000;
const NEXT_MULTIPLIER = 1.25;
function nextPrice(purchased: number) {
  return Math.round(FIRST_PRICE * Math.pow(NEXT_MULTIPLIER, purchased));
}
function isAdjacent(x: number, y: number, opened: { x: number; y: number }[]) {
  return opened.some(t => Math.abs(t.x - x) + Math.abs(t.y - y) === 1);
}

router.post("/buy", async (req: TgAuthedRequest, res) => {
  const rawId = req.telegramUser?.id;
  if (!rawId || !Number.isSafeInteger(rawId)) return res.status(401).json({ error: "Unauthorized" });
  const { x, y } = req.body ?? {};
  if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= MAP_SIZE || y >= MAP_SIZE)
    return res.status(400).json({ error: "Invalid tile coordinates" });

  try {
    const user = await prisma.user.findUnique({
      where: { telegramId: BigInt(rawId) }, select: { id: true },
    });
    if (!user) return res.status(404).json({ error: "User not found" });

    // Serializable transaction prevents two simultaneous purchases from using
    // the same balance, adjacency state, or expansion price.
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const outcome = await prisma.$transaction(async tx => {
          const farm = await tx.farmMap.findUnique({ where: { userId: user.id }, select: { id: true } });
          if (!farm) return { status: 409, error: "Open farm map first" };
          const tiles = await tx.farmTile.findMany({
            where: { farmId: farm.id }, select: { id: true, x: true, y: true, unlocked: true },
          });
          const selected = tiles.find(t => t.x === x && t.y === y);
          if (!selected) return { status: 404, error: "Tile not found" };
          if (selected.unlocked) return { status: 409, error: "Tile already unlocked" };
          const opened = tiles.filter(t => t.unlocked);
          if (!isAdjacent(x, y, opened)) return { status: 400, error: "Only edge-adjacent tiles can be bought" };
          const price = nextPrice(Math.max(0, opened.length - 9));
          const debit = await tx.user.updateMany({
            where: { id: user.id, coins: { gte: price } },
            data: { coins: { decrement: price } },
          });
          if (debit.count !== 1) return { status: 400, error: "Not enough coins", price };
          const updated = await tx.farmTile.updateMany({
            where: { id: selected.id, unlocked: false }, data: { unlocked: true },
          });
          if (updated.count !== 1) throw new Error("Concurrent farm tile update");
          const balance = await tx.user.findUniqueOrThrow({
            where: { id: user.id }, select: { coins: true },
          });
          return { status: 200, ok: true, x, y, price, coins: balance.coins, nextPrice: nextPrice(opened.length - 8) };
        }, { isolationLevel: "Serializable", timeout: 10000 });
        return res.status(outcome.status).json(outcome);
      } catch (error: any) {
        if (error?.code === "P2034" && attempt < 2) continue;
        throw error;
      }
    }
    return res.status(409).json({ error: "Concurrent update; retry" });
  } catch (error) {
    console.error("FARM TILE BUY ERROR", error);
    return res.status(500).json({ error: "Could not purchase tile" });
  }
});


// Small-grid house placement. The house occupies 2x2 cells; coordinates are
// absolute on the 28x28 small-cell map. Default position is (13,13).
router.post("/house/move", async (req: TgAuthedRequest, res) => {
  const telegramId = req.telegramUser?.id;
  if (!telegramId || !Number.isSafeInteger(telegramId))
    return res.status(401).json({ error: "Unauthorized" });
  const { x, y } = req.body ?? {};
  if (!Number.isInteger(x) || !Number.isInteger(y) ||
      x < 0 || y < 0 || x > 26 || y > 26)
    return res.status(400).json({ error: "Invalid house position" });
  try {
    const user = await prisma.user.findUnique({
      where: { telegramId: BigInt(telegramId) }, select: { id: true },
    });
    if (!user) return res.status(404).json({ error: "User not found" });
    const result = await prisma.$transaction(async tx => {
      const farm = await tx.farmMap.findUnique({ where: { userId: user.id },
        include: { tiles: true, objects: true } });
      if (!farm) return { status: 404, error: "Farm not found" };
      // Every cell covered by the house must belong to unlocked land.
      for (let cy = y; cy < y + 2; cy++) for (let cx = x; cx < x + 2; cx++) {
        if (!farm.tiles.some(t => t.x === Math.floor(cx / 4) &&
          t.y === Math.floor(cy / 4) && t.unlocked))
          return { status: 400, error: "House must stay on unlocked land" };
      }
      // Pens are currently fixed in these tiles and must not be overlapped.
      for (let cy = y; cy < y + 2; cy++) for (let cx = x; cx < x + 2; cx++) {
        const tile = `${Math.floor(cx / 4)},${Math.floor(cy / 4)}`;
        if (farm.objects.some(o => PEN_KINDS.includes(o.kind) && `${Math.floor(o.x / 4)},${Math.floor(o.y / 4)}` === tile) ||
          (!farm.objects.some(o => o.kind === "PEN_CHICKEN") && tile === "2,3") ||
          (!farm.objects.some(o => o.kind === "PEN_SHEEP") && tile === "4,3") ||
          (!farm.objects.some(o => o.kind === "PEN_COW") && tile === "3,4"))
          return { status: 400, error: "This area is reserved for animals" };
      }
      // Existing objects: future decorations use their own footprints;
      // for now do not allow occupying the same small cell as another object.
      if (farm.objects.some(o => o.kind !== "HOUSE" &&
        o.x >= x && o.x < x + 2 && o.y >= y && o.y < y + 2))
        return { status: 400, error: "Space is occupied" };
      const existing = farm.objects.find(o => o.kind === "HOUSE");
      const house = existing
        ? await tx.farmObject.update({ where: { id: existing.id }, data: { x, y } })
        : await tx.farmObject.create({ data: { farmId: farm.id, kind: "HOUSE", x, y, rotation: 0 } });
      return { status: 200, ok: true, house: { id: house.id, x: house.x, y: house.y } };
    }, { isolationLevel: "Serializable" });
    return res.status(result.status).json(result);
  } catch (error) {
    console.error("FARM HOUSE MOVE ERROR", error);
    return res.status(500).json({ error: "Could not save house position" });
  }
});


const PEN_KINDS = ["PEN_CHICKEN", "PEN_SHEEP", "PEN_COW"];
const DEFAULT_PENS: Record<string, { x: number; y: number }> = {
  PEN_CHICKEN: { x: 8, y: 12 },
  PEN_SHEEP: { x: 16, y: 12 },
  PEN_COW: { x: 12, y: 16 },
};

// Pens occupy a full 4x4-cell land tile and move as a unit with their animals.
// No animals, production, feeding, or balances are modified.
router.post("/pen/move", async (req: TgAuthedRequest, res) => {
  const rawId = req.telegramUser?.id;
  if (!rawId || !Number.isSafeInteger(rawId))
    return res.status(401).json({ error: "Unauthorized" });
  const { kind, x, y } = req.body ?? {};
  if (typeof kind !== "string" || !PEN_KINDS.includes(kind) ||
      !Number.isInteger(x) || !Number.isInteger(y) ||
      x < 0 || y < 0 || x > 24 || y > 24 || x % 4 !== 0 || y % 4 !== 0)
    return res.status(400).json({ error: "Invalid pen position" });
  try {
    const user = await prisma.user.findUnique({
      where: { telegramId: BigInt(rawId) }, select: { id: true },
    });
    if (!user) return res.status(404).json({ error: "User not found" });
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const result = await prisma.$transaction(async tx => {
          const farm = await tx.farmMap.findUnique({
            where: { userId: user.id }, include: { tiles: true, objects: true },
          });
          if (!farm) return { status: 404, error: "Farm not found" };
          if (!farm.tiles.some(t => t.x === x / 4 && t.y === y / 4 && t.unlocked))
            return { status: 400, error: "Pen must be on unlocked land" };
          const house = farm.objects.find(o => o.kind === "HOUSE") ?? { x: 13, y: 13 };
          if (house.x < x + 4 && house.x + 2 > x &&
              house.y < y + 4 && house.y + 2 > y)
            return { status: 400, error: "Pen overlaps the house" };
          for (const otherKind of PEN_KINDS.filter(k => k !== kind)) {
            const other = farm.objects.find(o => o.kind === otherKind) ?? DEFAULT_PENS[otherKind];
            if (other.x < x + 4 && other.x + 4 > x &&
                other.y < y + 4 && other.y + 4 > y)
              return { status: 400, error: "Pen overlaps another animal area" };
          }
          if (farm.objects.some(o => o.kind !== "HOUSE" && !PEN_KINDS.includes(o.kind) &&
              o.x >= x && o.x < x + 4 && o.y >= y && o.y < y + 4))
            return { status: 400, error: "Pen overlaps another object" };
          const existing = farm.objects.find(o => o.kind === kind);
          const pen = existing
            ? await tx.farmObject.update({ where: { id: existing.id }, data: { x, y } })
            : await tx.farmObject.create({
                data: { farmId: farm.id, kind, x, y, rotation: 0 },
              });
          return { status: 200, ok: true, pen: { kind, x: pen.x, y: pen.y } };
        }, { isolationLevel: "Serializable", timeout: 10000 });
        return res.status(result.status).json(result);
      } catch (error: any) {
        if (error?.code === "P2034" && attempt < 2) continue;
        throw error;
      }
    }
    return res.status(409).json({ error: "Concurrent update; retry" });
  } catch (error) {
    console.error("FARM PEN MOVE ERROR", error);
    return res.status(500).json({ error: "Could not save pen position" });
  }
});


// Rotate one existing or default farm object. Only 90-degree increments are allowed.
// The operation is atomic and does not change animal or currency records.
router.post("/object/rotate", async (req: TgAuthedRequest, res) => {
  const rawId = req.telegramUser?.id;
  if (!rawId || !Number.isSafeInteger(rawId))
    return res.status(401).json({ error: "Unauthorized" });
  const { kind, rotation } = req.body ?? {};
  const validKinds = ["HOUSE", "PEN_CHICKEN", "PEN_SHEEP", "PEN_COW"];
  if (!validKinds.includes(kind) || !Number.isInteger(rotation) ||
      ![0, 90, 180, 270].includes(rotation))
    return res.status(400).json({ error: "Invalid object rotation" });
  try {
    const user = await prisma.user.findUnique({
      where: { telegramId: BigInt(rawId) }, select: { id: true },
    });
    if (!user) return res.status(404).json({ error: "User not found" });
    const defaults: Record<string, { x: number; y: number }> = {
      HOUSE: { x: 13, y: 13 },
      PEN_CHICKEN: { x: 8, y: 12 },
      PEN_SHEEP: { x: 16, y: 12 },
      PEN_COW: { x: 12, y: 16 },
    };
    const result = await prisma.$transaction(async tx => {
      const farm = await tx.farmMap.findUnique({
        where: { userId: user.id }, include: { objects: true },
      });
      if (!farm) return null;
      const existing = farm.objects.find(o => o.kind === kind);
      const object = existing
        ? await tx.farmObject.update({
            where: { id: existing.id }, data: { rotation },
          })
        : await tx.farmObject.create({
            data: { farmId: farm.id, kind, ...defaults[kind], rotation },
          });
      return { kind: object.kind, x: object.x, y: object.y, rotation: object.rotation };
    }, { isolationLevel: "Serializable" });
    if (!result) return res.status(404).json({ error: "Farm not found" });
    return res.json({ ok: true, object: result });
  } catch (error) {
    console.error("FARM ROTATE ERROR", error);
    return res.status(500).json({ error: "Could not rotate object" });
  }
});


// Decoration catalogue: server-authoritative prices. Each decoration occupies one
// small cell. Multiple instances of each kind are allowed.
const DECORATION_PRICES: Record<string, { coins: number; diamonds: number }> = {
  DECOR_TREE: {coins:750,diamonds:0}, DECOR_BUSH:{coins:300,diamonds:0},
  DECOR_FLOWER:{coins:150,diamonds:0}, DECOR_BENCH:{coins:1500,diamonds:0},
  DECOR_LAMP:{coins:2500,diamonds:0}, DECOR_PATH_DIRT:{coins:25,diamonds:0},
  DECOR_PATH_STONE:{coins:75,diamonds:0}, DECOR_PATH_WOOD:{coins:100,diamonds:0},
  DECOR_FENCE_WOOD:{coins:150,diamonds:0},
  DECOR_GOLD_TREE:{coins:0,diamonds:10}, DECOR_FOUNTAIN:{coins:0,diamonds:20},
  DECOR_FLOWER_ARCH:{coins:0,diamonds:15}
};
const DECORATIONS = Object.keys(DECORATION_PRICES);
async function debitDecoration(tx:any,userId:any,kind:string,count:number) {
  const price=DECORATION_PRICES[kind];
  const coins=price.coins*count,diamonds=price.diamonds*count;
  const paid=await tx.user.updateMany({
    where:{id:userId,coins:{gte:coins},diamonds:{gte:diamonds}},
    data:{coins:{decrement:coins},diamonds:{decrement:diamonds}}
  });
  return paid.count===1;
}
router.get("/decoration/catalog", (_req,res) => res.json({ok:true,items:DECORATION_PRICES}));
const STORED_PREFIX = "STORED_";
const DEFAULT_PEN_CELLS: Record<string, { x: number; y: number }> = {
  PEN_CHICKEN: { x: 8, y: 12 }, PEN_SHEEP: { x: 16, y: 12 }, PEN_COW: { x: 12, y: 16 },
};
function decorationPlacementError(farm: any, x: number, y: number, excludeId?: number | string) {
  if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= 28 || y >= 28)
    return "Invalid grid cell";
  if (!farm.tiles.some((t: any) => t.unlocked && t.x === Math.floor(x / 4) && t.y === Math.floor(y / 4)))
    return "This land is locked";
  const house = farm.objects.find((o: any) => o.kind === "HOUSE") ?? { x: 13, y: 13 };
  if (x >= house.x && x < house.x + 2 && y >= house.y && y < house.y + 2)
    return "The house occupies this cell";
  for (const kind of Object.keys(DEFAULT_PEN_CELLS)) {
    const pen = farm.objects.find((o: any) => o.kind === kind) ?? DEFAULT_PEN_CELLS[kind];
    if (x >= pen.x && x < pen.x + 4 && y >= pen.y && y < pen.y + 4)
      return "An animal pen occupies this cell";
  }
  if (farm.objects.some((o: any) => o.id !== excludeId && DECORATIONS.includes(o.kind) && o.x === x && o.y === y))
    return "This cell is already occupied";
  return null;
}
router.post("/decoration/place", async (req: TgAuthedRequest, res) => {
  const rawId = req.telegramUser?.id;
  if (!rawId || !Number.isSafeInteger(rawId)) return res.status(401).json({ error: "Unauthorized" });
  const { kind, x, y } = req.body ?? {};
  if (!DECORATIONS.includes(kind)) return res.status(400).json({ error: "Unknown decoration" });
  try {
    const user = await prisma.user.findUnique({ where: { telegramId: BigInt(rawId) }, select: { id: true } });
    if (!user) return res.status(404).json({ error: "User not found" });
    const result = await prisma.$transaction(async tx => {
      const farm = await tx.farmMap.findUnique({ where: { userId: user.id }, include: { tiles: true, objects: true } });
      if (!farm) return { status: 404, error: "Farm not found" };
      const error = decorationPlacementError(farm, x, y);
      if (error) return { status: 400, error };
      if (!await debitDecoration(tx,user.id,kind,1))
        return { status: 400, error: "Недостатньо монет або діамантів" };
      const obj = await tx.farmObject.create({ data: { farmId: farm.id, kind, x, y, rotation: 0 } });
      return { status: 200, ok: true, object: { id: obj.id, kind, x, y } };
    }, { isolationLevel: "Serializable" });
    return res.status(result.status).json(result);
  } catch (error) { console.error("DECORATION PLACE ERROR", error); return res.status(500).json({ error: "Could not place decoration" }); }
});
router.post("/decoration/move", async (req: TgAuthedRequest, res) => {
  const rawId = req.telegramUser?.id;
  if (!rawId || !Number.isSafeInteger(rawId)) return res.status(401).json({ error: "Unauthorized" });
  const { id, x, y } = req.body ?? {};
  if (typeof id !== "string" || !id) return res.status(400).json({ error: "Invalid decoration ID" });
  try {
    const user = await prisma.user.findUnique({ where: { telegramId: BigInt(rawId) }, select: { id: true } });
    if (!user) return res.status(404).json({ error: "User not found" });
    const result = await prisma.$transaction(async tx => {
      const farm = await tx.farmMap.findUnique({ where: { userId: user.id }, include: { tiles: true, objects: true } });
      if (!farm) return { status: 404, error: "Farm not found" };
      const obj = farm.objects.find(o => String(o.id) === id && DECORATIONS.includes(o.kind));
      if (!obj) return { status: 404, error: "Decoration not found" };
      const error = decorationPlacementError(farm, x, y, obj.id);
      if (error) return { status: 400, error };
      await tx.farmObject.update({ where: { id: obj.id }, data: { x, y } });
      return { status: 200, ok: true };
    }, { isolationLevel: "Serializable" });
    return res.status(result.status).json(result);
  } catch (error) { console.error("DECORATION MOVE ERROR", error); return res.status(500).json({ error: "Could not move decoration" }); }
});


// Decoration operations share a serializable transaction. Stored items use
// STORED_DECOR_* kind; they do not occupy any farm cell until restored.
router.post("/decoration/action", async (req: TgAuthedRequest, res) => {
  const rawId = req.telegramUser?.id;
  if (!rawId || !Number.isSafeInteger(rawId)) return res.status(401).json({ error: "Unauthorized" });
  const { action, id, x, y, rotation } = req.body ?? {};
  if (!["rotate", "store", "restore"].includes(action) || typeof id !== "string" || !id)
    return res.status(400).json({ error: "Invalid decoration action" });
  try {
    const user = await prisma.user.findUnique({ where: { telegramId: BigInt(rawId) }, select: { id: true } });
    if (!user) return res.status(404).json({ error: "User not found" });
    const result = await prisma.$transaction(async tx => {
      const farm = await tx.farmMap.findUnique({ where: { userId: user.id }, include: { tiles: true, objects: true } });
      if (!farm) return { status: 404, error: "Farm not found" };
      const obj = farm.objects.find(o => String(o.id) === id);
      if (!obj) return { status: 404, error: "Decoration not found" };
      const stored = obj.kind.startsWith(STORED_PREFIX);
      const originalKind = stored ? obj.kind.slice(STORED_PREFIX.length) : obj.kind;
      if (!DECORATIONS.includes(originalKind)) return { status: 400, error: "Not a decoration" };
      if (action === "rotate") {
        if (stored || !Number.isInteger(rotation) || ![0,90,180,270].includes(rotation))
          return { status: 400, error: "Invalid rotation" };
        await tx.farmObject.update({ where: { id: obj.id }, data: { rotation } });
      } else if (action === "store") {
        if (stored) return { status: 409, error: "Already in storage" };
        await tx.farmObject.update({ where: { id: obj.id }, data: { kind: STORED_PREFIX + obj.kind } });
      } else {
        if (!stored) return { status: 409, error: "Not in storage" };
        const error = decorationPlacementError(farm, x, y, obj.id);
        if (error) return { status: 400, error };
        await tx.farmObject.update({ where: { id: obj.id }, data: { kind: originalKind, x, y } });
      }
      return { status: 200, ok: true };
    }, { isolationLevel: "Serializable" });
    return res.status(result.status).json(result);
  } catch (error) { console.error("DECORATION ACTION ERROR", error); return res.status(500).json({ error: "Could not update decoration" }); }
});


router.post("/decoration/paint", async (req: TgAuthedRequest, res) => {
  const rawId = req.telegramUser?.id;
  if (!rawId || !Number.isSafeInteger(rawId)) return res.status(401).json({ error: "Unauthorized" });
  const { kind, cells } = req.body ?? {};
  if (!(["DECOR_PATH_DIRT", "DECOR_PATH_STONE", "DECOR_PATH_WOOD", "DECOR_FENCE_WOOD"].includes(kind)) ||
      !Array.isArray(cells) || cells.length < 1 || cells.length > 120 ||
      cells.some(c => !Number.isInteger(c?.x) || !Number.isInteger(c?.y)))
    return res.status(400).json({ error: "Invalid path" });
  try {
    const user = await prisma.user.findUnique({ where: { telegramId: BigInt(rawId) }, select: { id: true } });
    if (!user) return res.status(404).json({ error: "User not found" });
    const result = await prisma.$transaction(async tx => {
      const farm = await tx.farmMap.findUnique({ where: { userId: user.id }, include: { tiles: true, objects: true } });
      if (!farm) return { status: 404, error: "Farm not found" };
      let placed = 0;
      const validCells: {x:number;y:number}[]=[];
      const seen = new Set<string>();
      for (const cell of cells) {
        const key = `${cell.x},${cell.y}`;
        if (seen.has(key)) continue;
        seen.add(key);
        if (decorationPlacementError(farm, cell.x, cell.y)) continue;
        // Reserve the cell in memory before processing the next one.
        farm.objects.push({...farm.objects[0],id:-validCells.length-1,kind,x:cell.x,y:cell.y} as any);
        validCells.push({x:cell.x,y:cell.y});
      }
      placed=validCells.length;
      if (!placed) return {status:400,error:"Немає вільних клітинок"};
      if (!await debitDecoration(tx,user.id,kind,placed))
        return {status:400,error:"Недостатньо монет"};
      await tx.farmObject.createMany({data:validCells.map(cell=>({farmId:farm.id,kind,x:cell.x,y:cell.y,rotation:0}))});
      return { status: 200, ok: true, placed, price: DECORATION_PRICES[kind].coins*placed };
    }, { isolationLevel: "Serializable", timeout: 15000 });
    return res.status(result.status).json(result);
  } catch (error) { console.error("DECORATION PAINT ERROR", error); return res.status(500).json({ error: "Could not paint path" }); }
});


// House upgrades are cosmetic only. Serializable transaction and conditional
// debit prevent duplicate charges and concurrent purchases.
const HOUSE_UPGRADE_PRICES = [
  { coins: 25000, diamonds: 0 },
  { coins: 100000, diamonds: 0 },
  { coins: 350000, diamonds: 25 },
  { coins: 1000000, diamonds: 100 },
];
router.post("/house/upgrade", async (req: TgAuthedRequest, res) => {
  const rawId = req.telegramUser?.id;
  if (!rawId || !Number.isSafeInteger(rawId)) return res.status(401).json({ error: "Unauthorized" });
  try {
    const user = await prisma.user.findUnique({
      where: { telegramId: BigInt(rawId) }, select: { id: true }
    });
    if (!user) return res.status(404).json({ error: "User not found" });
    const result = await prisma.$transaction(async tx => {
      const farm = await tx.farmMap.findUnique({ where: { userId: user.id } });
      if (!farm) return { status: 404, error: "Farm not found" };
      if (farm.houseLevel >= 5) return { status: 409, error: "Maximum house level reached" };
      const price = HOUSE_UPGRADE_PRICES[farm.houseLevel - 1];
      const paid = await tx.user.updateMany({
        where: { id: user.id, coins: { gte: price.coins }, diamonds: { gte: price.diamonds } },
        data: { coins: { decrement: price.coins }, diamonds: { decrement: price.diamonds } }
      });
      if (paid.count !== 1) return { status: 400, error: "Недостатньо монет або діамантів" };
      const updated = await tx.farmMap.update({
        where: { id: farm.id }, data: { houseLevel: { increment: 1 } }
      });
      return { status: 200, ok: true, houseLevel: updated.houseLevel, price };
    }, { isolationLevel: "Serializable", timeout: 10000 });
    return res.status(result.status).json(result);
  } catch (error) {
    console.error("HOUSE UPGRADE ERROR", error);
    return res.status(500).json({ error: "Could not upgrade house" });
  }
});

export default router;
