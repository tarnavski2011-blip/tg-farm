import { Router } from "express";
import { prisma } from "../prisma";
import type { TgAuthedRequest } from "../middleware/telegramAuth";
import { ECONOMY } from "../config/economy";
import { antiSpamPerUser } from "../middleware/antiSpam";
import { requestLockByUser } from "../middleware/requestLock";

const router = Router();

type DailyReward = {
  day: number;
  coins: number;
  diamonds: number;
  freeWheelSpin: boolean;
};

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function isYesterday(a: Date, b: Date) {
  const y = new Date(b);
  y.setDate(y.getDate() - 1);
  return isSameDay(a, y);
}

function getRewardForDay(day: number): DailyReward {
  const reward = ECONOMY.dailyLogin[day - 1];

  if (reward) {
    return {
      day: reward.day,
      coins: reward.coins,
      diamonds: reward.diamonds,
      freeWheelSpin: reward.freeWheelSpin,
    };
  }

  const fallback = ECONOMY.dailyLogin[0]!;

  return {
    day: fallback.day,
    coins: fallback.coins,
    diamonds: fallback.diamonds,
    freeWheelSpin: fallback.freeWheelSpin,
  };
}

router.get("/status", async (req: TgAuthedRequest, res) => {
  if (!req.telegramUser!.id) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const telegramId = BigInt(req.telegramUser!.id);

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

  const nextDay = canClaim
    ? Math.min(Math.max(streak + 1, 1), 7)
    : Math.min(Math.max(streak, 1), 7);

  const reward = getRewardForDay(nextDay);

  return res.json({
    streak,
    nextDay,
    canClaim,
    reward,
  });
});

router.post(
  "/claim",
  antiSpamPerUser(3000, 2),
  requestLockByUser(2000),
  async (req: TgAuthedRequest, res) => {
    if (!req.telegramUser!.id) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const telegramId = BigInt(req.telegramUser!.id);

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

    const data: {
      coins: { increment: number };
      diamonds: { increment: number };
      dailyStreak: number;
      lastDailyAt: Date;
      lastWheelSpinAt?: null;
    } = {
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
      reward,
      user: updated,
    });
  },
);

export default router;
