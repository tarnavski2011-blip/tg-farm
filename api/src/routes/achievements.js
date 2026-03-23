"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../prisma");
const antiSpam_1 = require("../middleware/antiSpam");
const requestLock_1 = require("../middleware/requestLock");
const router = (0, express_1.Router)();
const ACHIEVEMENTS = [
    {
        code: "FIRST_CHICKEN",
        title: "First Chicken",
        description: "Купити 1 курку",
        target: 1,
        rewardCoins: 100,
        rewardDiamonds: 1,
        getProgress: ({ counts }) => counts.chicken,
    },
    {
        code: "CHICKEN_5",
        title: "Chicken Master",
        description: "Купити 5 курок",
        target: 5,
        rewardCoins: 300,
        rewardDiamonds: 3,
        getProgress: ({ counts }) => counts.chicken,
    },
    {
        code: "EGGS_100",
        title: "Egg Collector",
        description: "Мати 100 яєць на складі",
        target: 100,
        rewardCoins: 500,
        rewardDiamonds: 5,
        getProgress: ({ storage }) => storage?.eggs ?? 0,
    },
    {
        code: "SHEEP_3",
        title: "Sheep Farmer",
        description: "Купити 3 вівці",
        target: 3,
        rewardCoins: 400,
        rewardDiamonds: 4,
        getProgress: ({ counts }) => counts.sheep,
    },
    {
        code: "REF_3",
        title: "Invite Friends",
        description: "Запросити 3 друзів",
        target: 3,
        rewardCoins: 1000,
        rewardDiamonds: 10,
        getProgress: ({ referralCount }) => referralCount,
    },
];
router.get("/", async (req, res) => {
    if (!req.telegramUser!.id) {
        return res.status(401).json({ error: "Unauthorized" });
    }
    const telegramId = BigInt(req.telegramUser!.id);
    const user = await prisma_1.prisma.user.findUnique({
        where: { telegramId },
        include: {
            animals: true,
            storage: true,
            achievementClaims: true,
            referrals: true,
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
    const claimed = new Set(user.achievementClaims.map((c) => c.code));
    const referralCount = user.referrals.length;
    const items = ACHIEVEMENTS.map((a) => {
        const progress = a.getProgress({
            user,
            storage: user.storage,
            counts,
            referralCount,
        });
        return {
            code: a.code,
            title: a.title,
            description: a.description,
            target: a.target,
            progress,
            completed: progress >= a.target,
            claimed: claimed.has(a.code),
            rewardCoins: a.rewardCoins ?? 0,
            rewardDiamonds: a.rewardDiamonds ?? 0,
        };
    });
    return res.json({ items });
});
router.post("/claim", (0, antiSpam_1.antiSpamPerUser)(3000, 3), (0, requestLock_1.requestLockByUser)(2000), async (req, res) => {
    if (!req.telegramUser!.id) {
        return res.status(401).json({ error: "Unauthorized" });
    }
    const telegramId = BigInt(req.telegramUser!.id);
    const code = String(req.body?.code ?? "").trim();
    const achievement = ACHIEVEMENTS.find((a) => a.code === code);
    if (!achievement) {
        return res.status(400).json({ error: "Unknown achievement code" });
    }
    const user = await prisma_1.prisma.user.findUnique({
        where: { telegramId },
        include: {
            animals: true,
            storage: true,
            achievementClaims: {
                where: { code },
            },
            referrals: true,
        },
    });
    if (!user) {
        return res.status(404).json({ error: "User not found" });
    }
    if (user.achievementClaims.length > 0) {
        return res.status(400).json({ error: "Achievement already claimed" });
    }
    const counts = {
        chicken: user.animals.filter((a) => a.type === "CHICKEN").length,
        sheep: user.animals.filter((a) => a.type === "SHEEP").length,
        cow: user.animals.filter((a) => a.type === "COW").length,
    };
    const referralCount = user.referrals.length;
    const progress = achievement.getProgress({
        user,
        storage: user.storage,
        counts,
        referralCount,
    });
    if (progress < achievement.target) {
        return res.status(400).json({ error: "Achievement not completed yet" });
    }
    const updated = await prisma_1.prisma.$transaction(async (tx) => {
        await tx.achievementClaim.create({
            data: {
                userId: user.id,
                code,
            },
        });
        return await tx.user.update({
            where: { id: user.id },
            data: {
                coins: { increment: achievement.rewardCoins ?? 0 },
                diamonds: { increment: achievement.rewardDiamonds ?? 0 },
            },
            select: {
                coins: true,
                diamonds: true,
            },
        });
    });
    return res.json({
        ok: true,
        code,
        rewardCoins: achievement.rewardCoins ?? 0,
        rewardDiamonds: achievement.rewardDiamonds ?? 0,
        user: updated,
    });
});
exports.default = router;
//# sourceMappingURL=achievements.js.map