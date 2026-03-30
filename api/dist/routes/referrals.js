"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../prisma");
const router = (0, express_1.Router)();
// отримати дані
router.get("/", async (req, res) => {
    try {
        if (!req.telegramUser?.id) {
            return res.status(401).json({ error: "Unauthorized" });
        }
        const telegramId = BigInt(req.telegramUser.id);
        const user = await prisma_1.prisma.user.findUnique({
            where: { telegramId },
            include: {
                referrals: true,
            },
        });
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }
        return res.json({
            ok: true,
            myCode: String(user.telegramId),
            totalRefs: user.referrals.length,
        });
    }
    catch (e) {
        console.error(e);
        res.status(500).json({ error: "Server error" });
    }
});
// застосувати код
router.post("/apply", async (req, res) => {
    try {
        if (!req.telegramUser?.id) {
            return res.status(401).json({ error: "Unauthorized" });
        }
        const telegramId = BigInt(req.telegramUser.id);
        const code = String(req.body?.code ?? "");
        if (!code) {
            return res.status(400).json({ error: "Code required" });
        }
        if (code === String(telegramId)) {
            return res.status(400).json({ error: "Cannot refer yourself" });
        }
        const user = await prisma_1.prisma.user.findUnique({
            where: { telegramId },
        });
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }
        if (user.referredById) {
            return res.status(400).json({ error: "Already has referral" });
        }
        const refUser = await prisma_1.prisma.user.findUnique({
            where: { telegramId: BigInt(code) },
        });
        if (!refUser) {
            return res.status(404).json({ error: "Ref not found" });
        }
        await prisma_1.prisma.$transaction([
            prisma_1.prisma.user.update({
                where: { id: user.id },
                data: { referredById: refUser.id },
            }),
            prisma_1.prisma.referral.create({
                data: {
                    referrerId: refUser.id,
                    referredId: user.id,
                },
            }),
            prisma_1.prisma.user.update({
                where: { id: refUser.id },
                data: { coins: { increment: 200 } },
            }),
            prisma_1.prisma.user.update({
                where: { id: user.id },
                data: { coins: { increment: 100 } },
            }),
        ]);
        res.json({
            ok: true,
            reward: 100,
        });
    }
    catch (e) {
        console.error(e);
        res.status(500).json({ error: "Server error" });
    }
});
exports.default = router;
