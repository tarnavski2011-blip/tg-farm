import { recordQuestMetric } from "../lib/questMetrics";
import { getCurrentHp } from "../lib/animalHp";
import { Router } from "express";
import { prisma } from "../prisma";
import type { TgAuthedRequest } from "../middleware/telegramAuth";

const router = Router();

type AnimalType = "CHICKEN" | "SHEEP" | "COW";

const HEAL_COSTS = {
  CHICKEN: {
    coins: { 1: 500, 2: 1000, 3: 2000 },
    points: { 4: 2160, 5: 6480 },
  },
  SHEEP: {
    coins: { 1: 1500, 2: 3000, 3: 6000 },
    points: { 4: 2880, 5: 7680 },
  },
  COW: {
    coins: { 1: 5000, 2: 10000, 3: 20000 },
    points: { 4: 3840, 5: 9600 },
  },
} as const;

function isAnimalType(value: string): value is AnimalType {
  return value === "CHICKEN" || value === "SHEEP" || value === "COW";
}

function normalizeLevel(level: number) {
  if (level <= 1) return 1;
  if (level === 2) return 2;
  if (level === 3) return 3;
  if (level === 4) return 4;
  return 5;
}

function getHealCost(
  type: AnimalType,
  levelRaw: number,
  _rarity: string,
  hp: number,
) {
  const level = normalizeLevel(levelRaw || 1);

  const missingHp = Math.max(0, 100 - (hp ?? 100));
  const hpMultiplier = missingHp / 100;

  if (level <= 3) {
    const base = HEAL_COSTS[type].coins[level as 1 | 2 | 3];

    return {
      currency: "coins" as const,
      amount: Math.max(1, Math.floor(base * hpMultiplier)),
      level,
    };
  }

  const base = HEAL_COSTS[type].points[level as 4 | 5];

  return {
    currency: "points" as const,
    amount: Math.max(1, Math.floor(base * hpMultiplier)),
    level,
  };
}

router.post("/", async (req: TgAuthedRequest, res) => {
  try {
    if (!req.telegramUser?.id) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const telegramId = BigInt(req.telegramUser.id);
    const animalId = req.body?.animalId ? Number(req.body.animalId) : null;
    const typeRaw = String(req.body?.type ?? "")
      .trim()
      .toUpperCase();

    const user = await prisma.user.findUnique({
      where: { telegramId },
      include: { animals: true },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    let animalsToHeal = [];

    if (animalId) {
      animalsToHeal = user.animals.filter((animal) => animal.id === animalId);
    } else {
      if (!typeRaw) {
        return res.status(400).json({ error: "Animal type is required" });
      }

      animalsToHeal =
        typeRaw === "ALL"
          ? user.animals
          : isAnimalType(typeRaw)
            ? user.animals.filter((animal) => animal.type === typeRaw)
            : [];
    }

    const currentLifePercent = (animal: (typeof user.animals)[number]) =>
      getCurrentHp(animal);
    animalsToHeal = animalsToHeal.filter(
      (animal) => currentLifePercent(animal) < 100,
    );

    if (animalsToHeal.length <= 0) {
      return res.status(400).json({ error: "No animals need healing" });
    }

    let totalCoinsCost = 0;
    let totalPointsCost = 0;
    let totalDiamondsCost = 0;

    const breakdown = animalsToHeal.map((animal) => {
      const type = animal.type as AnimalType;
      const cost = getHealCost(
        type,
        animal.level ?? 1,
        (animal as any).rarity || "normal",
        currentLifePercent(animal),
      );

      const diamondCost = 0;
      totalDiamondsCost += diamondCost;
      if (cost.currency === "coins") {
        totalCoinsCost += cost.amount;
      } else {
        totalPointsCost += cost.amount;
      }

      return {
        animalId: animal.id,
        type,
        rarity: (animal as any).rarity || "normal",
        level: cost.level,
        currency: cost.currency,
        amount: cost.amount,
        diamonds: diamondCost,
      };
    });

    if ((user.coins ?? 0) < totalCoinsCost) {
      return res.status(400).json({
        error: "Not enough coins",
        need: totalCoinsCost,
        have: user.coins ?? 0,
      });
    }

    if ((user.points ?? 0) < totalPointsCost) {
      return res.status(400).json({
        error: "Not enough points",
        need: totalPointsCost,
        have: user.points ?? 0,
      });
    }

    if ((user.diamonds ?? 0) < totalDiamondsCost) {
      return res
        .status(400)
        .json({
          error: "Not enough diamonds",
          need: totalDiamondsCost,
          have: user.diamonds ?? 0,
        });
    }

    const now = new Date();

    const result = await prisma.$transaction(async (tx) => {
      const paid = await tx.user.updateMany({
        where: {
          id: user.id,
          coins: { gte: totalCoinsCost },
          points: { gte: totalPointsCost },
          diamonds: { gte: totalDiamondsCost },
        },
        data: {
          coins: { decrement: totalCoinsCost },
          points: { decrement: totalPointsCost },
          diamonds: { decrement: totalDiamondsCost },
        },
      });
      if (paid.count !== 1)
        throw new Error("Insufficient balance at payment time");
      const updatedUser = await tx.user.findUniqueOrThrow({
        where: { id: user.id },
        select: { coins: true, points: true, diamonds: true },
      });

      // Conditional updates prevent charging twice for a concurrent heal.
      for (const animal of animalsToHeal) {
        const updated = await tx.animal.updateMany({
          where: {
            id: animal.id,
            userId: user.id,
            hpUpdatedAt: animal.hpUpdatedAt,
            hp: animal.hp,
          },
          data: { hp: 100, hpUpdatedAt: now, lastClaim: now },
        });
        if (updated.count !== 1)
          throw new Error("Animal health changed during healing; retry");
      }

      return updatedUser;
    });

    await recordQuestMetric(user.id,"heals",animalsToHeal.length).catch(console.error);
    return res.json({
      ok: true,
      healed: animalsToHeal.length,
      animalId,
      costCoins: totalCoinsCost,
      costPoints: totalPointsCost,
      costDiamonds: totalDiamondsCost,
      diamonds: result.diamonds,
      coins: result.coins,
      points: result.points,
      breakdown,
    });
  } catch (e) {
    console.error("HEAL ERROR:", e);
    return res.status(500).json({
      error: "Server error",
      details: String(e),
    });
  }
});

export default router;
