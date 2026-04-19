import { Router } from "express";
import { prisma } from "../prisma";
import type { TgAuthedRequest } from "../middleware/telegramAuth";
import { AnimalType } from "@prisma/client";

const router = Router();

type UpgradeCost = {
  coins: number;
  diamonds: number;
};

const ANIMAL_UPGRADE_COSTS: Record<AnimalType, Record<number, UpgradeCost>> = {
  CHICKEN: {
    1: { coins: 100, diamonds: 0 },
    2: { coins: 200, diamonds: 0 },
    3: { coins: 400, diamonds: 2 },
    4: { coins: 800, diamonds: 5 },
  },
  SHEEP: {
    1: { coins: 250, diamonds: 0 },
    2: { coins: 500, diamonds: 0 },
    3: { coins: 900, diamonds: 3 },
    4: { coins: 1500, diamonds: 6 },
  },
  COW: {
    1: { coins: 500, diamonds: 0 },
    2: { coins: 900, diamonds: 0 },
    3: { coins: 1500, diamonds: 4 },
    4: { coins: 2500, diamonds: 8 },
  },
};

const STORAGE_LEVELS: Record<
  number,
  { capacity: number; cost: UpgradeCost | null }
> = {
  1: { capacity: 1000, cost: { coins: 300, diamonds: 0 } },
  2: { capacity: 1500, cost: { coins: 700, diamonds: 0 } },
  3: { capacity: 2200, cost: { coins: 1500, diamonds: 2 } },
  4: { capacity: 3200, cost: { coins: 3000, diamonds: 5 } },
  5: { capacity: 4500, cost: null },
};

function getLuckyChance(currentLevel: number) {
  if (currentLevel === 3) return 0.1;
  if (currentLevel === 4) return 0.05;
  return 0;
}

async function getAnimalTypeState(
  userId: number,
  type: AnimalType,
  coins: number,
  diamonds: number,
) {
  const animals = await prisma.animal.findMany({
    where: { userId, type },
    select: { level: true },
  });

  const owned = animals.length;

  if (owned === 0) {
    return {
      type,
      owned: 0,
      currentLevel: 0,
      nextLevel: 1,
      maxed: false,
      upgradeCost: null,
      canUpgrade: false,
    };
  }

  const currentLevel = Math.max(...animals.map((a) => a.level));
  const maxed = currentLevel >= 5;
  const upgradeCost = maxed
    ? null
    : (ANIMAL_UPGRADE_COSTS[type][currentLevel] ?? null);

  return {
    type,
    owned,
    currentLevel,
    nextLevel: maxed ? 5 : currentLevel + 1,
    maxed,
    upgradeCost,
    canUpgrade:
      !!upgradeCost &&
      coins >= upgradeCost.coins &&
      diamonds >= upgradeCost.diamonds,
  };
}

router.get("/", async (req: TgAuthedRequest, res) => {
  try {
    if (!req.telegramUser?.id) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const telegramId = BigInt(req.telegramUser.id);

    const user = await prisma.user.findUnique({
      where: { telegramId },
      include: { storage: true },
    });

    if (!user || !user.storage) {
      return res.status(404).json({ error: "User not found" });
    }

    const chicken = await getAnimalTypeState(
      user.id,
      AnimalType.CHICKEN,
      user.coins ?? 0,
      user.diamonds ?? 0,
    );
    const sheep = await getAnimalTypeState(
      user.id,
      AnimalType.SHEEP,
      user.coins ?? 0,
      user.diamonds ?? 0,
    );
    const cow = await getAnimalTypeState(
      user.id,
      AnimalType.COW,
      user.coins ?? 0,
      user.diamonds ?? 0,
    );

    const currentStorageLevel = user.warehouseLevel ?? 1;
    const currentStorageCfg =
      STORAGE_LEVELS[currentStorageLevel] ?? STORAGE_LEVELS[1];
    const nextStorageLevel = Math.min(5, currentStorageLevel + 1);
    const nextStorageCfg =
      STORAGE_LEVELS[nextStorageLevel] ?? currentStorageCfg;
    const maxed = currentStorageLevel >= 5;
    const storageCost = currentStorageCfg.cost;

    return res.json({
      ok: true,
      animals: {
        chicken,
        sheep,
        cow,
      },
      storage: {
        currentLevel: currentStorageLevel,
        nextLevel: maxed ? 5 : nextStorageLevel,
        capacity: user.storage.capacity ?? currentStorageCfg.capacity,
        nextCapacity: maxed
          ? (user.storage.capacity ?? currentStorageCfg.capacity)
          : nextStorageCfg.capacity,
        maxed,
        upgradeCost: storageCost,
        canUpgrade:
          !maxed &&
          !!storageCost &&
          (user.coins ?? 0) >= storageCost.coins &&
          (user.diamonds ?? 0) >= storageCost.diamonds,
      },
    });
  } catch (e) {
    console.error("LAB GET ERROR:", e);
    return res.status(500).json({ error: "Server error" });
  }
});

