import { Router } from "express";
import { prisma } from "../prisma";
import type { TgAuthedRequest } from "../middleware/telegramAuth";
import { addSellToday } from "../lib/questProgress";
import { addXp } from "../lib/xp";

const router = Router();

const PRICES = {
  eggs: 6,
  wool: 15,
  milk: 30,
} as const;

function pointsRate(level: number, lvl4Rate: number, lvl5Rate: number) {
  if (level >= 5) return lvl5Rate;
  if (level >= 4) return lvl4Rate;
  return 0;
}

router.post("/", async (req: TgAuthedRequest, res) => {
  try {
    if (!req.telegramUser?.id) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const telegramId = BigInt(req.telegramUser.id);

    const user = await prisma.user.findUnique({
      where: { telegramId },
      include: {
        storage: true,
        animals: true,
      },
    });

    if (!user || !user.storage) {
      return res.status(404).json({ error: "Storage not found" });
    }

    const eggs = user.storage.eggs ?? 0;
    const wool = user.storage.wool ?? 0;
    const milk = user.storage.milk ?? 0;

    const totalCoins =
      eggs * PRICES.eggs + wool * PRICES.wool + milk * PRICES.milk;

    const chickenLevel =
      user.animals.find((a) => a.type === "CHICKEN")?.level ?? 0;

    const sheepLevel = user.animals.find((a) => a.type === "SHEEP")?.level ?? 0;

    const cowLevel = user.animals.find((a) => a.type === "COW")?.level ?? 0;

    const eggsPoints = eggs * pointsRate(chickenLevel, 1, 3);
    const woolPoints = wool * pointsRate(sheepLevel, 2, 6);
    const milkPoints = milk * pointsRate(cowLevel, 3, 10);

    const totalPoints = eggsPoints + woolPoints + milkPoints;

    if (totalCoins <= 0 && totalPoints <= 0) {
      return res.json({
        ok: true,
        sold: { eggs, wool, milk },
        earned: 0,
        earnedPoints: 0,
        totalCoins: user.coins,
        totalPoints: user.points,
      });
    }

    const updated = await prisma.user.update({
      where: { telegramId },
      data: {
        coins: { increment: totalCoins },
        points: { increment: totalPoints },
        storage: {
          update: {
            eggs: 0,
            wool: 0,
            milk: 0,
          },
        },
      },
      select: {
        coins: true,
        points: true,
      },
    });

    await addSellToday(user.id, 1);

    const xpResult = await addXp(user.id, Math.floor(totalCoins / 20));

    return res.json({
      ok: true,
      sold: { eggs, wool, milk },
      prices: PRICES,
      earned: totalCoins,
      earnedPoints: totalPoints,
      totalCoins: updated.coins,
      totalPoints: updated.points,
      pointsBreakdown: {
        eggs: eggsPoints,
        wool: woolPoints,
        milk: milkPoints,
      },
      animalLevels: {
        chicken: chickenLevel,
        sheep: sheepLevel,
        cow: cowLevel,
      },
      xp: xpResult,
    });
  } catch (e) {
    console.error("SELL ERROR:", e);
    return res.status(500).json({ error: "Server error" });
  }
});

export default router;
