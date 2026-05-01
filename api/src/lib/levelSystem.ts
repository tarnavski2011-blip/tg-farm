export const MAX_LEVEL = 100;

export function getXpNeeded(level: number) {
  return 100 + level * 50;
}

export function getLevelReward(level: number) {
  let rewardCoins = level * 100;
  let rewardDiamonds = 0;

  if (level % 10 === 0) {
    rewardDiamonds += 15;
  } else if (level % 5 === 0) {
    rewardDiamonds += 5;
  }

  if (level === 25) {
    rewardCoins += 2500;
    rewardDiamonds += 25;
  }

  if (level === 50) {
    rewardCoins += 5000;
    rewardDiamonds += 50;
  }

  if (level === 75) {
    rewardCoins += 7500;
    rewardDiamonds += 75;
  }

  if (level === 100) {
    rewardCoins += 10000;
    rewardDiamonds += 100;
  }

  return {
    rewardCoins,
    rewardDiamonds,
  };
}

export function calculateLevelProgress(
  currentLevel: number,
  currentXp: number,
  xpToAdd: number,
) {
  let level = currentLevel;
  let xp = currentXp + xpToAdd;

  let rewardCoins = 0;
  let rewardDiamonds = 0;
  let leveledUp = false;
  const reachedLevels: number[] = [];

  while (level < MAX_LEVEL && xp >= getXpNeeded(level)) {
    xp -= getXpNeeded(level);
    level += 1;
    leveledUp = true;
    reachedLevels.push(level);

    const reward = getLevelReward(level);
    rewardCoins += reward.rewardCoins;
    rewardDiamonds += reward.rewardDiamonds;
  }

  if (level >= MAX_LEVEL) {
    level = MAX_LEVEL;
    xp = 0;
  }

  return {
    level,
    xp,
    leveledUp,
    rewardCoins,
    rewardDiamonds,
    reachedLevels,
    lastReachedLevel: reachedLevels[reachedLevels.length - 1] ?? level,
  };
}
