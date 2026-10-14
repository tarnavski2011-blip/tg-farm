"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../prisma");
const router = (0, express_1.Router)();
const UPGRADE_COSTS = {
    CHICKEN: {
        1: { coins: 3000, diamonds: 0 },
        2: { coins: 12000, diamonds: 0 },
        3: { coins: 50000, diamonds: 5 },
        4: { coins: 120000, diamonds: 15 },
    },
    SHEEP: {
        1: { coins: 9000, diamonds: 0 },
        2: { coins: 36000, diamonds: 0 },
        3: { coins: 150000, diamonds: 15 },
        4: { coins: 360000, diamonds: 45 },
    },
    COW: {
        1: { coins: 21000, diamonds: 0 },
        2: { coins: 84000, diamonds: 0 },
        3: { coins: 350000, diamonds: 35 },
        4: { coins: 840000, diamonds: 105 },
    },
};
const RARITY_MULTIPLIER = {
    normal: 1,
    rare: 2,
    epic: 4,
    legendary: 8,
};
const SUCCESS_CHANCE = {
    1: 90,
    2: 65,
    3: 45,
    4: 25,
};
function getUpgradeCost(type, level, rarity) {
    const safeType = type;
    const safeLevel = Math.max(1, Math.min(4, level));
    const base = UPGRADE_COSTS[safeType]?.[safeLevel];
    if (!base) {
        return null;
    }
    const multiplier = RARITY_MULTIPLIER[String(rarity || "normal").toLowerCase()] ?? 1;
    return {
        coins: Math.floor(base.coins * multiplier),
        diamonds: Math.floor(base.diamonds * multiplier),
        multiplier,
    };
}
function getSuccessChance(level, fails) {
    if (fails >= 5)
        return 100;
    return SUCCESS_CHANCE[Math.max(1, Math.min(4, level))] ?? 55;
}
router.post("/", async (req, res) => {
    try {
        if (!req.telegramUser?.id) {
            return res.status(401).json({ error: "Unauthorized" });
        }
        const telegramId = BigInt(req.telegramUser.id);
        const animalId = Number(req.body?.animalId);
        if (!animalId) {
            return res.status(400).json({ error: "animalId required" });
        }
        const user = await prisma_1.prisma.user.findUnique({
            where: { telegramId },
            include: { animals: true },
        });
        if (!user)
            return res.status(404).json({ error: "User not found" });
        const animal = user.animals.find((a) => a.id === animalId);
        if (!animal)
            return res.status(404).json({ error: "Animal not found" });
        if ((animal.level ?? 1) >= 5) {
            return res.status(400).json({ error: "Max level reached" });
        }
        const rarity = animal.rarity || "normal";
        const upgradeFails = animal.upgradeFails ?? 0;
        const cost = getUpgradeCost(animal.type, animal.level ?? 1, rarity);
        if (!cost) {
            return res.status(400).json({ error: "Upgrade cost not found" });
        }
        if ((user.coins ?? 0) < cost.coins) {
            return res.status(400).json({
                error: "Not enough coins",
                needCoins: cost.coins,
                haveCoins: user.coins ?? 0,
            });
        }
        if ((user.diamonds ?? 0) < cost.diamonds) {
            return res.status(400).json({
                error: "Not enough diamonds",
                needDiamonds: cost.diamonds,
                haveDiamonds: user.diamonds ?? 0,
            });
        }
        const chance = getSuccessChance(animal.level ?? 1, upgradeFails);
        const roll = Math.random() * 100;
        const success = roll <= chance;
        const result = await prisma_1.prisma.$transaction(async (tx) => {
            const paid = await tx.user.updateMany({
                where: { id: user.id, coins: { gte: cost.coins }, diamonds: { gte: cost.diamonds } },
                data: { coins: { decrement: cost.coins }, diamonds: { decrement: cost.diamonds } },
            });
            if (paid.count !== 1)
                throw new Error("Insufficient balance at payment time");
            const changed = await tx.animal.updateMany({
                where: { id: animal.id, userId: user.id, level: animal.level, upgradeFails },
                data: success ? { level: { increment: 1 }, upgradeFails: 0 } : { upgradeFails: { increment: 1 } },
            });
            if (changed.count !== 1)
                throw new Error("Animal was already upgraded; retry");
            const updatedUser = await tx.user.findUniqueOrThrow({ where: { id: user.id }, select: { coins: true, diamonds: true } });
            const updatedAnimal = await tx.animal.findUniqueOrThrow({ where: { id: animal.id } });
            return { user: updatedUser, animal: updatedAnimal };
        });
        return res.json({
            ok: true,
            success,
            animal: result.animal,
            coins: result.user.coins,
            diamonds: result.user.diamonds,
            spent: cost,
            chance,
            upgradeFails: result.animal.upgradeFails ?? 0,
            message: success
                ? `✅ Animal upgraded to LVL ${result.animal.level}`
                : `❌ Upgrade failed (${result.animal.upgradeFails ?? 0}/5)`,
        });
    }
    catch (e) {
        console.error("UPGRADE ANIMAL ERROR:", e);
        return res.status(500).json({
            error: "Server error",
            details: String(e),
        });
    }
});
router.get("/costs", async (_req, res) => {
    return res.json({
        ok: true,
        costs: UPGRADE_COSTS,
        normalCosts: UPGRADE_COSTS,
        rarityMultiplier: RARITY_MULTIPLIER,
        successChance: SUCCESS_CHANCE,
    });
});
exports.default = router;
