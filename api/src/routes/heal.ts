import { Router } from "express";
import { prisma } from "../prisma";
import type { TgAuthedRequest } from "../middleware/telegramAuth";

const router = Router();

type AnimalType = "CHICKEN" | "SHEEP" | "COW";

const HEAL_MULTIPLIER: Record<string, number> = {
  normal: 1,
  rare: 1.5,
  epic: 2,
  legendary: 3,
};

const HEAL_COSTS = {
  CHICKEN: {
    coins: { 1: 500, 2: 1000, 3: 2000 },
    points: { 4: 5000, 5: 12000 },
  },
  SHEEP: {
    coins: { 1: 1500, 2: 3000, 3: 6000 },
    points: { 4: 15000, 5: 35000 },
  },
  COW: {
    coins: { 1: 5000, 2: 10000, 3: 20000 },
    points: { 4: 30000, 5: 70000 },
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
  rarity: string,
  hp: number,
) {
  const level = normalizeLevel(levelRaw || 1);

  const rarityMultiplier =
    HEAL_MULTIPLIER[String(rarity || "normal").toLowerCase()] ?? 1;

  const missingHp = Math.max(0, 100 - (hp ?? 100));
  const hpMultiplier = missingHp / 100;

  if (level <= 3) {
    const base = HEAL_COSTS[type].coins[level as 1 | 2 | 3] * rarityMultiplier;

    return {
      currency: "coins" as const,
      amount: Math.max(1, Math.floor(base * hpMultiplier)),
      level,
    };
  }

  const base = HEAL_COSTS[type].points[level as 4 | 5] * rarityMultiplier;

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

    if (animalsToHeal.length <= 0) {
      return res.status(400).json({ error: "No animals to heal" });
    }

    let totalCoinsCost = 0;
    let totalPointsCost = 0;

    const breakdown = animalsToHeal.map((animal) => {
      const type = animal.type as AnimalType;
      const cost = getHealCost(
        type,
        animal.level ?? 1,
        (animal as any).rarity || "normal",
        (animal as any).hp ?? 100,
      );

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

    const now = new Date();
    const animalIds = animalsToHeal.map((animal) => animal.id);

    const result = await prisma.$transaction(async (tx) => {
      const updatedUser = await tx.user.update({
        where: { id: user.id },
        data: {
          coins: totalCoinsCost > 0 ? { decrement: totalCoinsCost } : undefined,
          points:
            totalPointsCost > 0 ? { decrement: totalPointsCost } : undefined,
        },
        select: {
          coins: true,
          points: true,
        },
      });

      await tx.animal.updateMany({
        where: {
          id: { in: animalIds },
          userId: user.id,
        },
        data: {
          bornAt: now,
          lastFedAt: now,
          hp: 100,
        } as any,
      });

      return updatedUser;
    });

    return res.json({
      ok: true,
      healed: animalsToHeal.length,
      animalId,
      costCoins: totalCoinsCost,
      costPoints: totalPointsCost,
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
