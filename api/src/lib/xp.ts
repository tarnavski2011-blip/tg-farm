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
  const pendingRewards: { userId: number; level: number; coins: number; diamonds: number }[] = [];

  while (xp >= getXpNeeded(level)) {
    xp -= getXpNeeded(level);
    level += 1;
    leveledUp = true;
    levelsGained += 1;

    const coins = level * 100;
    const diamonds = level % 5 === 0 ? 2 : 0;
    rewardCoins += coins;
    rewardDiamonds += diamonds;
    pendingRewards.push({ userId, level, coins, diamonds });
  }

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.user.update({
      where: { id: userId },
      data: { xp, level },
      select: { xp: true, level: true, coins: true, diamonds: true },
    });
    if (pendingRewards.length) {
      await tx.levelReward.createMany({ data: pendingRewards, skipDuplicates: true });
    }
    return result;
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
