"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../prisma");
const router = (0, express_1.Router)();
router.post("/", async (req, res) => {
    try {
        const user = req.telegramUser;
        if (!user) {
            return res.status(401).json({ error: "No user" });
        }
        const telegramId = BigInt(user.id);
        let dbUser = await prisma_1.prisma.user.findUnique({
            where: { telegramId },
        });
        if (!dbUser) {
            dbUser = await prisma_1.prisma.user.create({
                data: { telegramId },
            });
        }
        const addCoins = 10;
        const updated = await prisma_1.prisma.user.update({
            where: { telegramId },
            data: {
                coins: { increment: addCoins },
                lastTapAt: new Date(),
            },
        });
        return res.json({
            ok: true,
            added: addCoins,
            total: updated.coins,
        });
    }
    catch (e) {
        console.error("COLLECT ERROR:", e);
        return res.status(500).json({
            error: "Server error",
            details: String(e),
        });
    }
});
exports.default = router;
