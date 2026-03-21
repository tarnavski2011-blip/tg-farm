"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../prisma");
const router = (0, express_1.Router)();
const XP_PER_ACTION = 5;
function xpToNext(level) {
    return 100 + level * 50;
}
router.post("/add", async (req, res) => {
    const telegramId = BigInt(req.body.telegramId);
    const user = await prisma_1.prisma.user.findUnique({
        where: { telegramId }
    });
    if (!user)
        return res.status(404).json({ error: "User not found" });
    let xp = user.xp + XP_PER_ACTION;
    let level = user.level;
    const need = xpToNext(level);
    if (xp >= need) {
        xp = xp - need;
        level += 1;
    }
    const updated = await prisma_1.prisma.user.update({
        where: { telegramId },
        data: {
            xp,
            level
        }
    });
    res.json({
        xp: updated.xp,
        level: updated.level
    });
});
exports.default = router;
//# sourceMappingURL=xp.js.map