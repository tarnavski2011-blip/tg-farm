"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../prisma");
const router = (0, express_1.Router)();
router.get("/", async (req, res) => {
    try {
        const user = req.telegramUser;
        if (!user?.id) {
            return res.status(401).json({ error: "Unauthorized" });
        }
        const telegramId = BigInt(user.id);
        let dbUser = await prisma_1.prisma.user.findUnique({
            where: { telegramId },
        });
        if (!dbUser) {
            dbUser = await prisma_1.prisma.user.create({
                data: {
                    telegramId,
                    coins: 100,
                    diamonds: 0,
                },
            });
        }
        return res.json({
            ok: true,
            user: {
                id: dbUser.telegramId.toString(),
                coins: dbUser.coins,
                diamonds: dbUser.diamonds,
            },
        });
    }
    catch (e) {
        console.error("STATE ERROR:", e);
        return res.status(500).json({ error: "Server error" });
    }
});
exports.default = router;
