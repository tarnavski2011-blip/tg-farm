import { Router } from "express";
import { prisma } from "../prisma";
import type { TgAuthedRequest } from "../middleware/telegramAuth";

const router = Router();

router.post("/", async (req: TgAuthedRequest, res) => {
  try {
    const telegramId = BigInt(req.telegramUser!.id);

    const user = await prisma.user.findUnique({
      where: { telegramId },
    });

    if (!user) return res.status(404).json({ error: "User not found" });

    const now = new Date();
    const last = user.lastDailyAt;

    const sameDay = last && last.toDateString() === now.toDateString();

    if (sameDay) {
      return res.status(400).json({ error: "Already claimed" });
    }

    const streak = user.dailyStreak + 1;
    const reward = 100 + streak * 20;

    const updated = await prisma.user.update({
      where: { telegramId },
      data: {
        coins: { increment: reward },
        lastDailyAt: now,
        dailyStreak: streak,
      },
    });

    return res.json({
      ok: true,
      reward,
      streak: updated.dailyStreak,
    });
  } catch (e) {
    return res.status(500).json({ error: "daily error" });
  }
});

export default router;
