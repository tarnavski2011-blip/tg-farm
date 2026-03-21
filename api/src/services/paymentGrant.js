"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.grantPremiumPurchase = grantPremiumPurchase;
const prisma_1 = require("../prisma");
const premiumProducts_1 = require("../config/premiumProducts");
function addMinutes(base, minutes) {
    return new Date(base.getTime() + minutes * 60 * 1000);
}
function addDays(base, days) {
    return new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
}
async function grantPremiumPurchase(paymentId) {
    const payment = await prisma_1.prisma.payment.findUnique({
        where: { id: paymentId },
        include: { user: true },
    });
    if (!payment)
        throw new Error("Payment not found");
    if (payment.status === "paid")
        return payment;
    const product = premiumProducts_1.PREMIUM_PRODUCTS[payment.productCode];
    if (!product)
        throw new Error("Unknown product");
    const now = new Date();
    const vipBase = payment.user.vipUntil && payment.user.vipUntil > now
        ? payment.user.vipUntil
        : now;
    const boostBase = payment.user.boostUntil && payment.user.boostUntil > now
        ? payment.user.boostUntil
        : now;
    const feedBase = payment.user.feedUntil && payment.user.feedUntil > now
        ? payment.user.feedUntil
        : now;
    await prisma_1.prisma.$transaction(async (tx) => {
        await tx.user.update({
            where: { id: payment.userId },
            data: {
                diamonds: { increment: product.grant.diamonds ?? 0 },
                vipUntil: product.grant.vipDays
                    ? addDays(vipBase, product.grant.vipDays)
                    : payment.user.vipUntil,
                boostUntil: product.grant.boostMinutes
                    ? addMinutes(boostBase, product.grant.boostMinutes)
                    : payment.user.boostUntil,
                feedUntil: product.grant.feedMinutes
                    ? addMinutes(feedBase, product.grant.feedMinutes)
                    : payment.user.feedUntil,
            },
        });
        await tx.payment.update({
            where: { id: payment.id },
            data: {
                status: "paid",
                paidAt: now,
            },
        });
    });
    return await prisma_1.prisma.payment.findUnique({ where: { id: paymentId } });
}
//# sourceMappingURL=paymentGrant.js.map