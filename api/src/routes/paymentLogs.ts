import express from "express";
import { prisma } from "../prisma";

const router = express.Router();

// 🔥 БЕЗ telegramAuth (для перегляду в браузері)
router.get("/", async (req, res) => {
  try {
    const logs = await prisma.payment.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    res.json(logs);
  } catch (e) {
    res.status(500).json({ error: "failed to load logs" });
  }
});

export default router;
