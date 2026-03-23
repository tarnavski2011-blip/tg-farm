import { Router } from "express";
import { prisma } from "../prisma";

const router = Router();

router.post("/", async (req: any, res) => {
  try {
    const user = req.telegramUser;

    if (!user) {
      return res.status(401).json({ error: "No user" });
    }

    const telegramId = BigInt(user.id);

    let dbUser = await prisma.user.findUnique({
      where: { telegramId },
    });

    if (!dbUser) {
      dbUser = await prisma.user.create({
        data: { telegramId },
      });
    }

    const addCoins = 10;

    const updated = await prisma.user.update({
      where: { telegramId },
      data: {
        coins: { increment: addCoins },
        lastTapAt: new Date(),
      },
    });

    return res.json({
      ok: true,
      added: addCoins,
      total: updated.coins,
    });
  } catch (e) {
    console.error("COLLECT ERROR:", e);

    return res.status(500).json({
      error: "Server error",
      details: String(e),
    });
  }
});

export default router;
