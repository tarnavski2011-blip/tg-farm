import { Router } from "express";
import { prisma } from "../prisma";

const router = Router();

router.post("/", async (req: any, res: any) => {
  try {
    const telegramId = BigInt(req.user.id);

    const animalType = req.body.animalType;
    const animalIds = req.body.animalIds;

    if (!animalType || !Array.isArray(animalIds) || animalIds.length !== 2) {
      return res.status(400).json({ error: "Need exactly 2 animals" });
    }

    const user = await prisma.user.findUnique({
      where: {
        telegramId: telegramId,
      },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const animals = await prisma.animal.findMany({
      where: {
        id: {
          in: animalIds,
        },
        userId: user.id,
        type: animalType,
      },
    });

    if (animals.length !== 2) {
      return res.status(400).json({ error: "Animals not found" });
    }

    const hasLowLevel = animals.some((animal: any) => animal.level < 5);

    if (hasLowLevel) {
      return res.status(400).json({ error: "Animals must be level 5" });
    }

    let coinCost = 0;
    let diamondCost = 0;

    if (animalType === "CHICKEN") {
      coinCost = 500000;
      diamondCost = 50;
    } else if (animalType === "SHEEP") {
      coinCost = 1500000;
      diamondCost = 150;
    } else if (animalType === "COW") {
      coinCost = 3000000;
      diamondCost = 300;
    } else {
      return res.status(400).json({ error: "Wrong animal type" });
    }

    if (user.coins < coinCost) {
      return res.status(400).json({ error: "Not enough coins" });
    }

    if (user.diamonds < diamondCost) {
      return res.status(400).json({ error: "Not enough diamonds" });
    }

    const roll = Math.random() * 100;

    let rarity = "rare";
    let breedBonus = 1.1;

    if (roll <= 5) {
      rarity = "legendary";
      breedBonus = 1.35;
    } else if (roll <= 30) {
      rarity = "epic";
      breedBonus = 1.2;
    }

    const userAny = user as any;

    let slotLimit = 2;

    if (animalType === "CHICKEN") {
      slotLimit = userAny.chickenSlots ?? 2;
    }

    if (animalType === "SHEEP") {
      slotLimit = userAny.sheepSlots ?? 2;
    }

    if (animalType === "COW") {
      slotLimit = userAny.cowSlots ?? 2;
    }

    const existingAnimals = await prisma.animal.findMany({
      where: {
        userId: user.id,
        type: animalType,
      },
      orderBy: {
        slotIndex: "asc",
      },
    });

    let freeSlot = 1;

    for (let i = 1; i <= slotLimit; i++) {
      const used = existingAnimals.find(
        (animal: any) => animal.slotIndex === i,
      );

      if (!used) {
        freeSlot = i;
        break;
      }
    }

    await prisma.$transaction([
      prisma.user.update({
        where: {
          id: user.id,
        },
        data: {
          coins: {
            decrement: coinCost,
          },
          diamonds: {
            decrement: diamondCost,
          },
        },
      }),

      prisma.animal.deleteMany({
        where: {
          id: {
            in: animalIds,
          },
        },
      }),

      prisma.animal.create({
        data: {
          userId: user.id,
          type: animalType,
          level: 1,
          rarity: rarity,
          breedBonus: breedBonus,
          slotIndex: freeSlot,
          hp: 100,
        } as any,
      }),
    ]);

    return res.json({
      success: true,
      rarity: rarity,
      breedBonus: breedBonus,
      slotIndex: freeSlot,
    });
  } catch (error) {
    console.error("Breed error:", error);
    return res.status(500).json({ error: "Breed failed" });
  }
});

export default router;
