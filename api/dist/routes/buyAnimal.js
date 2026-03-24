"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../prisma");
const router = (0, express_1.Router)();
const PRICES = {
    CHICKEN: 100,
    SHEEP: 500,
    COW: 1000,
};
router.post("/", async (req, res) => {
    try {
        if (!req.telegramUser?.id) {
            return res.status(401).json({ error: "Unauthorized" });
        }
        const rawType = String(req.body?.type ?? "")
            .toUpperCase()
            .trim();
        if (!["CHICKEN", "SHEEP", "COW"].includes(rawType)) {
            return res.status(400).json({ error: "Invalid animal type" });
        }
        const type = rawType;
        const telegramId = BigInt(req.telegramUser.id);
        const user = await prisma_1.prisma.user.findUnique({
            where: { telegramId },
        });
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }
        const price = PRICES[type];
        if (user.coins < price) {
            return res.status(400).json({
                error: "Not enough coins",
                need: price,
                have: user.coins,
            });
        }
        await prisma_1.prisma.user.update({
            where: { telegramId },
            data: {
                coins: { decrement: price },
                animals: {
                    create: {
                        type,
                        level: 1,
                        lastClaim: new Date(),
                    },
                },
            },
        });
        return res.json({
            ok: true,
            bought: type,
            price,
        });
    }
    catch (e) {
        console.error("BUY ANIMAL ERROR:", e);
        return res.status(500).json({ error: "Server error" });
    }
});
exports.default = router;
