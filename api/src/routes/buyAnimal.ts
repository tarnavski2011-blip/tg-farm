import { Router } from "express";
import { prisma } from "../prisma";
import type { TgAuthedRequest } from "../middleware/telegramAuth";
import { AnimalType } from "@prisma/client";

const router = Router();

const ANIMAL_PRICES: Record<AnimalType, number> = {
  CHICKEN: 100,
  SHEEP: 500,
  COW: 1000,
};

router.post("/", async (req: TgAuthedRequest, res) => {
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
      select: {
        id: true,
        coins: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const price = ANIMAL_PRICES[type];

    if (user.coins < price) {
      return res.status(400).json({ error: "Не вистачає coins" });
    }

    const ownedOfType = await prisma.animal.findMany({
      where: { userId: user.id, type },
      select: { level: true },
    });

    const startLevel = ownedOfType.length
      ? Math.max(...ownedOfType.map((a) => a.level))
      : 1;

    const result = await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: {
          coins: { decrement: price },
        },
      });

      const animal = await tx.animal.create({
        data: {
          userId: user.id,
          type,
          level: startLevel,
          lastClaim: new Date(),
        },
      });

      const userAfter = await tx.user.findUnique({
        where: { id: user.id },
        select: {
          coins: true,
        },
      });

      const totalOwned = await tx.animal.count({
        where: { userId: user.id, type },
      });

      return {
        animal,
        coins: userAfter?.coins ?? 0,
        totalOwned,
      };
    });

    return res.json({
      ok: true,
      type,
      bought: 1,
      level: result.animal.level,
      totalOwned: result.totalOwned,
      coins: result.coins,
    });
  } catch (e) {
    console.error("BUY ANIMAL ERROR:", e);
    return res.status(500).json({ error: "Server error" });
  }
});

export default router;
