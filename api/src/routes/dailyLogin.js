"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../prisma");
const economy_1 = require("../config/economy");
const antiSpam_1 = require("../middleware/antiSpam");
const requestLock_1 = require("../middleware/requestLock");
const router = (0, express_1.Router)();
function isSameDay(a, b) {
    return (a.getFullYear() === b.getFullYear() &&
        a.getMonth() === b.getMonth() &&
        a.getDate() === b.getDate());
}
function isYesterday(a, b) {
    const y = new Date(b);
    y.setDate(y.getDate() - 1);
    return isSameDay(a, y);
}
function getRewardForDay(day) {
    const reward = economy_1.ECONOMY.dailyLogin[day - 1];
    if (reward) {
        return {
            day: reward.day,
            coins: reward.coins,
            diamonds: reward.diamonds,
            freeWheelSpin: reward.freeWheelSpin,
        };
    }
    const fallback = economy_1.ECONOMY.dailyLogin[0];
    return {
        day: fallback.day,
        coins: fallback.coins,
        diamonds: fallback.diamonds,
        freeWheelSpin: fallback.freeWheelSpin,
    };
}
router.get("/status", async (req, res) => {
    if (!req.telegramUser!.id) {
        return res.status(401).json({ error: "Unauthorized" });
    }
    const telegramId = BigInt(req.telegramUser!.id);
    const user = await prisma_1.prisma.user.findUnique({
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
router.post("/claim", (0, antiSpam_1.antiSpamPerUser)(3000, 2), (0, requestLock_1.requestLockByUser)(2000), async (req, res) => {
    if (!req.telegramUser!.id) {
        return res.status(401).json({ error: "Unauthorized" });
    }
    const telegramId = BigInt(req.telegramUser!.id);
    const user = await prisma_1.prisma.user.findUnique({
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
    const data = {
        coins: { increment: reward.coins },
        diamonds: { increment: reward.diamonds },
        dailyStreak: newStreak,
        lastDailyAt: now,
    };
    if (reward.freeWheelSpin) {
        data.lastWheelSpinAt = null;
    }
    const updated = await prisma_1.prisma.user.update({
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
});
exports.default = router;
//# sourceMappingURL=dailyLogin.js.map