import { Router } from "express";
import { prisma } from "../prisma";
import type { TgAuthedRequest } from "../middleware/telegramAuth";

const router = Router();

const DAY_MS = 24 * 60 * 60 * 1000;

const DAILY_REWARDS = [
  { day: 1, coins: 50, diamonds: 0 },
  { day: 2, coins: 100, diamonds: 0 },
  { day: 3, coins: 200, diamonds: 0 },
  { day: 4, coins: 0, diamonds: 1 },
  { day: 5, coins: 0, diamonds: 3 },
  { day: 6, coins: 0, diamonds: 5 },
  { day: 7, coins: 500, diamonds: 5 },
];

function getDayDiff(a: Date, b: Date) {
  const aStart = new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime();
  const bStart = new Date(b.getFullYear(), b.getMonth(), b.getDate()).getTime();
  return Math.floor((aStart - bStart) / DAY_MS);
}

function getRewardForDay(day: number) {
  return DAILY_REWARDS[day - 1] ?? DAILY_REWARDS[0];
}

router.get("/", async (req: TgAuthedRequest, res) => {
  try {
    const telegramId = BigInt(req.telegramUser!.id);

    const user = await prisma.user.findUnique({
      where: { telegramId },
      select: {
        id: true,
        dailyStreak: true,
        lastDailyAt: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const now = new Date();

    let streak = user.dailyStreak ?? 0;
    let claimed = false;

    if (user.lastDailyAt) {
      const diff = getDayDiff(now, new Date(user.lastDailyAt));

      if (diff === 0) {
        claimed = true;
      } else if (diff > 1) {
        streak = 0;
      }
    }

    const nextDay = Math.min(7, streak + 1);
    const reward = getRewardForDay(nextDay);

    return res.json({
      ok: true,
      day: nextDay,
      claimed,
      streak,
      rewards: DAILY_REWARDS,
      todayReward: reward,
    });
  } catch (e) {
    console.error("DAILY GET ERROR:", e);
    return res.status(500).json({ error: "Server error" });
  }
});

router.post("/", async (req: TgAuthedRequest, res) => {
  try {
    const telegramId = BigInt(req.telegramUser!.id);

    const user = await prisma.user.findUnique({
      where: { telegramId },
      select: {
        id: true,
        coins: true,
        diamonds: true,
        dailyStreak: true,
        lastDailyAt: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const now = new Date();

    let streak = user.dailyStreak ?? 0;

    if (user.lastDailyAt) {
      const diff = getDayDiff(now, new Date(user.lastDailyAt));

      if (diff === 0) {
        return res.status(400).json({
          error: "Вже забрано сьогодні",
        });
      }

      if (diff > 1) {
        streak = 0;
      }
    }

    const nextDay = Math.min(7, streak + 1);
    const reward = getRewardForDay(nextDay);

    const nextStreak = nextDay >= 7 ? 0 : nextDay;

    await prisma.user.update({
      where: { id: user.id },
      data: {
        coins: { increment: reward.coins },
        diamonds: { increment: reward.diamonds },
        dailyStreak: nextStreak,
        lastDailyAt: now,
      },
    });

    return res.json({
      ok: true,
      day: nextDay,
      reward,
      nextStreak,
    });
  } catch (e) {
    console.error("DAILY POST ERROR:", e);
    return res.status(500).json({ error: "Server error" });
  }
});

export default router;
