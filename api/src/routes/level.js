"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../prisma");
const router = (0, express_1.Router)();
router.get("/", async (req, res) => {
    const telegramIdRaw = req.query.telegramId;
    if (typeof telegramIdRaw !== "string" || !telegramIdRaw.trim()) {
        return res.status(400).json({ error: "telegramId is required" });
    }
    let telegramId;
    try {
        telegramId = BigInt(telegramIdRaw);
    }
    catch {
        return res.status(400).json({ error: "Invalid telegramId" });
    }
    const user = await prisma_1.prisma.user.findUnique({
        where: { telegramId },
        select: {
            level: true,
            xp: true,
        },
    });
    if (!user) {
        return res.status(404).json({ error: "User not found" });
    }
    return res.json(user);
});
exports.default = router;
//# sourceMappingURL=level.js.map