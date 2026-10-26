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

export default router;
