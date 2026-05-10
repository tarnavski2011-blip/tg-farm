"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../prisma");
const client_1 = require("@prisma/client");
const router = (0, express_1.Router)();
const UPGRADE_COSTS = {
    CHICKEN: {
        1: { coins: 100, diamonds: 0 },
        2: { coins: 200, diamonds: 0 },
        3: { coins: 400, diamonds: 2 },
        4: { coins: 800, diamonds: 5 },
    },
    SHEEP: {
        1: { coins: 250, diamonds: 0 },
        2: { coins: 500, diamonds: 0 },
        3: { coins: 900, diamonds: 3 },
        4: { coins: 1500, diamonds: 6 },
    },
    COW: {
        1: { coins: 500, diamonds: 0 },
        2: { coins: 900, diamonds: 0 },
        3: { coins: 1500, diamonds: 4 },
        4: { coins: 2500, diamonds: 8 },
    },
};
function getLuckyChance(currentLevel) {
    if (currentLevel === 3)
        return 0.1;
    if (currentLevel === 4)
        return 0.05;
    return 0;
}
async function getTypeState(userId, type) {
    const animals = await prisma_1.prisma.animal.findMany({
        where: { userId, type },
        select: { level: true },
    });
    const owned = animals.length;
    if (owned === 0) {
        return {
            type,
            owned: 0,
            currentLevel: 0,
            nextLevel: 1,
            maxed: false,
            upgradeCost: null,
            canUpgrade: false,
        };
    }
    const currentLevel = Math.max(...animals.map((a) => a.level));
    const maxed = currentLevel >= 5;
    const upgradeCost = maxed
        ? null
        : (UPGRADE_COSTS[type][currentLevel] ?? null);
    return {
        type,
        owned,
        currentLevel,
        nextLevel: maxed ? 5 : currentLevel + 1,
        maxed,
        upgradeCost,
    };
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
                id: true,
                coins: true,
                diamonds: true,
            },
        });
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }
        const chicken = await getTypeState(user.id, client_1.AnimalType.CHICKEN);
        const sheep = await getTypeState(user.id, client_1.AnimalType.SHEEP);
        const cow = await getTypeState(user.id, client_1.AnimalType.COW);
        return res.json({
            ok: true,
            upgrades: {
                chicken: {
                    ...chicken,
                    canUpgrade: !!chicken.upgradeCost &&
                        user.coins >= chicken.upgradeCost.coins &&
                        user.diamonds >= chicken.upgradeCost.diamonds,
                },
                sheep: {
                    ...sheep,
                    canUpgrade: !!sheep.upgradeCost &&
                        user.coins >= sheep.upgradeCost.coins &&
                        user.diamonds >= sheep.upgradeCost.diamonds,
                },
                cow: {
                    ...cow,
                    canUpgrade: !!cow.upgradeCost &&
                        user.coins >= cow.upgradeCost.coins &&
                        user.diamonds >= cow.upgradeCost.diamonds,
                },
            },
        });
    }
    catch (e) {
        console.error("UPGRADE STATE ERROR:", e);
        return res.status(500).json({ error: "Server error" });
    }
});
router.post("/", async (req, res) => {
    try {
        if (!req.telegramUser?.id) {
            return res.status(401).json({ error: "Unauthorized" });
        }
        const { type } = req.body;
        if (!type || !["CHICKEN", "SHEEP", "COW"].includes(type)) {
            return res.status(400).json({ error: "Invalid animal type" });
        }
        const telegramId = BigInt(req.telegramUser.id);
        const user = await prisma_1.prisma.user.findUnique({
            where: { telegramId },
            select: {
                id: true,
                coins: true,
                diamonds: true,
            },
        });
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }
        const animals = await prisma_1.prisma.animal.findMany({
            where: { userId: user.id, type },
            select: { id: true, level: true },
        });
        if (!animals.length) {
            return res.status(400).json({ error: "Спочатку купи тварин" });
        }
        const currentLevel = Math.max(...animals.map((a) => a.level));
        if (currentLevel >= 5) {
            return res.status(400).json({ error: "Максимальний рівень" });
        }
        const cost = UPGRADE_COSTS[type][currentLevel];
        if (!cost) {
            return res.status(400).json({ error: "Немає ціни для цього рівня" });
        }
        if (user.coins < cost.coins) {
            return res.status(400).json({ error: "Не вистачає coins" });
        }
        if (user.diamonds < cost.diamonds) {
            return res.status(400).json({ error: "Не вистачає diamonds" });
        }
        let nextLevel = currentLevel + 1;
        let luckyUpgrade = false;
        const luckyChance = getLuckyChance(currentLevel);
        if (luckyChance > 0 && Math.random() < luckyChance) {
            nextLevel = Math.min(5, nextLevel + 1);
            luckyUpgrade = true;
        }
        await prisma_1.prisma.$transaction([
            prisma_1.prisma.user.update({
                where: { id: user.id },
                data: {
                    coins: { decrement: cost.coins },
                    diamonds: { decrement: cost.diamonds },
                },
            }),
            prisma_1.prisma.animal.updateMany({
                where: { userId: user.id, type },
                data: { level: nextLevel },
            }),
        ]);
        const userAfter = await prisma_1.prisma.user.findUnique({
            where: { id: user.id },
            select: {
                coins: true,
                diamonds: true,
            },
        });
        return res.json({
            ok: true,
            type,
            previousLevel: currentLevel,
            level: nextLevel,
            luckyUpgrade,
            spent: cost,
            coins: userAfter?.coins ?? 0,
            diamonds: userAfter?.diamonds ?? 0,
        });
    }
    catch (e) {
        console.error("UPGRADE APPLY ERROR:", e);
        return res.status(500).json({ error: "Server error" });
    }
});
exports.default = router;
