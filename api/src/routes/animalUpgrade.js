"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../prisma");
const economy_1 = require("../config/economy");
const router = (0, express_1.Router)();
router.post("/", async (req, res) => {
    if (!req.tgUserId)
        return res.status(401).json({ error: "Unauthorized" });
    const type = String(req.body?.type ?? "")
        .trim()
        .toUpperCase();
    const telegramId = BigInt(req.tgUserId);
    const user = await prisma_1.prisma.user.findUnique({
        where: { telegramId },
        select: { id: true, coins: true },
    });
    if (!user)
        return res.status(404).json({ error: "User not found" });
    const animal = await prisma_1.prisma.animal.findFirst({
        where: { userId: user.id, type },
        orderBy: { level: "desc" },
    });
    if (!animal)
        return res.status(404).json({ error: "Animal not owned" });
    const price = (0, economy_1.upgradePrice)(type, animal.level);
    if (user.coins < price)
        return res.status(400).json({ error: "Not enough coins" });
    const updated = await prisma_1.prisma.$transaction(async (tx) => {
        await tx.user.update({
            where: { id: user.id },
            data: { coins: { decrement: price }, xp: { increment: 3 } },
        });
        return await tx.animal.update({
            where: { id: animal.id },
            data: { level: { increment: 1 } },
            select: { level: true },
        });
    });
    return res.json({ ok: true, level: updated.level, pricePaid: price });
});
exports.default = router;
//# sourceMappingURL=animalUpgrade.js.map