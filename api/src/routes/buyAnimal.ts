import { Router } from "express";
import { prisma } from "../prisma";
import type { TgAuthedRequest } from "../middleware/telegramAuth";
import { AnimalType } from "@prisma/client";
import { addXp } from "../lib/xp";

const router = Router();

const ANIMAL_PRICES: Record<AnimalType, number> = {
  CHICKEN: 100,
  SHEEP: 500,
  COW: 1000,
};

const ANIMAL_UNLOCK_LEVEL: Record<AnimalType, number> = {
  CHICKEN: 1,
  SHEEP: 5,
  COW: 10,
};

const ANIMAL_LIMITS: Record<AnimalType, number> = {
  CHICKEN: 5,
  SHEEP: 5,
  COW: 5,
};

router.post("/", async (req: TgAuthedRequest, res) => {
  try {
    if (!req.telegramUser?.id) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const type = String(req.body?.type ?? "").trim() as AnimalType;

    if (!type || !["CHICKEN", "SHEEP", "COW"].includes(type)) {
      return res.status(400).json({ error: "Invalid animal type" });
    }

    const telegramId = BigInt(req.telegramUser.id);

    const user = await prisma.user.findUnique({
      where: { telegramId },
      select: {
        id: true,
        level: true,
        coins: true,
        animals: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const unlockLevel = ANIMAL_UNLOCK_LEVEL[type];

    if ((user.level ?? 1) < unlockLevel) {
      return res.status(400).json({
        error: `Ця тварина відкривається на LVL ${unlockLevel}`,
        requiredLevel: unlockLevel,
        yourLevel: user.level ?? 1,
      });
    }

    const ownedCount = user.animals.filter((a) => a.type === type).length;
    const maxCount = ANIMAL_LIMITS[type];

    if (ownedCount >= maxCount) {
      return res.status(400).json({
        error: `Максимум ${maxCount} тварин цього типу`,
        type,
        ownedCount,
        maxCount,
      });
    }

    const price = ANIMAL_PRICES[type];

    if ((user.coins ?? 0) < price) {
      return res.status(400).json({
        error: "Не вистачає coins",
        need: price,
        have: user.coins ?? 0,
      });
    }

    const now = new Date();

    const [animal, updatedUser] = await prisma.$transaction([
      prisma.animal.create({
        data: {
          userId: user.id,
          type,
          level: 1,
          bornAt: now,
          lastFedAt: now,
          lastClaim: now,
        },
      }),
      prisma.user.update({
        where: { id: user.id },
        data: {
          coins: { decrement: price },
        },
        select: {
          coins: true,
        },
      }),
    ]);

    const xpResult = await addXp(user.id, 20);

    return res.json({
      ok: true,
      animal,
      coins: updatedUser.coins,
      spent: price,
      limit: {
        type,
        ownedCount: ownedCount + 1,
        maxCount,
      },
      xp: xpResult,
    });
  } catch (e) {
    console.error("BUY ANIMAL ERROR:", e);
    return res.status(500).json({ error: "Server error" });
  }
});

export default router;
