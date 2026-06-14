"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../prisma");
const router = (0, express_1.Router)();
router.post("/connect", async (req, res) => {
    try {
        const telegramId = BigInt(req.telegramUser.id);
        const address = String(req.body.address || "");
        if (!address) {
            return res.status(400).json({
                ok: false,
                error: "Address required",
            });
        }
        await prisma_1.prisma.user.update({
            where: { telegramId },
            data: {
                walletAddress: address,
            },
        });
        return res.json({
            ok: true,
            address,
        });
    }
    catch (e) {
        console.error(e);
        return res.status(500).json({
            ok: false,
            error: "Server error",
        });
    }
});
router.post("/disconnect", async (req, res) => {
    try {
        const telegramId = BigInt(req.telegramUser.id);
        await prisma_1.prisma.user.update({
            where: { telegramId },
            data: {
                walletAddress: null,
            },
        });
        return res.json({ ok: true });
    }
    catch (e) {
        return res.status(500).json({
            ok: false,
            error: "Server error",
        });
    }
});
exports.default = router;
