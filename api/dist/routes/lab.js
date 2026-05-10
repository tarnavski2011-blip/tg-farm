"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../prisma");
const client_1 = require("@prisma/client");
const xp_1 = require("../lib/xp");
const router = (0, express_1.Router)();
const ANIMAL_UPGRADE_COSTS = {
    CHICKEN: {
        1: { coins: 500, diamonds: 0 },
        2: { coins: 1500, diamonds: 0 },
        3: { coins: 5000, diamonds: 5 },
        4: { coins: 15000, diamonds: 15 },
    },
    SHEEP: {
        1: { coins: 1500, diamonds: 0 },
        2: { coins: 5000, diamonds: 0 },
        3: { coins: 12000, diamonds: 12 },
        4: { coins: 35000, diamonds: 35 },
    },
    COW: {
        1: { coins: 4000, diamonds: 0 },
        2: { coins: 12000, diamonds: 0 },
        3: { coins: 30000, diamonds: 30 },
        4: { coins: 90000, diamonds: 90 },
    },
};
const STORAGE_LEVELS = {
    1: { capacity: 1000, cost: { coins: 1500, diamonds: 0 } },
    2: { capacity: 2000, cost: { coins: 5000, diamonds: 0 } },
    3: { capacity: 3500, cost: { coins: 15000, diamonds: 10 } },
    4: { capacity: 6000, cost: { coins: 40000, diamonds: 25 } },
    5: { capacity: 10000, cost: null },
};
const ANIMAL_SUCCESS_CHANCE = {
    1: 0.8,
    2: 0.6,
    3: 0.35,
    4: 0.15,
};
const STORAGE_SUCCESS_CHANCE = {
    1: 0.9,
    2: 0.75,
    3: 0.55,
    4: 0.35,
};
function getChanceWithPity(baseChance, fails) {
    if (fails >= 5)
        return 1;
    if (fails >= 3)
        return Math.min(1, baseChance + 0.1);
    return baseChance;
}
function rollSuccess(chance) {
    return Math.random() < chance;
}
async function getAnimalTypeState(userId, type, coins, diamonds) {
    const animals = await prisma_1.prisma.animal.findMany({
        where: { userId, type },
        select: { level: true, upgradeFails: true },
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
            successChance: 0,
            upgradeFails: 0,
            pity: false,
        };
    }
    const currentLevel = Math.max(...animals.map((a) => a.level));
    const sameLevelAnimals = animals.filter((a) => a.level === currentLevel);
    const upgradeFails = sameLevelAnimals.length
        ? Math.max(...sameLevelAnimals.map((a) => a.upgradeFails ?? 0))
        : 0;
    const maxed = currentLevel >= 5;
    const upgradeCost = maxed
        ? null
        : (ANIMAL_UPGRADE_COSTS[type][currentLevel] ?? null);
    const baseChance = ANIMAL_SUCCESS_CHANCE[currentLevel] ?? 0;
    const successChance = maxed ? 0 : getChanceWithPity(baseChance, upgradeFails);
    return {
        type,
        owned,
        currentLevel,
        nextLevel: maxed ? 5 : currentLevel + 1,
        maxed,
        upgradeCost,
        canUpgrade: !!upgradeCost &&
            coins >= upgradeCost.coins &&
            diamonds >= upgradeCost.diamonds,
        successChance: Math.round(successChance * 100),
        upgradeFails,
        pity: upgradeFails >= 5,
    };
}
router.get("/", async (req, res) => {
    try {
        if (!req.telegramUser?.id) {
            return res.status(401).json({ error: "Unauthorized" });
        }
        const telegramId = BigInt(req.telegramUser.id);
        const user = await prisma_1.prisma.user.findUnique({
            where: { telegramId },
            include: { storage: true },
        });
        if (!user || !user.storage) {
            return res.status(404).json({ error: "User not found" });
        }
        const chicken = await getAnimalTypeState(user.id, client_1.AnimalType.CHICKEN, user.coins ?? 0, user.diamonds ?? 0);
        const sheep = await getAnimalTypeState(user.id, client_1.AnimalType.SHEEP, user.coins ?? 0, user.diamonds ?? 0);
        const cow = await getAnimalTypeState(user.id, client_1.AnimalType.COW, user.coins ?? 0, user.diamonds ?? 0);
        const currentStorageLevel = user.warehouseLevel ?? 1;
        const currentStorageCfg = STORAGE_LEVELS[currentStorageLevel] ?? STORAGE_LEVELS[1];
        const nextStorageLevel = Math.min(5, currentStorageLevel + 1);
        const nextStorageCfg = STORAGE_LEVELS[nextStorageLevel] ?? currentStorageCfg;
        const maxed = currentStorageLevel >= 5;
        const storageCost = currentStorageCfg.cost;
        const storageBaseChance = STORAGE_SUCCESS_CHANCE[currentStorageLevel] ?? 0;
        const storageSuccessChance = maxed
            ? 0
            : getChanceWithPity(storageBaseChance, user.storageUpgradeFails ?? 0);
        return res.json({
            ok: true,
            animals: {
                chicken,
                sheep,
                cow,
            },
            storage: {
                currentLevel: currentStorageLevel,
                nextLevel: maxed ? 5 : nextStorageLevel,
                capacity: user.storage.capacity ?? currentStorageCfg.capacity,
                nextCapacity: maxed
                    ? (user.storage.capacity ?? currentStorageCfg.capacity)
                    : nextStorageCfg.capacity,
                maxed,
                upgradeCost: storageCost,
                canUpgrade: !maxed &&
                    !!storageCost &&
                    (user.coins ?? 0) >= storageCost.coins &&
                    (user.diamonds ?? 0) >= storageCost.diamonds,
                successChance: Math.round(storageSuccessChance * 100),
                upgradeFails: user.storageUpgradeFails ?? 0,
                pity: (user.storageUpgradeFails ?? 0) >= 5,
            },
        });
    }
    catch (e) {
        console.error("LAB GET ERROR:", e);
        return res.status(500).json({ error: "Server error" });
    }
});
router.post("/animal-upgrade", async (req, res) => {
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
            select: { id: true, coins: true, diamonds: true },
        });
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }
        const animals = await prisma_1.prisma.animal.findMany({
            where: { userId: user.id, type },
            select: { id: true, level: true, upgradeFails: true },
        });
        if (!animals.length) {
            return res.status(400).json({ error: "Спочатку купи тварин" });
        }
        const currentLevel = Math.max(...animals.map((a) => a.level));
        if (currentLevel >= 5) {
            return res.status(400).json({ error: "Максимальний рівень" });
        }
        const cost = ANIMAL_UPGRADE_COSTS[type][currentLevel];
        if (!cost) {
            return res.status(400).json({ error: "Немає ціни для цього рівня" });
        }
        if ((user.coins ?? 0) < cost.coins) {
            return res.status(400).json({ error: "Не вистачає coins" });
        }
        if ((user.diamonds ?? 0) < cost.diamonds) {
            return res.status(400).json({ error: "Не вистачає diamonds" });
        }
        const sameLevelAnimals = animals.filter((a) => a.level === currentLevel);
        const upgradeFails = sameLevelAnimals.length
            ? Math.max(...sameLevelAnimals.map((a) => a.upgradeFails ?? 0))
            : 0;
        const baseChance = ANIMAL_SUCCESS_CHANCE[currentLevel] ?? 0;
        const successChance = getChanceWithPity(baseChance, upgradeFails);
        const success = rollSuccess(successChance);
        const nextLevel = success ? currentLevel + 1 : currentLevel;
        const nextFails = success ? 0 : upgradeFails + 1;
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
                data: {
                    level: nextLevel,
                    upgradeFails: nextFails,
                },
            }),
        ]);
        const xpResult = await (0, xp_1.addXp)(user.id, success ? 50 : 10);
        const updatedUser = await prisma_1.prisma.user.findUnique({
            where: { id: user.id },
            select: { coins: true, diamonds: true },
        });
        return res.json({
            ok: true,
            success,
            type,
            previousLevel: currentLevel,
            level: nextLevel,
            spent: cost,
            successChance: Math.round(successChance * 100),
            upgradeFails: nextFails,
            pity: nextFails >= 5,
            message: success
                ? `✅ Успіх! ${type} LVL ${nextLevel}`
                : `❌ Не вийшло. Спроба ${nextFails}/5`,
            coins: updatedUser?.coins ?? 0,
            diamonds: updatedUser?.diamonds ?? 0,
            xp: xpResult,
        });
    }
    catch (e) {
        console.error("LAB ANIMAL UPGRADE ERROR:", e);
        return res.status(500).json({ error: "Server error" });
    }
});
router.post("/storage-upgrade", async (req, res) => {
    try {
        if (!req.telegramUser?.id) {
            return res.status(401).json({ error: "Unauthorized" });
        }
        const telegramId = BigInt(req.telegramUser.id);
        const user = await prisma_1.prisma.user.findUnique({
            where: { telegramId },
            include: { storage: true },
        });
        if (!user || !user.storage) {
            return res.status(404).json({ error: "User not found" });
        }
        const currentLevel = user.warehouseLevel ?? 1;
        if (currentLevel >= 5) {
            return res.status(400).json({ error: "Максимальний рівень складу" });
        }
        const currentCfg = STORAGE_LEVELS[currentLevel];
        const nextCfg = STORAGE_LEVELS[currentLevel + 1];
        if (!currentCfg?.cost || !nextCfg) {
            return res.status(400).json({ error: "Немає наступного рівня" });
        }
        if ((user.coins ?? 0) < currentCfg.cost.coins) {
            return res.status(400).json({ error: "Не вистачає coins" });
        }
        if ((user.diamonds ?? 0) < currentCfg.cost.diamonds) {
            return res.status(400).json({ error: "Не вистачає diamonds" });
        }
        const baseChance = STORAGE_SUCCESS_CHANCE[currentLevel] ?? 0;
        const successChance = getChanceWithPity(baseChance, user.storageUpgradeFails ?? 0);
        const success = rollSuccess(successChance);
        const nextFails = success ? 0 : (user.storageUpgradeFails ?? 0) + 1;
        const nextLevel = success ? currentLevel + 1 : currentLevel;
        const nextCapacity = success ? nextCfg.capacity : user.storage.capacity;
        const tx = [
            prisma_1.prisma.user.update({
                where: { id: user.id },
                data: {
                    coins: { decrement: currentCfg.cost.coins },
                    diamonds: { decrement: currentCfg.cost.diamonds },
                    warehouseLevel: nextLevel,
                    storageUpgradeFails: nextFails,
                },
            }),
        ];
        if (success) {
            tx.push(prisma_1.prisma.storage.update({
                where: { userId: user.id },
                data: {
                    capacity: nextCfg.capacity,
                },
            }));
        }
        await prisma_1.prisma.$transaction(tx);
        const xpResult = await (0, xp_1.addXp)(user.id, success ? 70 : 15);
        return res.json({
            ok: true,
            success,
            previousLevel: currentLevel,
            level: nextLevel,
            capacity: nextCapacity,
            spent: currentCfg.cost,
            successChance: Math.round(successChance * 100),
            upgradeFails: nextFails,
            pity: nextFails >= 5,
            message: success
                ? `✅ Склад LVL ${nextLevel}`
                : `❌ Не вийшло. Спроба ${nextFails}/5`,
            xp: xpResult,
        });
    }
    catch (e) {
        console.error("LAB STORAGE UPGRADE ERROR:", e);
        return res.status(500).json({ error: "Server error" });
    }
});
exports.default = router;
