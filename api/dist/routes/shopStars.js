"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../prisma");
const telegramStars_1 = require("../services/telegramStars");
const router = (0, express_1.Router)();
const PACKAGES = {
    small: {
        code: "small",
        title: "Малий пакет",
        description: "50 діамантів",
        starsAmount: 20,
        diamonds: 50,
    },
    medium: {
        code: "medium",
        title: "Середній пакет",
        description: "120 діамантів",
        starsAmount: 50,
        diamonds: 120,
    },
    large: {
        code: "large",
        title: "Великий пакет",
        description: "300 діамантів",
        starsAmount: 100,
        diamonds: 300,
    },
};
router.get("/", (_req, res) => {
    return res.json({
        items: Object.values(PACKAGES),
    });
});
router.post("/buy", async (req, res) => {
    try {
        if (!req.telegramUser?.id) {
            return res.status(401).json({ error: "Unauthorized" });
        }
        const code = String(req.body?.code ?? "").trim();
        if (!(code in PACKAGES)) {
            return res.status(400).json({ error: "Invalid package" });
        }
        const pack = PACKAGES[code];
        const telegramId = BigInt(req.telegramUser.id);
        const user = await prisma_1.prisma.user.findUnique({
            where: { telegramId },
            select: { id: true },
        });
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }
        const created = await prisma_1.prisma.payment.create({
            data: {
                userId: user.id,
                productCode: pack.code,
                payload: `stars:${user.id}:0`,
                currency: "XTR",
                amount: pack.diamonds,
                status: "pending",
                metadataJson: JSON.stringify({
                    title: pack.title,
                    description: pack.description,
                    starsAmount: pack.starsAmount,
                    diamonds: pack.diamonds,
                }),
            },
        });
        const payload = `stars:${user.id}:${created.id}`;
        await prisma_1.prisma.payment.update({
            where: { id: created.id },
            data: { payload },
        });
        const invoiceLink = await (0, telegramStars_1.createStarsInvoiceLink)({
            title: pack.title,
            description: pack.description,
            payload,
            starsAmount: pack.starsAmount,
        });
        return res.json({
            ok: true,
            invoiceLink,
        });
    }
    catch (e) {
        console.error("SHOP STARS ERROR:", e);
        return res.status(500).json({ error: "Server error" });
    }
});
exports.default = router;
