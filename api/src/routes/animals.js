"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../prisma");
const economy_1 = require("../config/economy");
const router = (0, express_1.Router)();
router.post("/buy", async (req, res) => {
    if (!req.telegramUser!.id)
        return res.status(401).json({ error: "Unauthorized" });
    const type = String(req.body?.type ?? "")
        .trim()
        .toUpperCase();
    if (!economy_1.ECONOMY.animals[type])
        return res.status(400).json({ error: "Unknown animal type" });
    const telegramId = BigInt(req.telegramUser!.id);
    const user = await prisma_1.prisma.user.findUnique({
        where: { telegramId },
        select: { id: true, coins: true },
    });
    if (!user)
        return res.status(404).json({ error: "User not found" });
    const price = economy_1.ECONOMY.animals[type].buyPrice;
    if (user.coins < price)
        return res.status(400).json({ error: "Not enough coins" });
    await prisma_1.prisma.$transaction(async (tx) => {
        await tx.user.update({
            where: { id: user.id },
            data: { coins: { decrement: price }, xp: { increment: 5 } },
        });
        await tx.animal.create({ data: { userId: user.id, type, level: 1 } });
    });
    return res.json({ ok: true, type, pricePaid: price });
});
exports.default = router;
//# sourceMappingURL=animals.js.map