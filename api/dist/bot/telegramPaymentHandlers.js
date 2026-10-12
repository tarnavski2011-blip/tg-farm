"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleTelegramPaymentUpdate = handleTelegramPaymentUpdate;
const prisma_1 = require("../prisma");
const telegramStars_1 = require("../services/telegramStars");
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
        // Validate Telegram-confirmed payment against our stored invoice.
        if (payment.currency !== "XTR" ||
            successfulPayment.currency !== "XTR" ||
            successfulPayment.total_amount !== JSON.parse(payment.metadataJson || "{}").starsAmount &&
                successfulPayment.total_amount !== (await Promise.resolve().then(() => __importStar(require("../config/premiumProducts")))).getPremiumProduct(payment.productCode)?.starsAmount ||
            parsed.userId !== payment.userId ||
            update.message?.from?.id == null) {
            console.error("Stars payment mismatch", payment.id);
            return { handled: true };
        }
        const payer = await prisma_1.prisma.user.findUnique({ where: { id: payment.userId }, select: { telegramId: true } });
        if (!payer || payer.telegramId !== BigInt(update.message.from.id))
            return { handled: true };
        const granted = await prisma_1.prisma.$transaction(async (tx) => {
            const claimed = await tx.payment.updateMany({
                where: { id: payment.id, status: "pending" },
                data: { status: "paid", paidAt: new Date(), telegramPaymentChargeId: successfulPayment.telegram_payment_charge_id,
                    providerPaymentChargeId: successfulPayment.provider_payment_charge_id ?? null },
            });
            if (claimed.count !== 1)
                return false;
            await tx.user.update({ where: { id: payment.userId }, data: { diamonds: { increment: payment.amount } } });
            return true;
        });
        if (!granted)
            return { handled: true };
        return {
            handled: true,
            creditedDiamonds: payment.amount,
        };
    }
    return { handled: false };
}
