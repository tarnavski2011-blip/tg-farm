"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../prisma");
const premiumProducts_1 = require("../config/premiumProducts");
const telegramStars_1 = require("../services/telegramStars");
const router = (0, express_1.Router)();
router.get("/products", async (_req, res) => {
    return res.json({
        items: Object.values(premiumProducts_1.PREMIUM_PRODUCTS).map((p) => ({
            code: p.code,
            title: p.title,
            description: p.description,
            starsAmount: p.starsAmount,
        })),
    });
});
router.post("/create-invoice", async (req, res) => {
    if (!req.tgUserId)
        return res.status(401).json({ error: "Unauthorized" });
    const productCode = String(req.body?.productCode ?? "").trim();
    const product = (0, premiumProducts_1.getPremiumProduct)(productCode);
    if (!product)
        return res.status(400).json({ error: "Unknown product" });
    const telegramId = BigInt(req.tgUserId);
    const user = await prisma_1.prisma.user.findUnique({
        where: { telegramId },
        select: { id: true },
    });
    if (!user)
        return res.status(404).json({ error: "User not found" });
    const created = await prisma_1.prisma.payment.create({
        data: {
            userId: user.id,
            productCode: product.code,
            payload: `stars:${user.id}:0`,
            currency: "XTR",
            amount: product.starsAmount,
            metadataJson: JSON.stringify({
                title: product.title,
                description: product.description,
            }),
        },
    });
    const payload = `stars:${user.id}:${created.id}`;
    await prisma_1.prisma.payment.update({
        where: { id: created.id },
        data: { payload },
    });
    try {
        const invoiceLink = await (0, telegramStars_1.createStarsInvoiceLink)({
            title: product.title,
            description: product.description,
            payload,
            starsAmount: product.starsAmount,
        });
        return res.json({
            ok: true,
            invoiceLink,
            paymentId: created.id,
            product: {
                code: product.code,
                title: product.title,
                starsAmount: product.starsAmount,
            },
        });
    }
    catch (error) {
        await prisma_1.prisma.payment.update({
            where: { id: created.id },
            data: { status: "failed" },
        });
        return res.status(500).json({
            error: error?.message || "Failed to create invoice",
        });
    }
});
exports.default = router;
//# sourceMappingURL=payments.js.map