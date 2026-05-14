"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../prisma");
const router = (0, express_1.Router)();
function getUpgradeCost(type, level, rarity) {
    const rarityMultiplier = rarity === "legendary"
        ? 3
        : rarity === "epic"
            ? 2
            : rarity === "rare"
                ? 1.5
                : 1;
    const base = type === "CHICKEN" ? 100 : type === "SHEEP" ? 500 : 1000;
    return Math.floor(base * level * rarityMultiplier);
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
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }
        const animal = user.animals.find((a) => a.id === animalId);
        if (!animal) {
            return res.status(404).json({ error: "Animal not found" });
        }
        if ((animal.level ?? 1) >= 5) {
            return res.status(400).json({ error: "Max level reached" });
        }
        const cost = getUpgradeCost(animal.type, animal.level ?? 1, animal.rarity || "normal");
        if ((user.coins ?? 0) < cost) {
            return res.status(400).json({
                error: "Not enough coins",
                need: cost,
                have: user.coins ?? 0,
            });
        }
        const result = await prisma_1.prisma.$transaction(async (tx) => {
            const updatedAnimal = await tx.animal.update({
                where: { id: animal.id },
                data: {
                    level: {
                        increment: 1,
                    },
                },
            });
            const updatedUser = await tx.user.update({
                where: { id: user.id },
                data: {
                    coins: {
                        decrement: cost,
                    },
                },
                select: {
                    coins: true,
                },
            });
            return {
                animal: updatedAnimal,
                user: updatedUser,
            };
        });
        return res.json({
            ok: true,
            animal: result.animal,
            coins: result.user.coins,
            spent: cost,
            message: `Animal upgraded to LVL ${result.animal.level}`,
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
exports.default = router;
