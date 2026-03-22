"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../prisma");
const economy_1 = require("../config/economy");
const antiSpam_1 = require("../middleware/antiSpam");
const requestLock_1 = require("../middleware/requestLock");
const router = (0, express_1.Router)();
function getTodayKey() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
}
const DAILY_QUESTS = [
    {
        code: "DAILY_COINS_1000",
        title: "Coin Collector",
        description: "Накопичити 1000 coins",
        target: 1000,
        rewardCoins: economy_1.ECONOMY.quests.coinRewardBig,
        rewardXp: economy_1.ECONOMY.quests.xpMed,
        getProgress: ({ user }) => user?.coins ?? 0,
    },
    {
        code: "DAILY_EGGS_20",
        title: "Egg Hunter",
        description: "Мати 20 яєць на складі",
        target: 20,
        rewardCoins: economy_1.ECONOMY.quests.coinRewardSmall,
        rewardXp: economy_1.ECONOMY.quests.xpSmall,
        getProgress: ({ storage }) => storage?.eggs ?? 0,
    },
    {
        code: "DAILY_CHICKEN_2",
        title: "Chicken Keeper",
        description: "Купити 2 курки",
        target: 2,
        rewardDiamonds: economy_1.ECONOMY.quests.diamondRewardMed,
        rewardXp: economy_1.ECONOMY.quests.xpMed,
        getProgress: ({ counts }) => counts.chicken,
    },
    {
        code: "DAILY_SHEEP_1",
        title: "Sheep Starter",
        description: "Купити 1 вівцю",
        target: 1,
        rewardCoins: economy_1.ECONOMY.quests.coinRewardMed,
        rewardXp: economy_1.ECONOMY.quests.xpMed,
        getProgress: ({ counts }) => counts.sheep,
    },
];
router.get("/", async (req, res) => {
    if (!req.tgUserId) {
        return res.status(401).json({ error: "Unauthorized" });
    }
    const telegramId = BigInt(req.tgUserId);
    const today = getTodayKey();
    const user = await prisma_1.prisma.user.findUnique({
        where: { telegramId },
        include: {
            animals: true,
            storage: true,
            dailyQuestClaims: {
                where: { claimDate: today },
            },
        },
    });
    if (!user) {
        return res.status(404).json({ error: "User not found" });
    }
    const counts = {
        chicken: user.animals.filter((a) => a.type === "CHICKEN").length,
        sheep: user.animals.filter((a) => a.type === "SHEEP").length,
        cow: user.animals.filter((a) => a.type === "COW").length,
    };
    const claimed = new Set(user.dailyQuestClaims.map((c) => c.code));
    const items = DAILY_QUESTS.map((q) => {
        const progress = q.getProgress({
            user,
            storage: user.storage,
            counts,
        });
        return {
            code: q.code,
            title: q.title,
            description: q.description,
            target: q.target,
            progress,
            completed: progress >= q.target,
            claimed: claimed.has(q.code),
            rewardCoins: q.rewardCoins ?? 0,
            rewardDiamonds: q.rewardDiamonds ?? 0,
            rewardXp: q.rewardXp ?? 0,
        };
    });
    return res.json({
        date: today,
        items,
    });
});
router.post("/claim", (0, antiSpam_1.antiSpamPerUser)(3000, 3), (0, requestLock_1.requestLockByUser)(2000), async (req, res) => {
    if (!req.tgUserId) {
        return res.status(401).json({ error: "Unauthorized" });
    }
    const telegramId = BigInt(req.tgUserId);
    const code = String(req.body?.code ?? "").trim();
    const today = getTodayKey();
    const quest = DAILY_QUESTS.find((q) => q.code === code);
    if (!quest) {
        return res.status(400).json({ error: "Unknown quest code" });
    }
    const user = await prisma_1.prisma.user.findUnique({
        where: { telegramId },
        include: {
            animals: true,
            storage: true,
            dailyQuestClaims: {
                where: { claimDate: today, code },
            },
        },
    });
    if (!user) {
        return res.status(404).json({ error: "User not found" });
    }
    if (user.dailyQuestClaims.length > 0) {
        return res.status(400).json({ error: "Quest already claimed today" });
    }
    const counts = {
        chicken: user.animals.filter((a) => a.type === "CHICKEN").length,
        sheep: user.animals.filter((a) => a.type === "SHEEP").length,
        cow: user.animals.filter((a) => a.type === "COW").length,
    };
    const progress = quest.getProgress({
        user,
        storage: user.storage,
        counts,
    });
    if (progress < quest.target) {
        return res.status(400).json({ error: "Quest not completed yet" });
    }
    const updated = await prisma_1.prisma.$transaction(async (tx) => {
        await tx.dailyQuestClaim.create({
            data: {
                userId: user.id,
                code,
                claimDate: today,
            },
        });
        return await tx.user.update({
            where: { id: user.id },
            data: {
                coins: { increment: quest.rewardCoins ?? 0 },
                diamonds: { increment: quest.rewardDiamonds ?? 0 },
                xp: { increment: quest.rewardXp ?? 0 },
            },
            select: {
                coins: true,
                diamonds: true,
                xp: true,
            },
        });
    });
    return res.json({
        ok: true,
        code,
        rewardCoins: quest.rewardCoins ?? 0,
        rewardDiamonds: quest.rewardDiamonds ?? 0,
        rewardXp: quest.rewardXp ?? 0,
        user: updated,
    });
});
exports.default = router;
