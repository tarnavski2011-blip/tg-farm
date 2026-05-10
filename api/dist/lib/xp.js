"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.addXp = addXp;
const prisma_1 = require("../prisma");
function getXpNeeded(level) {
    return 100 + level * 50;
}
async function addXp(userId, amount) {
    if (amount <= 0)
        return null;
    const user = await prisma_1.prisma.user.findUnique({
        where: { id: userId },
        select: { xp: true, level: true },
    });
    if (!user)
        return null;
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
    const updated = await prisma_1.prisma.user.update({
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
