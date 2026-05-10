"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MAX_LEVEL = void 0;
exports.getXpNeeded = getXpNeeded;
exports.getLevelReward = getLevelReward;
exports.calculateLevelProgress = calculateLevelProgress;
exports.MAX_LEVEL = 100;
function getXpNeeded(level) {
    return 100 + level * 50;
}
function getLevelReward(level) {
    let rewardCoins = level * 10;
    let rewardDiamonds = 0;
    if (level % 10 === 0) {
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
function calculateLevelProgress(currentLevel, currentXp, xpToAdd) {
    let level = currentLevel;
    let xp = currentXp + xpToAdd;
    let rewardCoins = 0;
    let rewardDiamonds = 0;
    let leveledUp = false;
    const reachedLevels = [];
    while (level < exports.MAX_LEVEL && xp >= getXpNeeded(level)) {
        xp -= getXpNeeded(level);
        level += 1;
        leveledUp = true;
        reachedLevels.push(level);
        const reward = getLevelReward(level);
        rewardCoins += reward.rewardCoins;
        rewardDiamonds += reward.rewardDiamonds;
    }
    if (level >= exports.MAX_LEVEL) {
        level = exports.MAX_LEVEL;
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
