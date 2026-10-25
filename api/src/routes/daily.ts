import { recordQuestMetric } from "../lib/questMetrics";
import { Router } from "express";
import { prisma } from "../prisma";
import type { TgAuthedRequest } from "../middleware/telegramAuth";

const router = Router();
const DAY_MS = 86400000;
const rewards = Array.from({ length: 30 }, (_, i) => {
  const day = i + 1;
  return {
    day,
    coins: day % 5 === 0 || [7, 14, 21, 30].includes(day) ? 0 : 100 + i * 25,
    points:
      (
        { 5: 100, 10: 200, 15: 300, 20: 500, 25: 750 } as Record<number, number>
      )[day] || 0,
    diamonds: ({ 7: 2, 14: 3, 21: 5 } as Record<number, number>)[day] || 0,
    vipHours: day === 30 ? 24 : 0,
  };
});
function dayDiff(now: Date, last: Date) {
  const utcDay = (d: Date) =>
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  return Math.floor((utcDay(now) - utcDay(last)) / DAY_MS);
}
function status(
  user: { dailyStreak: number; lastDailyAt: Date | null },
  now: Date,
) {
  const diff = user.lastDailyAt ? dayDiff(now, user.lastDailyAt) : null;
  const claimed = diff === 0;
  const streak = diff !== null && diff >= 3 ? 0 : user.dailyStreak;
  const day = claimed ? user.dailyStreak || 1 : streak >= 30 ? 1 : streak + 1;
  return {
    claimed,
    streak,
    day,
    missedDays: diff === null ? 0 : Math.max(0, diff - 1),
  };
}
router.get("/", async (req: TgAuthedRequest, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { telegramId: BigInt(req.telegramUser!.id) },
      select: { dailyStreak: true, lastDailyAt: true },
    });
    if (!user) return res.status(404).json({ error: "User not found" });
    const s = status(user, new Date());
    return res.json({
      ok: true,
      ...s,
      rewards,
      todayReward: rewards[s.day - 1],
    });
  } catch (e) {
    console.error("DAILY GET ERROR", e);
    return res.status(500).json({ error: "Server error" });
  }
});
router.post("/", async (req: TgAuthedRequest, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { telegramId: BigInt(req.telegramUser!.id) },
      select: {
        id: true,
        dailyStreak: true,
        lastDailyAt: true,
        vipUntil: true,
      },
    });
    if (!user) return res.status(404).json({ error: "User not found" });
    const now = new Date();
    const s = status(user, now);
    if (s.claimed)
      return res.status(400).json({ error: "Вже забрано сьогодні" });
    const reward = rewards[s.day - 1];
    const dayStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );
    const vipBase = user.vipUntil && user.vipUntil > now ? user.vipUntil : now;
    const result = await prisma.user.updateMany({
      where: {
        id: user.id,
        OR: [{ lastDailyAt: null }, { lastDailyAt: { lt: dayStart } }],
      },
      data: {
        coins: { increment: reward.coins },
        points: { increment: reward.points },
        diamonds: { increment: reward.diamonds },
        ...(reward.vipHours
          ? {
              vipUntil: new Date(vipBase.getTime() + reward.vipHours * 3600000),
            }
          : {}),
        dailyStreak: s.day,
        lastDailyAt: now,
      },
    });
    if (result.count !== 1)
      return res.status(400).json({ error: "Вже забрано сьогодні" });
    await recordQuestMetric(user.id,"daily_rewards",1).catch(console.error);
    return res.json({
      ok: true,
      day: s.day,
      reward,
      nextStreak: s.day === 30 ? 0 : s.day,
    });
  } catch (e) {
    console.error("DAILY POST ERROR", e);
    return res.status(500).json({ error: "Server error" });
  }
});
export default router;
