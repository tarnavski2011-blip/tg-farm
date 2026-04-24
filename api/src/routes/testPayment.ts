import express from "express";
import { grantPayment } from "../services/paymentGrant";

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const userId = Number(req.query.userId);

    if (!userId) {
      return res.json({ error: "no userId" });
    }

    await grantPayment(userId, "diamonds_small");

    return res.json({ success: true });
  } catch (e) {
    console.error("TEST PAYMENT ERROR:", e);
    return res.status(500).json({ error: "test payment failed" });
  }
});

export default router;
