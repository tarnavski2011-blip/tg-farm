"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../prisma");
const questProgress_1 = require("../lib/questProgress");
const levelSystem_1 = require("../lib/levelSystem");
const router = (0, express_1.Router)();
router.post("/", async (req, res) => {
    try {
        const telegramId = BigInt(req.telegramUser.id);
        const user = await prisma_1.prisma.user.findUnique({
            where: { telegramId },
        });
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }
        const coinsAdded = 1;
        const xpAdded = 0;
        const levelResult = (0, levelSystem_1.calculateLevelProgress)(user.level ?? 1, user.xp ?? 0, xpAdded);
        await prisma_1.prisma.user.update({
            where: { id: user.id },
            data: {
                coins: { increment: coinsAdded + levelResult.rewardCoins },
                diamonds: { increment: levelResult.rewardDiamonds },
                xp: levelResult.xp,
                level: levelResult.level,
            },
        });
        await (0, questProgress_1.addTapToday)(user.id, 1);
        const referral = await prisma_1.prisma.referral.findFirst({
            where: { referredId: user.id },
        });
        if (referral) {
            const bonusCoins = Math.floor(coinsAdded * 0.05);
            if (bonusCoins > 0) {
                await prisma_1.prisma.user.update({
                    where: { id: referral.referrerId },
                    data: {
                        coins: { increment: bonusCoins },
                    },
                });
            }
        }
        return res.json({
            ok: true,
            coinsAdded,
            xpAdded,
            level: levelResult.level,
            xp: levelResult.xp,
            levelUpData: {
                leveledUp: levelResult.leveledUp,
                level: levelResult.lastReachedLevel,
                rewardCoins: levelResult.rewardCoins,
                rewardDiamonds: levelResult.rewardDiamonds,
                reachedLevels: levelResult.reachedLevels,
            },
            reward: {
                coins: levelResult.rewardCoins,
                diamonds: levelResult.rewardDiamonds,
            },
        });
    }
    catch (e) {
        console.error("COLLECT ERROR:", e);
        return res.status(500).json({ error: "Server error" });
    }
});
exports.default = router;
