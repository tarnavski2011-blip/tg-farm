"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../prisma");
const economy_1 = require("../config/economy");
const router = (0, express_1.Router)();
router.post("/", async (req, res) => {
    if (!req.tgUserId)
        return res.status(401).json({ error: "Unauthorized" });
    const telegramId = BigInt(req.tgUserId);
    const user = await prisma_1.prisma.user.findUnique({
        where: { telegramId },
        select: { id: true, coins: true, feedUntil: true },
    });
    if (!user)
        return res.status(404).json({ error: "User not found" });
    if (user.coins < economy_1.ECONOMY.feed.priceCoins)
        return res.status(400).json({ error: "Not enough coins" });
    const now = new Date();
    const base = user.feedUntil && user.feedUntil > now ? user.feedUntil : now;
    const nextFeedUntil = new Date(base.getTime() + economy_1.ECONOMY.feed.durationMinutes * 60 * 1000);
    const updated = await prisma_1.prisma.user.update({
        where: { id: user.id },
        data: {
            coins: { decrement: economy_1.ECONOMY.feed.priceCoins },
            feedUntil: nextFeedUntil,
            feedActivatedAt: now,
            xp: { increment: 2 },
        },
        select: { coins: true, feedUntil: true },
    });
    return res.json({
        ok: true,
        coins: updated.coins,
        feedUntil: updated.feedUntil,
        durationMinutes: economy_1.ECONOMY.feed.durationMinutes,
    });
});
exports.default = router;
