"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../prisma");
const _helpers_1 = require("./_helpers");
const router = (0, express_1.Router)();
router.get("/", async (req, res) => {
    if (!req.telegramUser!.id)
        return res.status(401).json({ error: "Unauthorized" });
    const telegramId = BigInt(req.telegramUser!.id);
    const user = await prisma_1.prisma.user.findUnique({ where: { telegramId } });
    if (!user)
        return res.status(404).json({ error: "user not found" });
    const storage = await (0, _helpers_1.getOrCreateStorage)(user.id);
    const cap = (0, _helpers_1.warehouseCapacity)(user.warehouseLevel);
    return res.json({
        eggs: storage.eggs,
        wool: storage.wool,
        milk: storage.milk,
        total: storage.eggs + storage.wool + storage.milk,
        capacity: cap,
        warehouseLevel: user.warehouseLevel,
    });
});
exports.default = router;
//# sourceMappingURL=storage.js.map