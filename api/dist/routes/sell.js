"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../prisma");
const questProgress_1 = require("../lib/questProgress");
const xp_1 = require("../lib/xp");
const router = (0, express_1.Router)();
const PRICES = {
    eggs: 6,
    wool: 15,
    milk: 30,
};
function producedPerCycle(type, level) {
    if (type === "CHICKEN")
        return 1 + (level - 1);
    if (type === "SHEEP")
        return 3 + (level - 1);
    if (type === "COW")
        return 7 + (level - 1) * 2;
    return 1;
}
function pointsPerCycle(type, level) {
    if (level < 4)
        return 0;
    if (type === "CHICKEN")
        return level >= 5 ? 3 : 2;
    if (type === "SHEEP")
        return level >= 5 ? 6 : 4;
    if (type === "COW")
        return level >= 5 ? 10 : 7;
    return 0;
}
router.post("/", async (req, res) => {
    try {
        if (!req.telegramUser?.id) {
            return res.status(401).json({ error: "Unauthorized" });
        }
        const telegramId = BigInt(req.telegramUser.id);
        const user = await prisma_1.prisma.user.findUnique({
            where: { telegramId },
            include: {
                storage: true,
                animals: true,
            },
        });
        if (!user || !user.storage) {
            return res.status(404).json({ error: "Storage not found" });
        }
        const eggs = user.storage.eggs ?? 0;
        const wool = user.storage.wool ?? 0;
        const milk = user.storage.milk ?? 0;
        const totalCoins = eggs * PRICES.eggs + wool * PRICES.wool + milk * PRICES.milk;
        const chickenLevel = user.animals.find((a) => a.type === "CHICKEN")?.level ?? 0;
        const sheepLevel = user.animals.find((a) => a.type === "SHEEP")?.level ?? 0;
        const cowLevel = user.animals.find((a) => a.type === "COW")?.level ?? 0;
        const chickenBreedBonus = user.animals.find((a) => a.type === "CHICKEN")?.breedBonus ?? 1;
        const sheepBreedBonus = user.animals.find((a) => a.type === "SHEEP")?.breedBonus ?? 1;
        const cowBreedBonus = user.animals.find((a) => a.type === "COW")?.breedBonus ?? 1;
        const chickenCycles = chickenLevel > 0
            ? Math.floor(eggs / producedPerCycle("CHICKEN", chickenLevel))
            : 0;
        const sheepCycles = sheepLevel > 0
            ? Math.floor(wool / producedPerCycle("SHEEP", sheepLevel))
            : 0;
        const cowCycles = cowLevel > 0 ? Math.floor(milk / producedPerCycle("COW", cowLevel)) : 0;
        const eggsPoints = Math.floor(chickenCycles *
            pointsPerCycle("CHICKEN", chickenLevel) *
            chickenBreedBonus);
        const woolPoints = Math.floor(sheepCycles * pointsPerCycle("SHEEP", sheepLevel) * sheepBreedBonus);
        const milkPoints = Math.floor(cowCycles * pointsPerCycle("COW", cowLevel) * cowBreedBonus);
        const totalPoints = eggsPoints + woolPoints + milkPoints;
        if (totalCoins <= 0 && totalPoints <= 0) {
            return res.json({
                ok: true,
                sold: { eggs, wool, milk },
                earned: 0,
                earnedPoints: 0,
                totalCoins: user.coins,
                totalPoints: user.points,
            });
        }
        const updated = await prisma_1.prisma.user.update({
            where: { telegramId },
            data: {
                coins: { increment: totalCoins },
                points: { increment: totalPoints },
                storage: {
                    update: {
                        eggs: 0,
                        wool: 0,
                        milk: 0,
                    },
                },
            },
            select: {
                coins: true,
                points: true,
            },
        });
        await (0, questProgress_1.addSellToday)(user.id, 1);
        const xpResult = await (0, xp_1.addXp)(user.id, Math.floor(totalCoins / 20));
        return res.json({
            ok: true,
            sold: { eggs, wool, milk },
            prices: PRICES,
            earned: totalCoins,
            earnedPoints: totalPoints,
            totalCoins: updated.coins,
            totalPoints: updated.points,
            pointsBreakdown: {
                eggs: eggsPoints,
                wool: woolPoints,
                milk: milkPoints,
            },
            cycles: {
                chicken: chickenCycles,
                sheep: sheepCycles,
                cow: cowCycles,
            },
            animalLevels: {
                chicken: chickenLevel,
                sheep: sheepLevel,
                cow: cowLevel,
            },
            xp: xpResult,
        });
    }
    catch (e) {
        console.error("SELL ERROR:", e);
        return res.status(500).json({ error: "Server error" });
    }
});
exports.default = router;
