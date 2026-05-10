"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../prisma");
const client_1 = require("@prisma/client");
const questProgress_1 = require("../lib/questProgress");
const router = (0, express_1.Router)();
function getTodayKey() {
    return new Date().toISOString().slice(0, 10);
}
router.get("/", async (req, res) => {
    try {
        const telegramId = BigInt(req.telegramUser.id);
        const user = await prisma_1.prisma.user.findUnique({
            where: { telegramId },
            include: {
                animals: true,
                achievementClaims: true,
                dailyQuestClaims: true,
            },
        });
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }
        await (0, questProgress_1.resetDailyQuestProgressIfNeeded)(user.id, user.lastSeenAt);
        const freshUser = await prisma_1.prisma.user.findUnique({
            where: { id: user.id },
            include: {
                animals: true,
                achievementClaims: true,
                dailyQuestClaims: true,
            },
        });
        if (!freshUser) {
            return res.status(404).json({ error: "User not found" });
        }
        const today = getTodayKey();
        const chickenCount = freshUser.animals.filter((a) => a.type === client_1.AnimalType.CHICKEN).length;
        const sheepCount = freshUser.animals.filter((a) => a.type === client_1.AnimalType.SHEEP).length;
        const cowCount = freshUser.animals.filter((a) => a.type === client_1.AnimalType.COW).length;
        const maxLevel = freshUser.animals.length
            ? Math.max(...freshUser.animals.map((a) => a.level))
            : 1;
        const referralCount = await prisma_1.prisma.referral.count({
            where: { referrerId: freshUser.id },
        });
        const dailyClaimed = freshUser.dailyQuestClaims
            .filter((q) => q.claimDate === today)
            .map((q) => q.code);
        const achievementClaimed = freshUser.achievementClaims
            .filter((q) => q.claimed)
            .map((q) => q.code);
        const quests = [
            {
                code: "tap_20",
                title: "Зроби 20 тапів",
                group: "daily",
                reward: "50 coins",
                progress: freshUser.tapsToday,
                target: 20,
                done: freshUser.tapsToday >= 20,
                claimed: dailyClaimed.includes("tap_20"),
            },
            {
                code: "sell_once",
                title: "Продай ресурси",
                group: "daily",
                reward: "75 coins",
                progress: freshUser.sellsToday,
                target: 1,
                done: freshUser.sellsToday >= 1,
                claimed: dailyClaimed.includes("sell_once"),
            },
            {
                code: "buy_feed",
                title: "Купи корм",
                group: "daily",
                reward: "50 coins",
                progress: freshUser.feedBuysToday,
                target: 1,
                done: freshUser.feedBuysToday >= 1,
                claimed: dailyClaimed.includes("buy_feed"),
            },
            {
                code: "buy_chicken",
                title: "Купи курку",
                group: "progress",
                reward: "100 coins",
                done: chickenCount >= 1,
                claimed: achievementClaimed.includes("buy_chicken"),
            },
            {
                code: "buy_sheep",
                title: "Купи вівцю",
                group: "progress",
                reward: "150 coins",
                done: sheepCount >= 1,
                claimed: achievementClaimed.includes("buy_sheep"),
            },
            {
                code: "buy_cow",
                title: "Купи корову",
                group: "progress",
                reward: "250 coins",
                done: cowCount >= 1,
                claimed: achievementClaimed.includes("buy_cow"),
            },
            {
                code: "upgrade",
                title: "Прокачай тварину",
                group: "achievement",
                reward: "200 coins",
                done: maxLevel > 1,
                claimed: achievementClaimed.includes("upgrade"),
            },
            {
                code: "rich_1000",
                title: "Накопич 1000 монет",
                group: "achievement",
                reward: "300 coins",
                done: freshUser.coins >= 1000,
                claimed: achievementClaimed.includes("rich_1000"),
            },
            {
                code: "warehouse_lvl2",
                title: "Покращ склад до LVL 2",
                group: "achievement",
                reward: "250 coins",
                done: (freshUser.warehouseLevel ?? 1) >= 2,
                claimed: achievementClaimed.includes("warehouse_lvl2"),
            },
            {
                code: "invite_1",
                title: "Запроси 1 друга",
                group: "achievement",
                reward: "1 💎",
                done: referralCount >= 1,
                claimed: achievementClaimed.includes("invite_1"),
            },
            {
                code: "invite_3",
                title: "Запроси 3 друзів",
                group: "achievement",
                reward: "3 💎",
                done: referralCount >= 3,
                claimed: achievementClaimed.includes("invite_3"),
            },
            {
                code: "invite_5",
                title: "Запроси 5 друзів",
                group: "achievement",
                reward: "5 💎",
                done: referralCount >= 5,
                claimed: achievementClaimed.includes("invite_5"),
            },
            {
                code: "lvl_5",
                title: "Досягни LVL 5",
                group: "achievement",
                reward: "5 💎",
                progress: freshUser.level,
                target: 5,
                done: freshUser.level >= 5,
                claimed: achievementClaimed.includes("lvl_5"),
            },
            {
                code: "lvl_10",
                title: "Досягни LVL 10",
                group: "achievement",
                reward: "15 💎",
                progress: freshUser.level,
                target: 10,
                done: freshUser.level >= 10,
                claimed: achievementClaimed.includes("lvl_10"),
            },
            {
                code: "lvl_20",
                title: "Досягни LVL 20",
                group: "achievement",
                reward: "50 💎",
                progress: freshUser.level,
                target: 20,
                done: freshUser.level >= 20,
                claimed: achievementClaimed.includes("lvl_20"),
            },
            {
                code: "lvl_50",
                title: "Досягни LVL 50",
                group: "achievement",
                reward: "200 💎",
                progress: freshUser.level,
                target: 50,
                done: freshUser.level >= 50,
                claimed: achievementClaimed.includes("lvl_50"),
            },
        ];
        return res.json({ ok: true, quests });
    }
    catch (e) {
        console.error("QUESTS ERROR:", e);
        return res.status(500).json({ error: "Server error" });
    }
});
router.post("/claim", async (req, res) => {
    try {
        const telegramId = BigInt(req.telegramUser.id);
        const { code } = req.body;
        if (!code) {
            return res.status(400).json({ error: "Quest code required" });
        }
        const user = await prisma_1.prisma.user.findUnique({
            where: { telegramId },
            include: {
                animals: true,
                achievementClaims: true,
                dailyQuestClaims: true,
            },
        });
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }
        await (0, questProgress_1.resetDailyQuestProgressIfNeeded)(user.id, user.lastSeenAt);
        const freshUser = await prisma_1.prisma.user.findUnique({
            where: { id: user.id },
            include: {
                animals: true,
                achievementClaims: true,
                dailyQuestClaims: true,
            },
        });
        if (!freshUser) {
            return res.status(404).json({ error: "User not found" });
        }
        const today = getTodayKey();
        const chickenCount = freshUser.animals.filter((a) => a.type === client_1.AnimalType.CHICKEN).length;
        const sheepCount = freshUser.animals.filter((a) => a.type === client_1.AnimalType.SHEEP).length;
        const cowCount = freshUser.animals.filter((a) => a.type === client_1.AnimalType.COW).length;
        const maxLevel = freshUser.animals.length
            ? Math.max(...freshUser.animals.map((a) => a.level))
            : 1;
        const referralCount = await prisma_1.prisma.referral.count({
            where: { referrerId: freshUser.id },
        });
        const rewardMap = {
            tap_20: {
                rewardCoins: 50,
                rewardDiamonds: 0,
                rewardText: "50 coins",
                done: freshUser.tapsToday >= 20,
                daily: true,
            },
            sell_once: {
                rewardCoins: 75,
                rewardDiamonds: 0,
                rewardText: "75 coins",
                done: freshUser.sellsToday >= 1,
                daily: true,
            },
            buy_feed: {
                rewardCoins: 50,
                rewardDiamonds: 0,
                rewardText: "50 coins",
                done: freshUser.feedBuysToday >= 1,
                daily: true,
            },
            buy_chicken: {
                rewardCoins: 100,
                rewardDiamonds: 0,
                rewardText: "100 coins",
                done: chickenCount >= 1,
                daily: false,
            },
            buy_sheep: {
                rewardCoins: 150,
                rewardDiamonds: 0,
                rewardText: "150 coins",
                done: sheepCount >= 1,
                daily: false,
            },
            buy_cow: {
                rewardCoins: 250,
                rewardDiamonds: 0,
                rewardText: "250 coins",
                done: cowCount >= 1,
                daily: false,
            },
            upgrade: {
                rewardCoins: 200,
                rewardDiamonds: 0,
                rewardText: "200 coins",
                done: maxLevel > 1,
                daily: false,
            },
            rich_1000: {
                rewardCoins: 300,
                rewardDiamonds: 0,
                rewardText: "300 coins",
                done: freshUser.coins >= 1000,
                daily: false,
            },
            warehouse_lvl2: {
                rewardCoins: 250,
                rewardDiamonds: 0,
                rewardText: "250 coins",
                done: (freshUser.warehouseLevel ?? 1) >= 2,
                daily: false,
            },
            invite_1: {
                rewardCoins: 0,
                rewardDiamonds: 1,
                rewardText: "1 💎",
                done: referralCount >= 1,
                daily: false,
            },
            invite_3: {
                rewardCoins: 0,
                rewardDiamonds: 3,
                rewardText: "3 💎",
                done: referralCount >= 3,
                daily: false,
            },
            invite_5: {
                rewardCoins: 0,
                rewardDiamonds: 5,
                rewardText: "5 💎",
                done: referralCount >= 5,
                daily: false,
            },
            lvl_5: {
                rewardCoins: 0,
                rewardDiamonds: 5,
                rewardText: "5 💎",
                done: freshUser.level >= 5,
                daily: false,
            },
            lvl_10: {
                rewardCoins: 0,
                rewardDiamonds: 15,
                rewardText: "15 💎",
                done: freshUser.level >= 10,
                daily: false,
            },
            lvl_20: {
                rewardCoins: 0,
                rewardDiamonds: 50,
                rewardText: "50 💎",
                done: freshUser.level >= 20,
                daily: false,
            },
            lvl_50: {
                rewardCoins: 0,
                rewardDiamonds: 200,
                rewardText: "200 💎",
                done: freshUser.level >= 50,
                daily: false,
            },
        };
        const quest = rewardMap[code];
        if (!quest) {
            return res.status(400).json({ error: "Invalid quest" });
        }
        if (!quest.done) {
            return res.status(400).json({ error: "Quest not completed" });
        }
        if (quest.daily) {
            const already = await prisma_1.prisma.dailyQuestClaim.findUnique({
                where: {
                    userId_code_claimDate: {
                        userId: freshUser.id,
                        code,
                        claimDate: today,
                    },
                },
            });
            if (already) {
                return res.status(400).json({ error: "Already claimed today" });
            }
            await prisma_1.prisma.$transaction([
                prisma_1.prisma.user.update({
                    where: { id: freshUser.id },
                    data: {
                        coins: { increment: quest.rewardCoins },
                        diamonds: { increment: quest.rewardDiamonds },
                    },
                }),
                prisma_1.prisma.dailyQuestClaim.create({
                    data: {
                        userId: freshUser.id,
                        code,
                        claimDate: today,
                    },
                }),
            ]);
        }
        else {
            const already = await prisma_1.prisma.achievementClaim.findUnique({
                where: {
                    userId_code: {
                        userId: freshUser.id,
                        code,
                    },
                },
            });
            if (already?.claimed) {
                return res.status(400).json({ error: "Already claimed" });
            }
            await prisma_1.prisma.$transaction([
                prisma_1.prisma.user.update({
                    where: { id: freshUser.id },
                    data: {
                        coins: { increment: quest.rewardCoins },
                        diamonds: { increment: quest.rewardDiamonds },
                    },
                }),
                prisma_1.prisma.achievementClaim.upsert({
                    where: {
                        userId_code: {
                            userId: freshUser.id,
                            code,
                        },
                    },
                    update: {
                        claimed: true,
                        claimedAt: new Date(),
                    },
                    create: {
                        userId: freshUser.id,
                        code,
                        claimed: true,
                        claimedAt: new Date(),
                    },
                }),
            ]);
        }
        return res.json({
            ok: true,
            reward: quest.rewardText,
            rewardCoins: quest.rewardCoins,
            rewardDiamonds: quest.rewardDiamonds,
        });
    }
    catch (e) {
        console.error("QUEST CLAIM ERROR:", e);
        return res.status(500).json({ error: "Server error" });
    }
});
exports.default = router;
