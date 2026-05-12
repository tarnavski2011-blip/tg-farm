"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../prisma");
const router = (0, express_1.Router)();
const HEAL_COSTS = {
    CHICKEN: {
        coins: { 1: 500, 2: 1000, 3: 2000 },
        points: { 4: 5000, 5: 12000 },
    },
    SHEEP: {
        coins: { 1: 1500, 2: 3000, 3: 6000 },
        points: { 4: 15000, 5: 35000 },
    },
    COW: {
        coins: { 1: 5000, 2: 10000, 3: 20000 },
        points: { 4: 30000, 5: 70000 },
    },
};
function isAnimalType(value) {
    return value === "CHICKEN" || value === "SHEEP" || value === "COW";
}
function normalizeLevel(level) {
    if (level <= 1)
        return 1;
    if (level === 2)
        return 2;
    if (level === 3)
        return 3;
    if (level === 4)
        return 4;
    return 5;
}
function getHealCost(type, levelRaw) {
    const level = normalizeLevel(levelRaw || 1);
    if (level <= 3) {
        return {
            currency: "coins",
            amount: HEAL_COSTS[type].coins[level],
            level,
        };
    }
    return {
        currency: "points",
        amount: HEAL_COSTS[type].points[level],
        level,
    };
}
router.post("/", async (req, res) => {
    try {
        if (!req.telegramUser?.id) {
            return res.status(401).json({ error: "Unauthorized" });
        }
        const telegramId = BigInt(req.telegramUser.id);
        const typeRaw = String(req.body?.type ?? "")
            .trim()
            .toUpperCase();
        if (!typeRaw) {
            return res.status(400).json({ error: "Animal type is required" });
        }
        const user = await prisma_1.prisma.user.findUnique({
            where: { telegramId },
            include: { animals: true },
        });
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }
        const animalsToHeal = typeRaw === "ALL"
            ? user.animals
            : isAnimalType(typeRaw)
                ? user.animals.filter((animal) => animal.type === typeRaw)
                : [];
        if (animalsToHeal.length <= 0) {
            return res.status(400).json({ error: "No animals to heal" });
        }
        let totalCoinsCost = 0;
        let totalPointsCost = 0;
        const breakdown = animalsToHeal.map((animal) => {
            const type = animal.type;
            const cost = getHealCost(type, animal.level ?? 1);
            if (cost.currency === "coins") {
                totalCoinsCost += cost.amount;
            }
            else {
                totalPointsCost += cost.amount;
            }
            return {
                animalId: animal.id,
                type,
                level: cost.level,
                currency: cost.currency,
                amount: cost.amount,
            };
        });
        if ((user.coins ?? 0) < totalCoinsCost) {
            return res.status(400).json({
                error: "Not enough coins",
                need: totalCoinsCost,
                have: user.coins ?? 0,
                currency: "coins",
            });
        }
        if ((user.points ?? 0) < totalPointsCost) {
            return res.status(400).json({
                error: "Not enough points",
                need: totalPointsCost,
                have: user.points ?? 0,
                currency: "points",
            });
        }
        const now = new Date();
        const animalIds = animalsToHeal.map((animal) => animal.id);
        const result = await prisma_1.prisma.$transaction(async (tx) => {
            const updatedUser = await tx.user.update({
                where: { id: user.id },
                data: {
                    coins: totalCoinsCost > 0 ? { decrement: totalCoinsCost } : undefined,
                    points: totalPointsCost > 0 ? { decrement: totalPointsCost } : undefined,
                },
                select: {
                    coins: true,
                    points: true,
                },
            });
            await tx.animal.updateMany({
                where: {
                    id: { in: animalIds },
                    userId: user.id,
                },
                data: {
                    bornAt: now,
                    lastFedAt: now,
                },
            });
            return updatedUser;
        });
        return res.json({
            ok: true,
            healed: animalsToHeal.length,
            type: typeRaw,
            costCoins: totalCoinsCost,
            costPoints: totalPointsCost,
            cost: totalPointsCost > 0 && totalCoinsCost === 0
                ? totalPointsCost
                : totalCoinsCost,
            currency: totalPointsCost > 0 && totalCoinsCost === 0
                ? "points"
                : totalCoinsCost > 0 && totalPointsCost === 0
                    ? "coins"
                    : "mixed",
            coins: result.coins,
            points: result.points,
            breakdown,
        });
    }
    catch (e) {
        console.error("HEAL ERROR:", e);
        return res.status(500).json({
            error: "Server error",
            details: String(e),
        });
    }
});
exports.default = router;
