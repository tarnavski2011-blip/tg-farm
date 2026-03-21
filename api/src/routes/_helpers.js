"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.nowMs = nowMs;
exports.isActiveUntil = isActiveUntil;
exports.warehouseCapacity = warehouseCapacity;
exports.labMultiplier = labMultiplier;
exports.getOrCreateUser = getOrCreateUser;
exports.getOrCreateStorage = getOrCreateStorage;
const prisma_1 = require("../prisma");
function nowMs() {
    return Date.now();
}
function isActiveUntil(until, t) {
    return !!until && until.getTime() > t;
}
function warehouseCapacity(level) {
    return 1000 * Math.max(1, level);
}
function labMultiplier(level) {
    const lvl = Math.max(1, level);
    return 1 + (lvl - 1) * 0.25; // 1.00, 1.25, 1.50...
}
async function getOrCreateUser(telegramId) {
    return prisma_1.prisma.user.upsert({
        where: { telegramId },
        update: {},
        create: { telegramId },
    });
}
async function getOrCreateStorage(userId) {
    return prisma_1.prisma.storage.upsert({
        where: { userId },
        update: {},
        create: { userId },
    });
}
//# sourceMappingURL=_helpers.js.map