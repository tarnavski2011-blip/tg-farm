"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../prisma");
const router = (0, express_1.Router)();
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
function getDayDiff(a, b) {
    const aStart = new Date(Date.UTC(a.getUTCFullYear(), a.getUTCMonth(), a.getUTCDate())).getTime();
    const bStart = new Date(Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate())).getTime();
    return Math.floor((aStart - bStart) / DAY_MS);
}
function getRewardForDay(day) {
    return DAILY_REWARDS[day - 1] ?? DAILY_REWARDS[0];
}
router.get("/", async (req, res) => {
    try {
        const telegramId = BigInt(req.telegramUser.id);
        const user = await prisma_1.prisma.user.findUnique({
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
            }
            else if (diff > 1) {
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
    }
    catch (e) {
        console.error("DAILY GET ERROR:", e);
        return res.status(500).json({ error: "Server error" });
    }
});
router.post("/", async (req, res) => {
    try {
        const telegramId = BigInt(req.telegramUser.id);
        const user = await prisma_1.prisma.user.findUnique({
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
        // Compare-and-set: only one request per user can claim on this UTC day.
        const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
        const claimed = await prisma_1.prisma.user.updateMany({
            where: { id: user.id, OR: [{ lastDailyAt: null }, { lastDailyAt: { lt: dayStart } }] },
            data: {
                coins: { increment: reward.coins },
                diamonds: { increment: reward.diamonds },
                dailyStreak: nextStreak,
                lastDailyAt: now,
            },
        });
        if (claimed.count !== 1)
            return res.status(400).json({ error: "Вже забрано сьогодні" });
        return res.json({
            ok: true,
            day: nextDay,
            reward,
            nextStreak,
        });
    }
    catch (e) {
        console.error("DAILY POST ERROR:", e);
        return res.status(500).json({ error: "Server error" });
    }
});
exports.default = router;
