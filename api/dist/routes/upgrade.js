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
router.post("/", async (_req, res) => {
    return res.status(410).json({ error: "Use /api/upgrade-animal with animalId; group upgrades are disabled" });
});
exports.default = router;
