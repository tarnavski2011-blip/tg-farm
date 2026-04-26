import { prisma } from "../prisma";

function getXpNeeded(level: number) {
  return 100 + level * 50;
}

export async function addXp(userId: number, amount: number) {
  if (amount <= 0) return null;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { xp: true, level: true },
  });

  if (!user) return null;

  let xp = user.xp + amount;
  let level = user.level;

  let leveledUp = false;
  let levelsGained = 0;
  let rewardCoins = 0;
  let rewardDiamonds = 0;

  while (xp >= getXpNeeded(level)) {
    xp -= getXpNeeded(level);
    level += 1;
    leveledUp = true;
    levelsGained += 1;

    rewardCoins += level * 100;

    if (level % 5 === 0) {
      rewardDiamonds += 2;
    }
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      xp,
      level,
      coins: { increment: rewardCoins },
      diamonds: { increment: rewardDiamonds },
    },
    select: {
      xp: true,
      level: true,
      coins: true,
      diamonds: true,
    },
  });

  return {
    xp: updated.xp,
    level: updated.level,
    added: amount,
    leveledUp,
    levelsGained,
    rewardCoins,
    rewardDiamonds,
    xpNeeded: getXpNeeded(updated.level),
  };
}
