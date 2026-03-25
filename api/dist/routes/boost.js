"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../prisma");
const router = (0, express_1.Router)();
router.post("/auto", async (req, res) => {
    try {
        const telegramId = BigInt(req.telegramUser.id);
        const until = new Date(Date.now() + 60 * 60 * 1000); // 1 година
        await prisma_1.prisma.user.update({
            where: { telegramId },
            data: {
                autoCollectUntil: until,
            },
        });
        res.json({ ok: true, auto: true });
    }
    catch (e) {
        res.status(500).json({ error: "auto error" });
    }
});
router.post("/boost", async (req, res) => {
    try {
        const telegramId = BigInt(req.telegramUser.id);
        const until = new Date(Date.now() + 60 * 60 * 1000);
        await prisma_1.prisma.user.update({
            where: { telegramId },
            data: {
                boostUntil: until,
            },
        });
        res.json({ ok: true, boost: true });
    }
    catch (e) {
        res.status(500).json({ error: "boost error" });
    }
});
exports.default = router;
