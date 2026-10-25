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

export default router;
