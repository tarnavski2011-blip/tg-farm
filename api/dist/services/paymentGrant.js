"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.grantPremiumPurchase = grantPremiumPurchase;
const prisma_1 = require("../prisma");
const premiumProducts_1 = require("../config/premiumProducts");
async function grantPremiumPurchase(paymentId) {
    const payment = await prisma_1.prisma.payment.findUnique({
        where: { id: paymentId },
    });
    if (!payment) {
        throw new Error("Payment not found");
    }
    // ✅ анти-дюп
    if (payment.status === "paid") {
        console.log("Payment already granted:", paymentId);
        return;
    }
    if (!payment.productCode) {
        throw new Error("Payment productCode missing");
    }
    const product = (0, premiumProducts_1.getPremiumProduct)(payment.productCode);
    if (!product) {
        throw new Error("Unknown product");
    }
    await prisma_1.prisma.$transaction([
        prisma_1.prisma.user.update({
            where: { id: payment.userId },
            data: {
                diamonds: {
                    increment: product.diamonds,
                },
            },
        }),
        prisma_1.prisma.payment.update({
            where: { id: payment.id },
            data: {
                status: "paid",
            },
        }),
    ]);
    console.log("Payment granted:", paymentId, product.diamonds);
}
