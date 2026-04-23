import { Router } from "express";
import { prisma } from "../prisma";
import { grantPayment } from "../services/paymentGrant";

const router = Router();

router.get("/test-payment", async (req, res) => {
  const userId = Number(req.query.userId);

  if (!userId) {
    return res.json({ error: "no userId" });
  }

  // симулюємо покупку
  await grantPayment(userId, "diamonds_small");

  res.json({ success: true });
});

export default router;
