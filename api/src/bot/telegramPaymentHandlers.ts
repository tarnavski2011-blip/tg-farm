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

    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        telegramPaymentChargeId: successfulPayment.telegram_payment_charge_id,
        providerPaymentChargeId:
          successfulPayment.provider_payment_charge_id ?? null,
      },
    });

    const amount = payment.amount;

    await prisma.user.update({
      where: { id: payment.userId },
      data: {
        diamonds: {
          increment: amount,
        },
      },
    });

    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: "paid",
        paidAt: new Date(),
      },
    });

    return {
      handled: true,
      creditedDiamonds: amount,
    };
  }

  return { handled: false };
}
