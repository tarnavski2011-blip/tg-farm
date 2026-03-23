"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const router = (0, express_1.Router)();
router.get("/", async (req, res) => {
    try {
        const user = req.telegramUser;
        if (!user?.id) {
            return res.status(401).json({ error: "Unauthorized" });
        }
        const telegramId = BigInt(user.id);
        return res.json({
            ok: true,
            telegramId: telegramId.toString(),
        });
    }
    catch (e) {
        console.error("STATE ERROR:", e);
        return res.status(500).json({ error: "Server error" });
    }
});
exports.default = router;
