import { Router } from "express";
import { prisma } from "../prisma";

const router = Router();

const PRICES = {
  CHICKEN: 100,
  SHEEP: 500,
  COW: 1000,
};

router.post("/", async (req: any, res) => {
  try {
    const user = req.telegramUser;
    const { type } = req.body;

    if (!user || !type) {
      return res.status(400).json({ error: "Bad request" });
    }

    const telegramId = BigInt(user.id);

    const dbUser = await prisma.user.findUnique({
      where: { telegramId },
    });

    if (!dbUser) {
      return res.status(404).json({ error: "User not found" });
    }

    const price = PRICES[type as keyof typeof PRICES];

    if (!price) {
      return res.status(400).json({ error: "Invalid animal type" });
    }

    if (dbUser.coins < price) {
      return res.status(400).json({ error: "Not enough coins" });
    }

    await prisma.user.update({
      where: { telegramId },
      data: {
        coins: { decrement: price },
        animals: {
          create: {
            type,
          },
        },
      },
    });

    return res.json({ ok: true });
  } catch (e) {
    console.error("BUY ERROR:", e);
    return res.status(500).json({ error: "Server error" });
  }
});

export default router;
