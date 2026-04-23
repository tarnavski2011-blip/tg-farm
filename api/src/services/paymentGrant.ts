import { prisma } from "../prisma";

export async function grantPayment(userId: number, packageCode: string) {
  let diamonds = 0;

  if (packageCode === "diamonds_small") diamonds = 50;
  if (packageCode === "diamonds_medium") diamonds = 120;
  if (packageCode === "diamonds_large") diamonds = 300;

  if (!diamonds) {
    throw new Error("Invalid package");
  }

  await prisma.user.update({
    where: { telegramId: BigInt(userId) },
    data: {
      diamonds: {
        increment: diamonds,
      },
    },
  });

  console.log(`User ${userId} got ${diamonds} diamonds`);
}

// 👇 ДОДАЙ ОЦЕ (щоб не було помилки)
export async function grantPremiumPurchase(paymentId: number) {
  // тимчасово просто даємо маленький пакет
  const userId = paymentId;

  await grantPayment(userId, "diamonds_small");
}
