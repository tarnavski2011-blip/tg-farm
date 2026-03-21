import { prisma } from "../prisma";

export function nowMs() {
  return Date.now();
}

export function isActiveUntil(until: Date | null | undefined, t: number) {
  return !!until && until.getTime() > t;
}

export function warehouseCapacity(level: number) {
  return 1000 * Math.max(1, level);
}

export function labMultiplier(level: number) {
  const lvl = Math.max(1, level);
  return 1 + (lvl - 1) * 0.25; // 1.00, 1.25, 1.50...
}

export async function getOrCreateUser(telegramId: bigint) {
  return prisma.user.upsert({
    where: { telegramId },
    update: {},
    create: { telegramId },
  });
}

export async function getOrCreateStorage(userId: number) {
  return prisma.storage.upsert({
    where: { userId },
    update: {},
    create: { userId },
  });
}
