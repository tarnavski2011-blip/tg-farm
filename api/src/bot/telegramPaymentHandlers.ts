import { prisma } from "../prisma";
import {
  answerPreCheckoutQuery,
  parsePayload,
} from "../services/telegramStars";

export async function handleTelegramPaymentUpdate(update: any) {
  if (update?.pre_checkout_query) {
    const q = update.pre_checkout_query;
    const parsed = parsePayload(q.invoice_payload);

    if (!parsed) {
      await answerPreCheckoutQuery(q.id, false, "Invalid payload");
      return { handled: true };
    }

    const payment = await prisma.payment.findUnique({
      where: { id: parsed.paymentId },
    });

    if (!payment || payment.status !== "pending") {
      await answerPreCheckoutQuery(q.id, false, "Payment not found");
      return { handled: true };
    }

    await answerPreCheckoutQuery(q.id, true);
    return { handled: true };
  }

  const successfulPayment = update?.message?.successful_payment;

  if (successfulPayment) {
    const parsed = parsePayload(successfulPayment.invoice_payload);
    if (!parsed) return { handled: true };

    const payment = await prisma.payment.findUnique({
      where: { id: parsed.paymentId },
    });

    if (!payment) return { handled: true };
    if (payment.status === "paid") return { handled: true };

    // Validate Telegram-confirmed payment against our stored invoice.
    if (payment.currency !== "XTR" ||
        successfulPayment.currency !== "XTR" ||
        successfulPayment.total_amount !== JSON.parse(payment.metadataJson || "{}").starsAmount &&
        successfulPayment.total_amount !== (await import("../config/premiumProducts")).getPremiumProduct(payment.productCode)?.starsAmount ||
        parsed.userId !== payment.userId ||
        update.message?.from?.id == null) {
      console.error("Stars payment mismatch", payment.id);
      return { handled: true };
    }
    const payer = await prisma.user.findUnique({ where: { id: payment.userId }, select: { telegramId: true } });
    if (!payer || payer.telegramId !== BigInt(update.message.from.id)) return { handled: true };
    const granted = await prisma.$transaction(async (tx) => {
      const claimed = await tx.payment.updateMany({
        where: { id: payment.id, status: "pending" },
        data: { status: "paid", paidAt: new Date(), telegramPaymentChargeId: successfulPayment.telegram_payment_charge_id,
          providerPaymentChargeId: successfulPayment.provider_payment_charge_id ?? null },
      });
      if (claimed.count !== 1) return false;
      await tx.user.update({ where: { id: payment.userId }, data: { diamonds: { increment: payment.amount } } });
      return true;
    });
    if (!granted) return { handled: true };

    return {
      handled: true,
      creditedDiamonds: payment.amount,
    };
  }

  return { handled: false };
}
