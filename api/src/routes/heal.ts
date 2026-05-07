import { Router } from "express";
import { prisma } from "../prisma";
import type { TgAuthedRequest } from "../middleware/telegramAuth";

const router = Router();

const HEAL_PRICES = {
  CHICKEN: 50,
  SHEEP: 150,
  COW: 300,
} as const;

type AnimalType = keyof typeof HEAL_PRICES;

function isAnimalType(value: string): value is AnimalType {
  return value === "CHICKEN" || value === "SHEEP" || value === "COW";
}

router.post("/", async (req: TgAuthedRequest, res) => {
  try {
    if (!req.telegramUser?.id) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const telegramId = BigInt(req.telegramUser.id);
    const typeRaw = String(req.body?.type ?? "").trim();

    if (!typeRaw) {
      return res.status(400).json({ error: "Animal type is required" });
    }

    const user = await prisma.user.findUnique({
      where: { telegramId },
      include: {
        animals: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const animalsToHeal =
      typeRaw === "ALL"
        ? user.animals
        : isAnimalType(typeRaw)
          ? user.animals.filter((animal) => animal.type === typeRaw)
          : [];

    if (animalsToHeal.length <= 0) {
      return res.status(400).json({
        error: "No animals to heal",
      });
    }

    const totalCost = animalsToHeal.reduce((sum, animal) => {
      return sum + HEAL_PRICES[animal.type as AnimalType];
    }, 0);

    if (user.coins < totalCost) {
      return res.status(400).json({
        error: "Not enough coins",
        need: totalCost,
        have: user.coins,
      });
    }

    const now = new Date();
    const animalIds = animalsToHeal.map((animal) => animal.id);

    const result = await prisma.$transaction(async (tx) => {
      const updatedUser = await tx.user.update({
        where: { id: user.id },
        data: {
          coins: { decrement: totalCost },
        },
        select: {
          coins: true,
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
        },
      });

      return updatedUser;
    });

    return res.json({
      ok: true,
      healed: animalsToHeal.length,
      type: typeRaw,
      cost: totalCost,
      coins: result.coins,
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
