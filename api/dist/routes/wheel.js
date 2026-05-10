"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../prisma");
const router = (0, express_1.Router)();
function isSameDay(a, b) {
    if (!a || !b)
        return false;
    return a.toDateString() === b.toDateString();
}
const REWARDS = [
    { type: "coins", amount: 50, label: "50 coins" },
    { type: "coins", amount: 100, label: "100 coins" },
    { type: "coins", amount: 200, label: "200 coins" },
    { type: "diamonds", amount: 1, label: "1 diamond" },
    { type: "diamonds", amount: 3, label: "3 diamonds" },
    { type: "diamonds", amount: 5, label: "5 diamonds" },
    { type: "freeSpin", amount: 1, label: "Free spin" },
    { type: "nothing", amount: 0, label: "Nothing" },
];
function getRandomReward() {
    const index = Math.floor(Math.random() * REWARDS.length);
    return REWARDS[index];
}
router.get("/state", async (req, res) => {
    try {
        if (!req.telegramUser?.id) {
            return res.status(401).json({ error: "Unauthorized" });
        }
        const telegramId = BigInt(req.telegramUser.id);
        const user = await prisma_1.prisma.user.findUnique({
            where: { telegramId },
            select: {
                lastWheelSpinAt: true,
            },
        });
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }
        const now = new Date();
        let cooldownSec = 0;
        if (user.lastWheelSpinAt && isSameDay(user.lastWheelSpinAt, now)) {
            const tomorrow = new Date(now);
            tomorrow.setHours(24, 0, 0, 0);
            cooldownSec = Math.max(0, Math.floor((tomorrow.getTime() - now.getTime()) / 1000));
        }
        return res.json({
            ok: true,
            rewards: REWARDS,
            cooldownSec,
            canSpin: cooldownSec <= 0,
        });
    }
    catch (e) {
        console.error("WHEEL STATE ERROR:", e);
        return res.status(500).json({ error: "Server error" });
    }
});
router.post("/spin", async (req, res) => {
    try {
        if (!req.telegramUser?.id) {
            return res.status(401).json({ error: "Unauthorized" });
        }
        const telegramId = BigInt(req.telegramUser.id);
        const now = new Date();
        const user = await prisma_1.prisma.user.findUnique({
            where: { telegramId },
            select: {
                id: true,
                coins: true,
                diamonds: true,
                lastWheelSpinAt: true,
            },
        });
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }
        if (isSameDay(user.lastWheelSpinAt, now)) {
            return res.status(400).json({
                error: "Already spun today",
            });
        }
        const reward = getRandomReward();
        const updateData = {
            lastWheelSpinAt: now,
        };
        if (reward.type === "coins") {
            updateData.coins = { increment: reward.amount };
        }
        if (reward.type === "diamonds") {
            updateData.diamonds = { increment: reward.amount };
        }
        const updated = await prisma_1.prisma.user.update({
            where: { telegramId },
            data: updateData,
            select: {
                coins: true,
                diamonds: true,
                lastWheelSpinAt: true,
            },
        });
        return res.json({
            ok: true,
            reward, // важливо: весь об'єкт, не label
            coins: updated.coins,
            diamonds: updated.diamonds,
            cooldownSec: Math.max(0, Math.floor((new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime() -
                now.getTime()) /
                1000)),
        });
    }
    catch (e) {
        console.error("WHEEL SPIN ERROR:", e);
        return res.status(500).json({ error: "Server error" });
    }
});
exports.default = router;
