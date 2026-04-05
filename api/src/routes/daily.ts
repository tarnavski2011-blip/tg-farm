import { Router } from "express";
import { prisma } from "../prisma";
import type { TgAuthedRequest } from "../middleware/telegramAuth";
import { antiSpamPerUser } from "../middleware/antiSpam";
import { requestLockByUser } from "../middleware/requestLock";

const router = Router();

const DAILY_REWARDS = [
  { day: 1, coins: 100, diamonds: 0, freeWheelSpin: false },
  { day: 2, coins: 150, diamonds: 0, freeWheelSpin: false },
  { day: 3, coins: 200, diamonds: 1, freeWheelSpin: false },
  { day: 4, coins: 300, diamonds: 1, freeWheelSpin: false },
  { day: 5, coins: 400, diamonds: 2, freeWheelSpin: false },
  { day: 6, coins: 500, diamonds: 2, freeWheelSpin: false },
  { day: 7, coins: 700, diamonds: 5, freeWheelSpin: true },
];

function isSameDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function isYesterday(a, b) {
  const y = new Date(b);
  y.setDate(y.getDate() - 1);
  return isSameDay(a, y);
}

function getRewardForDay(day) {
  const safeDay = Math.min(Math.max(day, 1), 7);
  return DAILY_REWARDS[safeDay - 1];
}

router.get("/status", async (req: TgAuthedRequest, res) => {
  try {
    if (!req.telegramUser?.id) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const telegramId = BigInt(req.telegramUser.id);

    const user = await prisma.user.findUnique({
      where: { telegramId },
      select: {
        dailyStreak: true,
        lastDailyAt: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const now = new Date();
    const streak = user.dailyStreak ?? 0;

    let canClaim = true;
    if (user.lastDailyAt && isSameDay(user.lastDailyAt, now)) {
      canClaim = false;
    }

    let nextDay = 1;

    if (!user.lastDailyAt) {
      nextDay = 1;
    } else if (canClaim && isYesterday(user.lastDailyAt, now)) {
      nextDay = Math.min(streak + 1, 7);
    } else if (canClaim) {
      nextDay = 1;
    } else {
      nextDay = Math.min(Math.max(streak, 1), 7);
    }

    const reward = getRewardForDay(nextDay);

    return res.json({
      ok: true,
      streak,
      nextDay,
      canClaim,
      reward,
      rewards: DAILY_REWARDS,
    });
  } catch (e) {
    console.error("DAILY STATUS ERROR:", e);
    return res.status(500).json({ error: "Server error" });
  }
});

router.post(
  "/claim",
  antiSpamPerUser(3000, 2),
  requestLockByUser(2000),
  async (req: TgAuthedRequest, res) => {
    try {
      if (!req.telegramUser?.id) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const telegramId = BigInt(req.telegramUser.id);

      const user = await prisma.user.findUnique({
        where: { telegramId },
        select: {
          id: true,
          coins: true,
          diamonds: true,
          dailyStreak: true,
          lastDailyAt: true,
          lastWheelSpinAt: true,
        },
      });

      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const now = new Date();

      if (user.lastDailyAt && isSameDay(user.lastDailyAt, now)) {
        return res.status(400).json({ error: "Already claimed today" });
      }

      let newStreak = 1;

      if (user.lastDailyAt && isYesterday(user.lastDailyAt, now)) {
        newStreak = Math.min((user.dailyStreak ?? 0) + 1, 7);
      }

      const reward = getRewardForDay(newStreak);

      const data: any = {
        coins: { increment: reward.coins },
        diamonds: { increment: reward.diamonds },
        dailyStreak: newStreak,
        lastDailyAt: now,
      };

      if (reward.freeWheelSpin) {
        data.lastWheelSpinAt = null;
      }

      const updated = await prisma.user.update({
        where: { id: user.id },
        data,
        select: {
          coins: true,
          diamonds: true,
          dailyStreak: true,
          lastDailyAt: true,
          lastWheelSpinAt: true,
        },
      });

      return res.json({
        ok: true,
        streak: updated.dailyStreak,
        day: newStreak,
        reward,
        rewards: DAILY_REWARDS,
        user: updated,
      });
    } catch (e) {
      console.error("DAILY CLAIM ERROR:", e);
      return res.status(500).json({ error: "Server error" });
    }
  },
);

export default router;
