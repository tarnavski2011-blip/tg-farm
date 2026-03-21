import { prisma } from "../prisma";
import { PREMIUM_PRODUCTS } from "../config/premiumProducts";

function addMinutes(base: Date, minutes: number) {
  return new Date(base.getTime() + minutes * 60 * 1000);
}

function addDays(base: Date, days: number) {
  return new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
}

export async function grantPremiumPurchase(paymentId: number) {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: { user: true },
  });

  if (!payment) throw new Error("Payment not found");
  if (payment.status === "paid") return payment;

  const product =
    PREMIUM_PRODUCTS[payment.productCode as keyof typeof PREMIUM_PRODUCTS];
  if (!product) throw new Error("Unknown product");

  const now = new Date();
  const vipBase =
    payment.user.vipUntil && payment.user.vipUntil > now
      ? payment.user.vipUntil
      : now;
  const boostBase =
    payment.user.boostUntil && payment.user.boostUntil > now
      ? payment.user.boostUntil
      : now;
  const feedBase =
    payment.user.feedUntil && payment.user.feedUntil > now
      ? payment.user.feedUntil
      : now;

  await prisma.$transaction(async (tx) => {
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

  return await prisma.payment.findUnique({ where: { id: paymentId } });
}
