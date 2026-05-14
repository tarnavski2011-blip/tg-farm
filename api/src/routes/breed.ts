import { Router } from "express";
import { prisma } from "../prisma";
import type { TgAuthedRequest } from "../middleware/telegramAuth";
import { AnimalType } from "@prisma/client";

const router = Router();

const BREED_COSTS: Record<AnimalType, { coins: number; diamonds: number }> = {
  CHICKEN: { coins: 500000, diamonds: 50 },
  SHEEP: { coins: 1500000, diamonds: 150 },
  COW: { coins: 3000000, diamonds: 300 },
};

function getBreedResult() {
  const roll = Math.random() * 100;

  if (roll <= 5) {
    return {
      rarity: "legendary",
      breedBonus: 1.35,
    };
  }

  if (roll <= 30) {
    return {
      rarity: "epic",
      breedBonus: 1.2,
    };
  }

  return {
    rarity: "rare",
    breedBonus: 1.1,
  };
}

router.post("/", async (req: TgAuthedRequest, res) => {
  try {
    if (!req.telegramUser?.id) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const telegramId = BigInt(req.telegramUser.id);
    const animalType = String(req.body?.animalType ?? "").trim() as AnimalType;
    const rawAnimalIds = req.body?.animalIds;

    if (!animalType || !["CHICKEN", "SHEEP", "COW"].includes(animalType)) {
      return res.status(400).json({ error: "Wrong animal type" });
    }

    if (!Array.isArray(rawAnimalIds) || rawAnimalIds.length !== 2) {
      return res.status(400).json({ error: "Need exactly 2 animals" });
    }

    const animalIds = rawAnimalIds.map((id) => Number(id));

    if (
      animalIds.length !== 2 ||
      !animalIds[0] ||
      !animalIds[1] ||
      animalIds[0] === animalIds[1]
    ) {
      return res.status(400).json({ error: "Wrong animal ids" });
    }

    const cost = BREED_COSTS[animalType];

    const user = await prisma.user.findUnique({
      where: { telegramId },
      include: {
        animals: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if ((user.coins ?? 0) < cost.coins) {
      return res.status(400).json({
        error: "Not enough coins",
        need: cost.coins,
        have: user.coins ?? 0,
      });
    }

    if ((user.diamonds ?? 0) < cost.diamonds) {
      return res.status(400).json({
        error: "Not enough diamonds",
        need: cost.diamonds,
        have: user.diamonds ?? 0,
      });
    }

    const parents = user.animals.filter(
      (animal) =>
        animalIds.includes(animal.id) &&
        animal.type === animalType &&
        animal.userId === user.id,
    );

    if (parents.length !== 2) {
      return res.status(400).json({ error: "Animals not found" });
    }

    if (parents.some((animal) => (animal.level ?? 1) < 5)) {
      return res.status(400).json({ error: "Both animals must be LVL 5" });
    }

    const parentSlots = parents.map((animal: any) => animal.slotIndex ?? 1);
    const newSlotIndex = Math.min(...parentSlots);
    const result = getBreedResult();
    const now = new Date();

    const created = await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: {
          coins: { decrement: cost.coins },
          diamonds: { decrement: cost.diamonds },
        },
      });

      await tx.animal.deleteMany({
        where: {
          id: {
            in: animalIds,
          },
          userId: user.id,
        },
      });

      const newAnimal = await tx.animal.create({
        data: {
          userId: user.id,
          type: animalType,
          level: 1,
          rarity: result.rarity,
          breedBonus: result.breedBonus,
          slotIndex: newSlotIndex,
          hp: 100,
          bornAt: now,
          lastFedAt: now,
          lastClaim: now,
        } as any,
      });

      return newAnimal;
    });

    return res.json({
      ok: true,
      success: true,
      animal: created,
      type: animalType,
      rarity: result.rarity,
      breedBonus: result.breedBonus,
      slotIndex: newSlotIndex,
      spent: cost,
      message: `New ${result.rarity} animal created`,
    });
  } catch (error) {
    console.error("BREED ERROR:", error);
    return res.status(500).json({
      error: "Breed failed",
      details: String(error),
    });
  }
});

export default router;
