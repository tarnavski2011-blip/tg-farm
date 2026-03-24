"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../prisma");
const router = (0, express_1.Router)();
router.post("/", async (req, res) => {
    try {
        if (!req.telegramUser?.id) {
            return res.status(401).json({ error: "Unauthorized" });
        }
        const telegramId = BigInt(req.telegramUser.id);
        const user = await prisma_1.prisma.user.findUnique({
            where: { telegramId },
            include: { storage: true },
        });
        if (!user || !user.storage) {
            return res.status(404).json({ error: "Storage not found" });
        }
        const eggs = user.storage.eggs ?? 0;
        const wool = user.storage.wool ?? 0;
        const milk = user.storage.milk ?? 0;
        const total = eggs + wool + milk;
        if (total <= 0) {
            return res.json({
                ok: true,
                sold: 0,
                totalCoins: user.coins,
            });
        }
        const updated = await prisma_1.prisma.user.update({
            where: { telegramId },
            data: {
                coins: { increment: total },
                storage: {
                    update: {
                        eggs: 0,
                        wool: 0,
                        milk: 0,
                    },
                },
            },
        });
        return res.json({
            ok: true,
            sold: total,
            totalCoins: updated.coins,
        });
    }
    catch (e) {
        console.error("SELL ERROR:", e);
        return res.status(500).json({ error: "Server error" });
    }
});
exports.default = router;
