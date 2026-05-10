import { Router } from "express";
import { prisma } from "../prisma";
import type { TgAuthedRequest } from "../middleware/telegramAuth";

const router = Router();

const HEAL_COST_DIAMONDS = {
  CHICKEN: 5,
  SHEEP: 15,
  COW: 30,
  ALL: 50,
} as const;

type AnimalType = keyof typeof HEAL_COST_DIAMONDS;

function isAnimalType(value: string): value is Exclude<AnimalType, "ALL"> {
  return value === "CHICKEN" || value === "SHEEP" || value === "COW";
}

router.post("/", async (req: TgAuthedRequest, res) => {
  try {
    if (!req.telegramUser?.id) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const telegramId = BigInt(req.telegramUser.id);
    const typeRaw = String(req.body?.type ?? "")
      .trim()
      .toUpperCase();

    if (!typeRaw) {
      return res.status(400).json({ error: "Animal type is required" });
    }

    const user = await prisma.user.findUnique({
      where: { telegramId },
      include: { animals: true },
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
      return res.status(400).json({ error: "No animals to heal" });
    }

    const totalCost =
      typeRaw === "ALL"
        ? HEAL_COST_DIAMONDS.ALL
        : animalsToHeal.reduce((sum, animal) => {
            return (
              sum +
              HEAL_COST_DIAMONDS[animal.type as Exclude<AnimalType, "ALL">]
            );
          }, 0);

    if (user.diamonds < totalCost) {
      return res.status(400).json({
        error: "Not enough diamonds",
        need: totalCost,
        have: user.diamonds,
      });
    }

    const now = new Date();
    const animalIds = animalsToHeal.map((animal) => animal.id);

    const result = await prisma.$transaction(async (tx) => {
      const updatedUser = await tx.user.update({
        where: { id: user.id },
        data: {
          diamonds: { decrement: totalCost },
        },
        select: {
          diamonds: true,
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
      diamonds: result.diamonds,
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
