"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../prisma");
const antiSpam_1 = require("../middleware/antiSpam");
const requestLock_1 = require("../middleware/requestLock");
const router = (0, express_1.Router)();
const TAP_COOLDOWN_MS = 1000;
function getXpNeeded(level) {
    return 100 + level * 50;
}
router.post("/", (0, antiSpam_1.antiSpamPerUser)(1000, 8), (0, requestLock_1.requestLockByUser)(120), async (req, res) => {
    const telegramIdStr = String(req.body?.telegramId ?? "");
    if (!telegramIdStr) {
        return res.status(400).json({ error: "telegramId is required" });
    }
    let telegramId;
    try {
        telegramId = BigInt(telegramIdStr);
    }
    catch {
        return res
            .status(400)
            .json({ error: "telegramId must be an integer string" });
    }
    const user = await prisma_1.prisma.user.findUnique({
        where: { telegramId },
    });
    if (!user) {
        return res.status(404).json({ error: "user not found" });
    }
    const now = Date.now();
    const lastTap = user.lastTapAt ? user.lastTapAt.getTime() : 0;
    if (now - lastTap < TAP_COOLDOWN_MS) {
        return res.status(400).json({ error: "Tap cooldown" });
    }
    let xp = user.xp + 1;
    let level = user.level;
    let coinsBonus = 0;
    let diamondsBonus = 0;
    // 🔥 LEVEL UP
    while (xp >= getXpNeeded(level)) {
        xp -= getXpNeeded(level);
        level++;
        coinsBonus += 25;
        if (level % 5 === 0) {
            diamondsBonus += 5;
        }
        if (level % 10 === 0) {
            diamondsBonus += 15;
        }
    }
    const updated = await prisma_1.prisma.user.update({
        where: { telegramId },
        data: {
            coins: { increment: 1 + coinsBonus },
            diamonds: { increment: diamondsBonus },
            xp,
            level,
            lastTapAt: new Date(),
        },
    });
    return res.json({
        coins: updated.coins,
        xp: updated.xp,
        level: updated.level,
        levelUp: coinsBonus > 0 || diamondsBonus > 0,
        reward: {
            coins: coinsBonus,
            diamonds: diamondsBonus,
        },
    });
});
exports.default = router;
