"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../prisma");
const router = (0, express_1.Router)();
function warehouseUpgradeCost(level) {
    return 1000 * level;
}
function labUpgradeCost(level) {
    return 1500 * level;
}
router.post("/warehouse", async (req, res) => {
    if (!req.telegramUser!.id)
        return res.status(401).json({ error: "Unauthorized" });
    const telegramId = BigInt(req.telegramUser!.id);
    const user = await prisma_1.prisma.user.findUnique({ where: { telegramId } });
    if (!user)
        return res.status(404).json({ error: "user not found" });
    const cost = warehouseUpgradeCost(user.warehouseLevel);
    if (user.coins < cost) {
        return res.status(400).json({ error: "Not enough coins", need: cost, have: user.coins });
    }
    const updated = await prisma_1.prisma.user.update({
        where: { telegramId },
        data: { coins: { decrement: cost }, warehouseLevel: { increment: 1 } },
    });
    return res.json({
        ok: true,
        cost,
        coins: updated.coins,
        warehouseLevel: updated.warehouseLevel,
    });
});
router.post("/lab", async (req, res) => {
    if (!req.telegramUser!.id)
        return res.status(401).json({ error: "Unauthorized" });
    const telegramId = BigInt(req.telegramUser!.id);
    const user = await prisma_1.prisma.user.findUnique({ where: { telegramId } });
    if (!user)
        return res.status(404).json({ error: "user not found" });
    const cost = labUpgradeCost(user.labLevel);
    if (user.coins < cost) {
        return res.status(400).json({ error: "Not enough coins", need: cost, have: user.coins });
    }
    const updated = await prisma_1.prisma.user.update({
        where: { telegramId },
        data: { coins: { decrement: cost }, labLevel: { increment: 1 } },
    });
    return res.json({
        ok: true,
        cost,
        coins: updated.coins,
        labLevel: updated.labLevel,
    });
});
exports.default = router;
//# sourceMappingURL=upgrade.js.map