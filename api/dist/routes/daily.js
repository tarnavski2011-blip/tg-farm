"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../prisma");
const router = (0, express_1.Router)();
router.post("/", async (req, res) => {
    try {
        const telegramId = BigInt(req.telegramUser.id);
        const user = await prisma_1.prisma.user.findUnique({
            where: { telegramId },
        });
        if (!user)
            return res.status(404).json({ error: "User not found" });
        const now = new Date();
        const last = user.lastDailyAt;
        const sameDay = last && last.toDateString() === now.toDateString();
        if (sameDay) {
            return res.status(400).json({ error: "Already claimed" });
        }
        const streak = user.dailyStreak + 1;
        const reward = 100 + streak * 20;
        const updated = await prisma_1.prisma.user.update({
            where: { telegramId },
            data: {
                coins: { increment: reward },
                lastDailyAt: now,
                dailyStreak: streak,
            },
        });
        return res.json({
            ok: true,
            reward,
            streak: updated.dailyStreak,
        });
    }
    catch (e) {
        return res.status(500).json({ error: "daily error" });
    }
});
exports.default = router;
