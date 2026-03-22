"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../prisma");
const router = (0, express_1.Router)();
const PRICE_DIAMONDS = 100;
const DURATION_MS = 60 * 60 * 1000;
router.post("/activate", async (req, res) => {
    if (!req.tgUserId)
        return res.status(401).json({ error: "Unauthorized" });
    const telegramId = BigInt(req.tgUserId);
    const user = await prisma_1.prisma.user.findUnique({ where: { telegramId } });
    if (!user)
        return res.status(404).json({ error: "user not found" });
    if (user.diamonds < PRICE_DIAMONDS) {
        return res.status(400).json({ error: "Not enough diamonds", need: PRICE_DIAMONDS, have: user.diamonds });
    }
    const now = Date.now();
    const base = user.autoCollectUntil && user.autoCollectUntil.getTime() > now ? user.autoCollectUntil.getTime() : now;
    const until = new Date(base + DURATION_MS);
    const updated = await prisma_1.prisma.user.update({
        where: { telegramId },
        data: {
            diamonds: { decrement: PRICE_DIAMONDS },
            autoCollectUntil: until,
        },
    });
    return res.json({ ok: true, diamonds: updated.diamonds, autoCollectUntil: updated.autoCollectUntil });
});
exports.default = router;
