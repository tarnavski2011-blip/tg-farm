"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../prisma");
const router = (0, express_1.Router)();
const rewards = [
    { type: "coins", amount: 100, label: "100 coins", weight: 40 },
    { type: "coins", amount: 300, label: "300 coins", weight: 25 },
    { type: "coins", amount: 1000, label: "1000 coins", weight: 10 },
    { type: "diamonds", amount: 2, label: "2 diamonds", weight: 15 },
    { type: "diamonds", amount: 5, label: "5 diamonds", weight: 5 },
    { type: "boost", minutes: 30, label: "x2 boost 30m", weight: 5 },
];
function pickReward() {
    const total = rewards.reduce((sum, r) => sum + r.weight, 0);
    let rnd = Math.random() * total;
    for (const r of rewards) {
        rnd -= r.weight;
        if (rnd <= 0) {
            return r;
        }
    }
    return rewards[0];
}
function getCooldown(lastSpinAt) {
    if (!lastSpinAt) {
        return 0;
    }
    const left = lastSpinAt.getTime() + 60 * 60 * 1000 - Date.now();
    return left > 0 ? Math.ceil(left / 1000) : 0;
}
router.get("/state", async (req, res) => {
    if (!req.telegramUser!.id) {
        return res.status(401).json({ error: "Unauthorized" });
    }
    const telegramId = BigInt(req.telegramUser!.id);
    const user = await prisma_1.prisma.user.findUnique({
        where: { telegramId },
        select: {
            diamonds: true,
            lastWheelSpinAt: true,
        },
    });
    if (!user) {
        return res.status(404).json({ error: "User not found" });
    }
    return res.json({
        diamonds: user.diamonds,
        cooldown: getCooldown(user.lastWheelSpinAt),
        rewards: rewards.map((r) => r.label),
    });
});
router.post("/spin", async (req, res) => {
    if (!req.telegramUser!.id) {
        return res.status(401).json({ error: "Unauthorized" });
    }
    const telegramId = BigInt(req.telegramUser!.id);
    const user = await prisma_1.prisma.user.findUnique({
        where: { telegramId },
        select: {
            id: true,
            diamonds: true,
            boostUntil: true,
            lastWheelSpinAt: true,
        },
    });
    if (!user) {
        return res.status(404).json({ error: "User not found" });
    }
    const cooldown = getCooldown(user.lastWheelSpinAt);
    if (cooldown > 0) {
        return res.status(400).json({ error: "Wait " + cooldown + "s" });
    }
    if (user.diamonds < 3) {
        return res.status(400).json({ error: "Not enough diamonds" });
    }
    const reward = pickReward();
    const now = new Date();
    await prisma_1.prisma.user.update({
        where: { id: user.id },
        data: {
            diamonds: { decrement: 3 },
            lastWheelSpinAt: now,
        },
    });
    if (reward.type === "coins") {
        await prisma_1.prisma.user.update({
            where: { id: user.id },
            data: {
                coins: { increment: reward.amount },
            },
        });
    }
    else if (reward.type === "diamonds") {
        await prisma_1.prisma.user.update({
            where: { id: user.id },
            data: {
                diamonds: { increment: reward.amount },
            },
        });
    }
    else if (reward.type === "boost") {
        const base = user.boostUntil && user.boostUntil > now ? user.boostUntil : now;
        await prisma_1.prisma.user.update({
            where: { id: user.id },
            data: {
                boostUntil: new Date(base.getTime() + reward.minutes * 60 * 1000),
            },
        });
    }
    return res.json({
        ok: true,
        reward: reward.label,
    });
});
exports.default = router;
//# sourceMappingURL=wheel.js.map