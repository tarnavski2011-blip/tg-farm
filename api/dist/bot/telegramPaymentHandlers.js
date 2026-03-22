"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleTelegramPaymentUpdate = handleTelegramPaymentUpdate;
const prisma_1 = require("../prisma");
const telegramStars_1 = require("../services/telegramStars");
const paymentGrant_1 = require("../services/paymentGrant");
async function handleTelegramPaymentUpdate(update) {
    if (update?.pre_checkout_query) {
        const q = update.pre_checkout_query;
        const parsed = (0, telegramStars_1.parsePayload)(q.invoice_payload);
        if (!parsed) {
            await (0, telegramStars_1.answerPreCheckoutQuery)(q.id, false, "Invalid payload");
            return { handled: true };
        }
        const payment = await prisma_1.prisma.payment.findUnique({
            where: { id: parsed.paymentId },
        });
        if (!payment || payment.status !== "pending") {
            await (0, telegramStars_1.answerPreCheckoutQuery)(q.id, false, "Payment not found");
            return { handled: true };
        }
        await (0, telegramStars_1.answerPreCheckoutQuery)(q.id, true);
        return { handled: true };
    }
    const successfulPayment = update?.message?.successful_payment;
    if (successfulPayment) {
        const parsed = (0, telegramStars_1.parsePayload)(successfulPayment.invoice_payload);
        if (!parsed)
            return { handled: true };
        const payment = await prisma_1.prisma.payment.findUnique({
            where: { id: parsed.paymentId },
        });
        if (!payment)
            return { handled: true };
        if (payment.status === "paid")
            return { handled: true };
        await prisma_1.prisma.payment.update({
            where: { id: payment.id },
            data: {
                telegramPaymentChargeId: successfulPayment.telegram_payment_charge_id,
                providerPaymentChargeId: successfulPayment.provider_payment_charge_id ?? null,
            },
        });
        await (0, paymentGrant_1.grantPremiumPurchase)(payment.id);
        return { handled: true };
    }
    return { handled: false };
}
