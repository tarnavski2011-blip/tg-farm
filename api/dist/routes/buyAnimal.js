"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../prisma");
const xp_1 = require("../lib/xp");
const router = (0, express_1.Router)();
const ANIMAL_PRICES = {
    CHICKEN: 100,
    SHEEP: 500,
    COW: 1000,
};
const ANIMAL_UNLOCK_LEVEL = {
    CHICKEN: 1,
    SHEEP: 5,
    COW: 10,
};
const ANIMAL_LIMITS = {
    CHICKEN: 2,
    SHEEP: 2,
    COW: 2,
};
router.post("/", async (req, res) => {
    try {
        if (!req.telegramUser?.id) {
            return res.status(401).json({ error: "Unauthorized" });
        }
        const type = String(req.body?.type ?? "").trim();
        if (!type || !["CHICKEN", "SHEEP", "COW"].includes(type)) {
            return res.status(400).json({ error: "Invalid animal type" });
        }
        const telegramId = BigInt(req.telegramUser.id);
        const user = await prisma_1.prisma.user.findUnique({
            where: { telegramId },
            select: {
                id: true,
                level: true,
                coins: true,
                animals: true,
            },
        });
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }
        const unlockLevel = ANIMAL_UNLOCK_LEVEL[type];
        if ((user.level ?? 1) < unlockLevel) {
            return res.status(400).json({
                error: `Ця тварина відкривається на LVL ${unlockLevel}`,
                requiredLevel: unlockLevel,
                yourLevel: user.level ?? 1,
            });
        }
        const ownedCount = user.animals.filter((a) => a.type === type).length;
        const maxCount = ANIMAL_LIMITS[type];
        if (ownedCount >= maxCount) {
            return res.status(400).json({
                error: `Максимум ${maxCount} тварин цього типу`,
                type,
                ownedCount,
                maxCount,
            });
        }
        const price = ANIMAL_PRICES[type];
        if ((user.coins ?? 0) < price) {
            return res.status(400).json({
                error: "Не вистачає coins",
                need: price,
                have: user.coins ?? 0,
            });
        }
        const now = new Date();
        const [animal, updatedUser] = await prisma_1.prisma.$transaction([
            prisma_1.prisma.animal.create({
                data: {
                    userId: user.id,
                    type,
                    level: 1,
                    bornAt: now,
                    lastFedAt: now,
                    lastClaim: now,
                },
            }),
            prisma_1.prisma.user.update({
                where: { id: user.id },
                data: {
                    coins: { decrement: price },
                },
                select: {
                    coins: true,
                },
            }),
        ]);
        const xpResult = await (0, xp_1.addXp)(user.id, 20);
        return res.json({
            ok: true,
            animal,
            coins: updatedUser.coins,
            spent: price,
            limit: {
                type,
                ownedCount: ownedCount + 1,
                maxCount,
            },
            xp: xpResult,
        });
    }
    catch (e) {
        console.error("BUY ANIMAL ERROR:", e);
        return res.status(500).json({ error: "Server error" });
    }
});
exports.default = router;
