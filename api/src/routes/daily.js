"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../prisma");
const router = (0, express_1.Router)();
const DAY_MS = 24 * 60 * 60 * 1000;
function calcReward(streak) {
    return 200 + 50 * streak;
}
router.post("/claim", async (req, res) => {
    if (!req.telegramUser!.id)
        return res.status(401).json({ error: "Unauthorized" });
    const telegramId = BigInt(req.telegramUser!.id);
    const user = await prisma_1.prisma.user.upsert({
        where: { telegramId },
        update: {},
        create: { telegramId },
    });
    const now = Date.now();
    const last = user.lastDailyAt ? user.lastDailyAt.getTime() : 0;
    if (last && now - last < DAY_MS) {
        const nextInSec = Math.ceil((DAY_MS - (now - last)) / 1000);
        return res.status(400).json({ error: "Too early", nextInSec });
    }
    const missedTooMuch = last && now - last > 2 * DAY_MS;
    const newStreak = missedTooMuch ? 1 : Math.min(7, (user.dailyStreak || 0) + 1);
    const rewardCoins = calcReward(newStreak);
    const updated = await prisma_1.prisma.user.update({
        where: { telegramId },
        data: {
            dailyStreak: newStreak,
            lastDailyAt: new Date(now),
            coins: { increment: rewardCoins },
        },
    });
    return res.json({
        ok: true,
        dailyStreak: updated.dailyStreak,
        rewardCoins,
        coins: updated.coins,
        lastDailyAt: updated.lastDailyAt,
    });
});
exports.default = router;
//# sourceMappingURL=daily.js.map