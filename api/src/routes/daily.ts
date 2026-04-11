import { Router } from "express";
import { prisma } from "../prisma";
import type { TgAuthedRequest } from "../middleware/telegramAuth";

const router = Router();

const DAILY_REWARDS = [
  { day: 1, coins: 50, diamonds: 0, freeWheelSpin: false },
  { day: 2, coins: 100, diamonds: 0, freeWheelSpin: false },
  { day: 3, coins: 150, diamonds: 0, freeWheelSpin: false },
  { day: 4, coins: 0, diamonds: 1, freeWheelSpin: false },
  { day: 5, coins: 200, diamonds: 0, freeWheelSpin: false },
  { day: 6, coins: 0, diamonds: 2, freeWheelSpin: false },
  { day: 7, coins: 300, diamonds: 3, freeWheelSpin: true },
];

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function dayDiff(a: Date, b: Date) {
  const ms = startOfDay(a).getTime() - startOfDay(b).getTime();
  return Math.floor(ms / (24 * 60 * 60 * 1000));
}

function getDailyStatus(user: {
  dailyStreak: number | null;
  lastDailyAt: Date | null;
}) {
  const now = new Date();
  const streak = Number(user.dailyStreak ?? 0);
  const lastDailyAt = user.lastDailyAt;

  if (!lastDailyAt) {
    return {
      streak: 0,
      claimedToday: false,
      canClaim: true,
      nextDay: 1,
      reward: DAILY_REWARDS[0],
    };
  }

  const diff = dayDiff(now, lastDailyAt);

  if (diff <= 0) {
    const safeStreak = Math.max(1, Math.min(streak || 1, 7));
    const nextDay = safeStreak >= 7 ? 1 : safeStreak + 1;

    return {
      streak: safeStreak,
      claimedToday: true,
      canClaim: false,
      nextDay,
      reward: DAILY_REWARDS[nextDay - 1],
    };
  }

  if (diff === 1) {
    const nextDay = streak >= 7 ? 1 : Math.max(1, streak + 1);

    return {
      streak: Math.max(0, streak),
      claimedToday: false,
      canClaim: true,
      nextDay,
      reward: DAILY_REWARDS[nextDay - 1],
    };
  }

  return {
    streak: 0,
    claimedToday: false,
    canClaim: true,
    nextDay: 1,
    reward: DAILY_REWARDS[0],
  };
}

// STATUS
router.get("/status", async (req: TgAuthedRequest, res) => {
  try {
    if (!req.telegramUser?.id) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const telegramId = BigInt(req.telegramUser.id);

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

    const status = getDailyStatus(user);

    return res.json({
      ok: true,
      streak: status.streak,
      claimedToday: status.claimedToday,
      canClaim: status.canClaim,
      nextDay: status.nextDay,
      reward: status.reward,
      rewards: DAILY_REWARDS,
    });
  } catch (e) {
    console.error("DAILY STATUS ERROR:", e);
    return res.status(500).json({ error: "Server error" });
  }
});

// CLAIM
router.post("/claim", async (req: TgAuthedRequest, res) => {
  try {
    if (!req.telegramUser?.id) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const telegramId = BigInt(req.telegramUser.id);

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

    const status = getDailyStatus(user);

    if (!status.canClaim) {
      return res.status(400).json({ error: "Daily already claimed today" });
    }

    const reward = status.reward;
    const newStreak = status.nextDay;
    const now = new Date();

    await prisma.user.update({
      where: { id: user.id },
      data: {
        coins: { increment: reward.coins },
        diamonds: { increment: reward.diamonds },
        dailyStreak: newStreak,
        lastDailyAt: now,
      },
    });

    return res.json({
      ok: true,
      day: newStreak,
      streak: newStreak,
      reward,
      claimedToday: true,
      nextDay: newStreak >= 7 ? 1 : newStreak + 1,
    });
  } catch (e) {
    console.error("DAILY CLAIM ERROR:", e);
    return res.status(500).json({ error: "Server error" });
  }
});

// LEGACY ENDPOINT
router.post("/", async (req: TgAuthedRequest, res) => {
  try {
    if (!req.telegramUser?.id) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const telegramId = BigInt(req.telegramUser.id);

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

    const status = getDailyStatus(user);

    if (!status.canClaim) {
      return res.status(400).json({ error: "Daily already claimed today" });
    }

    const reward = status.reward;
    const newStreak = status.nextDay;
    const now = new Date();

    await prisma.user.update({
      where: { id: user.id },
      data: {
        coins: { increment: reward.coins },
        diamonds: { increment: reward.diamonds },
        dailyStreak: newStreak,
        lastDailyAt: now,
      },
    });

    return res.json({
      ok: true,
      reward: reward.coins + reward.diamonds,
      rewardData: reward,
      day: newStreak,
      streak: newStreak,
    });
  } catch (e) {
    console.error("DAILY LEGACY ERROR:", e);
    return res.status(500).json({ error: "Server error" });
  }
});

export default router;
