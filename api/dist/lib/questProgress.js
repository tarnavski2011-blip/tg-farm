"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resetDailyQuestProgressIfNeeded = resetDailyQuestProgressIfNeeded;
exports.addTapToday = addTapToday;
exports.addSellToday = addSellToday;
exports.addFeedBuyToday = addFeedBuyToday;
const prisma_1 = require("../prisma");
function isSameDay(a, b) {
    return (a.getFullYear() === b.getFullYear() &&
        a.getMonth() === b.getMonth() &&
        a.getDate() === b.getDate());
}
async function resetDailyQuestProgressIfNeeded(userId, lastSeenAt) {
    const now = new Date();
    if (lastSeenAt && isSameDay(lastSeenAt, now)) {
        return;
    }
    await prisma_1.prisma.user.update({
        where: { id: userId },
        data: {
            tapsToday: 0,
            sellsToday: 0,
            feedBuysToday: 0,
            lastSeenAt: now,
        },
    });
}
async function addTapToday(userId, amount = 1) {
    await prisma_1.prisma.user.update({
        where: { id: userId },
        data: {
            tapsToday: { increment: amount },
            lastSeenAt: new Date(),
        },
    });
}
async function addSellToday(userId, amount = 1) {
    await prisma_1.prisma.user.update({
        where: { id: userId },
        data: {
            sellsToday: { increment: amount },
            lastSeenAt: new Date(),
        },
    });
}
async function addFeedBuyToday(userId, amount = 1) {
    await prisma_1.prisma.user.update({
        where: { id: userId },
        data: {
            feedBuysToday: { increment: amount },
            lastSeenAt: new Date(),
        },
    });
}
