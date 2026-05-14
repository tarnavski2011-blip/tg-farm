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
function getSlotLimit(user, type) {
    if (type === "CHICKEN")
        return user.chickenSlots ?? 2;
    if (type === "SHEEP")
        return user.sheepSlots ?? 2;
    if (type === "COW")
        return user.cowSlots ?? 2;
    return 2;
}
function getFreeSlot(animals, slotLimit) {
    for (let i = 1; i <= slotLimit; i++) {
        const used = animals.some((animal) => animal.slotIndex === i);
        if (!used)
            return i;
    }
    return null;
}
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
            include: {
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
        const sameTypeAnimals = user.animals.filter((animal) => animal.type === type);
        const slotLimit = getSlotLimit(user, type);
        const freeSlot = getFreeSlot(sameTypeAnimals, slotLimit);
        if (!freeSlot) {
            return res.status(400).json({
                error: `Немає вільного слота. Відкрий новий слот для цієї тварини.`,
                type,
                ownedCount: sameTypeAnimals.length,
                maxCount: slotLimit,
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
                    rarity: "normal",
                    breedBonus: 1,
                    slotIndex: freeSlot,
                    hp: 100,
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
                ownedCount: sameTypeAnimals.length + 1,
                maxCount: slotLimit,
                slotIndex: freeSlot,
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
