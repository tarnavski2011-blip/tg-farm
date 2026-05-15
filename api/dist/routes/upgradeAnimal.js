"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../prisma");
const router = (0, express_1.Router)();
const UPGRADE_COSTS = {
    CHICKEN: {
        1: { coins: 5000, diamonds: 0 },
        2: { coins: 25000, diamonds: 0 },
        3: { coins: 100000, diamonds: 5 },
        4: { coins: 500000, diamonds: 25 },
    },
    SHEEP: {
        1: { coins: 25000, diamonds: 0 },
        2: { coins: 100000, diamonds: 5 },
        3: { coins: 500000, diamonds: 25 },
        4: { coins: 1500000, diamonds: 75 },
    },
    COW: {
        1: { coins: 100000, diamonds: 5 },
        2: { coins: 500000, diamonds: 25 },
        3: { coins: 1500000, diamonds: 75 },
        4: { coins: 3000000, diamonds: 150 },
    },
};
const RARITY_MULTIPLIER = {
    normal: 1,
    rare: 1.25,
    epic: 1.6,
    legendary: 2.2,
};
const SUCCESS_CHANCE = {
    1: 95,
    2: 80,
    3: 60,
    4: 40,
};
function getUpgradeCost(type, level, rarity) {
    const safeType = type;
    const safeLevel = Math.max(1, Math.min(4, level));
    const base = UPGRADE_COSTS[safeType]?.[safeLevel];
    if (!base)
        return null;
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
    return SUCCESS_CHANCE[Math.max(1, Math.min(4, level))] ?? 40;
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
            const updatedUser = await tx.user.update({
                where: { id: user.id },
                data: {
                    coins: { decrement: cost.coins },
                    diamonds: { decrement: cost.diamonds },
                },
                select: { coins: true, diamonds: true },
            });
            const updatedAnimal = await tx.animal.update({
                where: { id: animal.id },
                data: success
                    ? {
                        level: { increment: 1 },
                        upgradeFails: 0,
                    }
                    : {
                        upgradeFails: { increment: 1 },
                    },
            });
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
        rarityMultiplier: RARITY_MULTIPLIER,
        successChance: SUCCESS_CHANCE,
    });
});
exports.default = router;
