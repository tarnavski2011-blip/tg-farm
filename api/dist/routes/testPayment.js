"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const prisma_1 = require("../prisma");
const paymentGrant_1 = require("../services/paymentGrant");
const router = express_1.default.Router();
router.get("/", async (req, res) => {
    try {
        const userId = Number(req.query.userId);
        if (!userId) {
            return res.json({ error: "no userId" });
        }
        // ✅ створюємо payment правильно
        const payment = await prisma_1.prisma.payment.create({
            data: {
                userId: userId,
                productCode: "diamonds_small",
                payload: `test_${userId}_${Date.now()}`,
                currency: "XTR",
                amount: 50,
                status: "pending",
                metadataJson: JSON.stringify({ test: true }),
            },
        });
        // ✅ проводимо оплату
        await (0, paymentGrant_1.grantPremiumPurchase)(payment.id);
        return res.json({ success: true });
    }
    catch (e) {
        console.error("TEST PAYMENT ERROR:", e);
        return res.status(500).json({ error: "test payment failed" });
    }
});
exports.default = router;
