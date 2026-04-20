import { prisma } from "../prisma";

export const STAR_PACKAGES = {
  small: {
    diamonds: 50,
    stars: 25,
    title: "Малий пакет",
    description: "50 діамантів",
  },
  medium: {
    diamonds: 120,
    stars: 50,
    title: "Середній пакет",
    description: "120 діамантів",
  },
  large: {
    diamonds: 300,
    stars: 100,
    title: "Великий пакет",
    description: "300 діамантів",
  },
} as const;

export type StarPackageCode = keyof typeof STAR_PACKAGES;

export function isStarPackageCode(value: string): value is StarPackageCode {
  return value in STAR_PACKAGES;
}

export function makeInvoicePayload(
  telegramUserId: number | string,
  packageCode: StarPackageCode,
) {
  return `stars:${telegramUserId}:${packageCode}`;
}

export function parseInvoicePayload(payload: string) {
  const parts = payload.split(":");
  if (parts.length !== 3 || parts[0] !== "stars") return null;

  const telegramUserId = parts[1];
  const packageCode = parts[2];

  if (!/^\d+$/.test(telegramUserId)) return null;
  if (!isStarPackageCode(packageCode)) return null;

  return {
    telegramUserId: BigInt(telegramUserId),
    packageCode,
  };
}

export async function creditDiamondsForSuccessfulPayment(payload: string) {
  const parsed = parseInvoicePayload(payload);
  if (!parsed) {
    throw new Error("Invalid payment payload");
  }

  const pack = STAR_PACKAGES[parsed.packageCode];

  const user = await prisma.user.findUnique({
    where: { telegramId: parsed.telegramUserId },
    select: { id: true },
  });

  if (!user) {
    throw new Error("User not found for successful payment");
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      diamonds: { increment: pack.diamonds },
    },
  });

  return {
    telegramUserId: parsed.telegramUserId,
    packageCode: parsed.packageCode,
    diamonds: pack.diamonds,
  };
}
