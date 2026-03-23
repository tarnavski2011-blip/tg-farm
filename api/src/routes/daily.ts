import { Router } from "express";
import type { TgAuthedRequest } from "../middleware/telegramAuth";
import { prisma } from "../prisma";

const router = Router();

const DAY_MS = 24 * 60 * 60 * 1000;

function calcReward(streak: number) {
  return 200 + 50 * streak;
}

router.post("/claim", async (req: TgAuthedRequest, res) => {
  if (!req.telegramUser!.id)
    return res.status(401).json({ error: "Unauthorized" });

  const telegramId = BigInt(req.telegramUser!.id);
  const user = await prisma.user.upsert({
    where: { telegramId },
    update: {},
    create: { telegramId },
  });

  const now = Date.now();
  const last = user.lastDailyAt ? user.lastDailyAt.getTime() : 0;

  if (last && now - last < DAY_MS) {
    const nextInSec = Math.ceil((DAY_MS - (now - last)) / 1000);
    return res.status(400).json({ error: "Too early", nextInSec });
  }

  const missedTooMuch = last && now - last > 2 * DAY_MS;
  const newStreak = missedTooMuch
    ? 1
    : Math.min(7, (user.dailyStreak || 0) + 1);

  const rewardCoins = calcReward(newStreak);

  const updated = await prisma.user.update({
    where: { telegramId },
    data: {
      dailyStreak: newStreak,
      lastDailyAt: new Date(now),
      coins: { increment: rewardCoins },
    },
  });

  return res.json({
    ok: true,
    dailyStreak: updated.dailyStreak,
    rewardCoins,
    coins: updated.coins,
    lastDailyAt: updated.lastDailyAt,
  });
});

export default router;
