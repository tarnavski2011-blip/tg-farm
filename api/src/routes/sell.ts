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

const POINTS = {
  eggs: 1,
  wool: 2,
  milk: 3,
} as const;

router.post("/", async (req: TgAuthedRequest, res) => {
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
      return res.status(404).json({ error: "Storage not found" });
    }

    const eggs = user.storage.eggs ?? 0;
    const wool = user.storage.wool ?? 0;
    const milk = user.storage.milk ?? 0;

    const totalCoins =
      eggs * PRICES.eggs + wool * PRICES.wool + milk * PRICES.milk;

    const totalPoints =
      eggs * POINTS.eggs + wool * POINTS.wool + milk * POINTS.milk;

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
      pointsRates: POINTS,
      earned: totalCoins,
      earnedPoints: totalPoints,
      totalCoins: updated.coins,
      totalPoints: updated.points,
      xp: xpResult,
    });
  } catch (e) {
    console.error("SELL ERROR:", e);
    return res.status(500).json({ error: "Server error" });
  }
});

export default router;
