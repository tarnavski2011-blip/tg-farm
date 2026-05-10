"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../prisma");
const router = (0, express_1.Router)();
const TON_RATES = {
    small: { ton: 0.5, diamonds: 50 },
    medium: { ton: 1, diamonds: 120 },
    large: { ton: 5, diamonds: 700 },
};
router.get("/", async (req, res) => {
    try {
        const telegramId = BigInt(req.telegramUser.id);
        const user = await prisma_1.prisma.user.findUnique({
            where: { telegramId },
            select: {
                tonBalance: true,
                points: true,
            },
        });
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }
        return res.json({
            ok: true,
            tonBalance: user.tonBalance ?? 0,
            points: user.points ?? 0,
            pointRate: {
                pointsPerTon: 100000,
                feePercent: 5,
            },
            packages: TON_RATES,
            depositWallet: "UQAGmtMLvMcU_qN9vF58RbAIAy319pn9ubphF1el8N61uXwD",
        });
    }
    catch (e) {
        return res.status(500).json({ error: "Server error" });
    }
});
router.post("/buy-diamonds", async (req, res) => {
    try {
        const telegramId = BigInt(req.telegramUser.id);
        const pkg = String(req.body?.package ?? "");
        const selected = TON_RATES[pkg];
        if (!selected) {
            return res.status(400).json({ error: "Invalid package" });
        }
        const user = await prisma_1.prisma.user.findUnique({
            where: { telegramId },
        });
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }
        if ((user.tonBalance ?? 0) < selected.ton) {
            return res.status(400).json({
                error: "Not enough TON balance",
            });
        }
        const updated = await prisma_1.prisma.user.update({
            where: { telegramId },
            data: {
                tonBalance: { decrement: selected.ton },
                diamonds: { increment: selected.diamonds },
            },
            select: {
                tonBalance: true,
                diamonds: true,
            },
        });
        return res.json({
            ok: true,
            spentTon: selected.ton,
            diamondsReceived: selected.diamonds,
            tonBalance: updated.tonBalance,
            diamonds: updated.diamonds,
        });
    }
    catch (e) {
        return res.status(500).json({ error: "Server error" });
    }
});
exports.default = router;
