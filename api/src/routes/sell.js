"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../prisma");
const economy_1 = require("../config/economy");
const router = (0, express_1.Router)();
router.post("/all", async (req, res) => {
    if (!req.tgUserId)
        return res.status(401).json({ error: "Unauthorized" });
    const telegramId = BigInt(req.tgUserId);
    const user = await prisma_1.prisma.user.findUnique({
        where: { telegramId },
        select: { id: true },
    });
    if (!user)
        return res.status(404).json({ error: "User not found" });
    const storage = await prisma_1.prisma.storage.findUnique({
        where: { userId: user.id },
    });
    if (!storage)
        return res.status(404).json({ error: "Storage not found" });
    const earned = storage.eggs * economy_1.ECONOMY.sell.egg +
        storage.wool * economy_1.ECONOMY.sell.wool +
        storage.milk * economy_1.ECONOMY.sell.milk;
    if (earned <= 0)
        return res.json({ ok: true, earned: 0 });
    await prisma_1.prisma.$transaction(async (tx) => {
        await tx.user.update({
            where: { id: user.id },
            data: {
                coins: { increment: earned },
                xp: { increment: Math.max(1, Math.floor(earned / 25)) },
            },
        });
        await tx.storage.update({
            where: { userId: user.id },
            data: { eggs: 0, wool: 0, milk: 0 },
        });
    });
    return res.json({ ok: true, earned });
});
exports.default = router;
//# sourceMappingURL=sell.js.map