router.post("/animal-upgrade", async (req: TgAuthedRequest, res) => {
  try {
    if (!req.telegramUser?.id) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { type } = req.body as { type?: AnimalType };

    if (!type || !["CHICKEN", "SHEEP", "COW"].includes(type)) {
      return res.status(400).json({ error: "Invalid animal type" });
    }

    const telegramId = BigInt(req.telegramUser.id);

    const user = await prisma.user.findUnique({
      where: { telegramId },
      select: { id: true, coins: true, diamonds: true },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const animals = await prisma.animal.findMany({
      where: { userId: user.id, type },
      select: { id: true, level: true },
    });

    if (!animals.length) {
      return res.status(400).json({ error: "Спочатку купи тварин" });
    }

    const currentLevel = Math.max(...animals.map((a) => a.level));

    if (currentLevel >= 5) {
      return res.status(400).json({ error: "Максимальний рівень" });
    }

    const cost = ANIMAL_UPGRADE_COSTS[type][currentLevel];

    if (!cost) {
      return res.status(400).json({ error: "Немає ціни для цього рівня" });
    }

    if ((user.coins ?? 0) < cost.coins) {
      return res.status(400).json({ error: "Не вистачає coins" });
    }

    if ((user.diamonds ?? 0) < cost.diamonds) {
      return res.status(400).json({ error: "Не вистачає diamonds" });
    }

    let nextLevel = currentLevel + 1;
    let luckyUpgrade = false;

    const luckyChance = getLuckyChance(currentLevel);
    if (luckyChance > 0 && Math.random() < luckyChance) {
      nextLevel = Math.min(5, nextLevel + 1);
      luckyUpgrade = true;
    }

    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: {
          coins: { decrement: cost.coins },
          diamonds: { decrement: cost.diamonds },
        },
      }),
      prisma.animal.updateMany({
        where: { userId: user.id, type },
        data: { level: nextLevel },
      }),
    ]);

    const updatedUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { coins: true, diamonds: true },
    });

    return res.json({
      ok: true,
      type,
      previousLevel: currentLevel,
      level: nextLevel,
      luckyUpgrade,
      spent: cost,
      coins: updatedUser?.coins ?? 0,
      diamonds: updatedUser?.diamonds ?? 0,
    });
  } catch (e) {
    console.error("LAB ANIMAL UPGRADE ERROR:", e);
    return res.status(500).json({ error: "Server error" });
  }
});

router.post("/storage-upgrade", async (req: TgAuthedRequest, res) => {
  try {
    if (!req.telegramUser?.id) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const telegramId = BigInt(req.telegramUser.id);

    const user = await prisma.user.findUnique({
      where: { telegramId },
      include: { storage: true },
    });

    if (!user || !user.storage) {
      return res.status(404).json({ error: "User not found" });
    }

    const currentLevel = user.warehouseLevel ?? 1;

    if (currentLevel >= 5) {
      return res.status(400).json({ error: "Максимальний рівень складу" });
    }

    const currentCfg = STORAGE_LEVELS[currentLevel];
    const nextCfg = STORAGE_LEVELS[currentLevel + 1];

    if (!currentCfg?.cost || !nextCfg) {
      return res.status(400).json({ error: "Немає наступного рівня" });
    }

    if ((user.coins ?? 0) < currentCfg.cost.coins) {
      return res.status(400).json({ error: "Не вистачає coins" });
    }

    if ((user.diamonds ?? 0) < currentCfg.cost.diamonds) {
      return res.status(400).json({ error: "Не вистачає diamonds" });
    }

    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: {
          coins: { decrement: currentCfg.cost.coins },
          diamonds: { decrement: currentCfg.cost.diamonds },
          warehouseLevel: currentLevel + 1,
        },
      }),
      prisma.storage.update({
        where: { userId: user.id },
        data: {
          capacity: nextCfg.capacity,
        },
      }),
    ]);

    return res.json({
      ok: true,
      level: currentLevel + 1,
      capacity: nextCfg.capacity,
      spent: currentCfg.cost,
    });
  } catch (e) {
    console.error("LAB STORAGE UPGRADE ERROR:", e);
    return res.status(500).json({ error: "Server error" });
  }
});

export default router;
