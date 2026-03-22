"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const telegramPaymentHandlers_1 = require("../bot/telegramPaymentHandlers");
const router = (0, express_1.Router)();
router.post("/", async (req, res) => {
    try {
        const update = req.body;
        await (0, telegramPaymentHandlers_1.handleTelegramPaymentUpdate)(update);
        res.sendStatus(200);
    }
    catch (e) {
        console.error("Telegram webhook error:", e);
        res.sendStatus(200);
    }
});
router.get("/", (_req, res) => {
    res.send("telegram webhook ok");
});
exports.default = router;
