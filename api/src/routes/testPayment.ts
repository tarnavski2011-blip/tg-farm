import express from "express";
import { prisma } from "../prisma";
import { grantPremiumPurchase } from "../services/paymentGrant";

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const userId = Number(req.query.userId);

    if (!userId) {
      return res.json({ error: "no userId" });
    }

    // ✅ створюємо payment правильно
    const payment = await prisma.payment.create({
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
    await grantPremiumPurchase(payment.id);

    return res.json({ success: true });
  } catch (e) {
    console.error("TEST PAYMENT ERROR:", e);
    return res.status(500).json({ error: "test payment failed" });
  }
});

export default router;
