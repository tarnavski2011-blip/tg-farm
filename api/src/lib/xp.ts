import { prisma } from "../prisma";

function getXpNeeded(level: number) {
  return 100 + level * 50;
}

export async function addXp(userId: number, amount: number) {
  if (amount <= 0) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { xp: true, level: true },
  });

  if (!user) {
    return null;
  }

  let xp = user.xp + amount;
  let level = user.level;

  let leveledUp = false;
  let levelsGained = 0;

  while (xp >= getXpNeeded(level)) {
    xp -= getXpNeeded(level);
    level += 1;
    leveledUp = true;
    levelsGained += 1;
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      xp,
      level,
    },
    select: {
      xp: true,
      level: true,
    },
  });

  return {
    xp: updated.xp,
    level: updated.level,
    added: amount,
    leveledUp,
    levelsGained,
  };
}
