import { prisma } from "../prisma";
import { getPremiumProduct } from "../config/premiumProducts";

export async function grantPremiumPurchase(paymentId: number) {
  const payment = await prisma.payment.findUnique({
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

  const product = getPremiumProduct(payment.productCode);

  if (!product) {
    throw new Error("Unknown product");
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: payment.userId },
      data: {
        diamonds: {
          increment: product.diamonds,
        },
      },
    }),

    prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: "paid",
      },
    }),
  ]);

  console.log("Payment granted:", paymentId, product.diamonds);
}
