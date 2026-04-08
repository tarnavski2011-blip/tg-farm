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

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // 🎯 ОСНОВНИЙ ДОХІД (можеш замінити на свою логіку)
    const coinsAdded = 100;

    await prisma.user.update({
      where: { id: user.id },
      data: {
        coins: { increment: coinsAdded },
      },
    });

    // 🔥 ПАСИВНИЙ ДОХІД РЕФЕРЕРУ
    const referral = await prisma.referral.findFirst({
      where: { referredId: user.id },
    });

    if (referral) {
      const percent = 0.05; // 5%
      const bonus = Math.floor(coinsAdded * percent);

      // ⭐ POINTS (мінімально)
      let pointsBonus = 0;

      if (coinsAdded >= 100) pointsBonus = 1;
      if (coinsAdded >= 1000) pointsBonus = 2;
      if (coinsAdded >= 5000) pointsBonus = 3;
      if (coinsAdded >= 10000) pointsBonus = 5;

      if (bonus > 0 || pointsBonus > 0) {
        await prisma.user.update({
          where: { id: referral.referrerId },
          data: {
            coins: { increment: bonus },
            points: { increment: pointsBonus },
          },
        });
      }
    }

    return res.json({
      ok: true,
      coinsAdded,
    });
  } catch (e) {
    console.error("COLLECT ERROR:", e);
    return res.status(500).json({ error: "Server error" });
  }
});

export default router;
