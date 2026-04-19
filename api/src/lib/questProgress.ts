import { prisma } from "../prisma";

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export async function resetDailyQuestProgressIfNeeded(
  userId: number,
  lastSeenAt?: Date | null,
) {
  const now = new Date();

  if (lastSeenAt && isSameDay(lastSeenAt, now)) {
    return;
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      tapsToday: 0,
      sellsToday: 0,
      feedBuysToday: 0,
      lastSeenAt: now,
    },
  });
}

export async function addTapToday(userId: number, amount = 1) {
  await prisma.user.update({
    where: { id: userId },
    data: {
      tapsToday: { increment: amount },
      lastSeenAt: new Date(),
    },
  });
}

export async function addSellToday(userId: number, amount = 1) {
  await prisma.user.update({
    where: { id: userId },
    data: {
      sellsToday: { increment: amount },
      lastSeenAt: new Date(),
    },
  });
}

export async function addFeedBuyToday(userId: number, amount = 1) {
  await prisma.user.update({
    where: { id: userId },
    data: {
      feedBuysToday: { increment: amount },
      lastSeenAt: new Date(),
    },
  });
}
