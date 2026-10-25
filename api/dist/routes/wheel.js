"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const questMetrics_1 = require("../lib/questMetrics");
const express_1 = require("express");
const prisma_1 = require("../prisma");
const router = (0, express_1.Router)();
function isSameDay(a, b) {
    if (!a || !b)
        return false;
    return a.toISOString().slice(0, 10) === b.toISOString().slice(0, 10);
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
                wheelBonusSpins: true,
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
            bonusSpins: user.wheelBonusSpins,
            rewards: REWARDS,
            cooldownSec,
            canSpin: cooldownSec <= 0 || user.wheelBonusSpins > 0,
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
                wheelBonusSpins: true,
            },
        });
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }
        const daily = !isSameDay(user.lastWheelSpinAt, now);
        if (!daily && user.wheelBonusSpins <= 0) {
            return res.status(400).json({ error: "Already spun today" });
        }
        const reward = getRandomReward();
        // Atomic compare-and-set avoids concurrent double claims across server instances.
        // A bonus spin cannot create another bonus spin (prevents unbounded free chains).
        const updated = await prisma_1.prisma.$transaction(async (tx) => {
            const claimed = daily
                ? await tx.user.updateMany({
                    where: { id: user.id, OR: [{ lastWheelSpinAt: null }, { lastWheelSpinAt: { lt: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())) } }] },
                    data: {
                        lastWheelSpinAt: now,
                        ...(reward.type === "coins" ? { coins: { increment: reward.amount } } : {}),
                        ...(reward.type === "diamonds" ? { diamonds: { increment: reward.amount } } : {}),
                        ...(reward.type === "freeSpin" ? { wheelBonusSpins: { increment: 1 } } : {}),
                    },
                })
                : await tx.user.updateMany({
                    where: { id: user.id, wheelBonusSpins: { gt: 0 } },
                    data: {
                        wheelBonusSpins: { decrement: 1 },
                        ...(reward.type === "coins" ? { coins: { increment: reward.amount } } : {}),
                        ...(reward.type === "diamonds" ? { diamonds: { increment: reward.amount } } : {}),
                    },
                });
            if (claimed.count !== 1)
                return null;
            return tx.user.findUniqueOrThrow({ where: { id: user.id }, select: { coins: true, diamonds: true, lastWheelSpinAt: true, wheelBonusSpins: true } });
        });
        if (!updated)
            return res.status(400).json({ error: "Spin already claimed" });
        await (0, questMetrics_1.recordQuestMetric)(user.id, "wheel_spins", 1).catch(console.error);
        return res.json({
            ok: true,
            reward, // full reward object
            bonusSpins: updated.wheelBonusSpins,
            coins: updated.coins,
            diamonds: updated.diamonds,
            cooldownSec: Math.max(0, Math.floor((new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)).getTime() -
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
