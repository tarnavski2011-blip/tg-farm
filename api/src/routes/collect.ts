import { Router } from "express";
import { prisma } from "../prisma";
import type { TgAuthedRequest } from "../middleware/telegramAuth";

const router = Router();

function getXpNeeded(level: number) {
  return 100 + level * 50;
}

router.post("/", async (req: TgAuthedRequest, res) => {
  try {
    const telegramId = BigInt(req.telegramUser!.id);

    const user = await prisma.user.findUnique({
      where: { telegramId },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // 🎯 ДОХІД
    const coinsAdded = 100;

    // 🔥 XP ЗА COLLECT
    const xpFromCollect = Math.floor(coinsAdded / 10); // 100 coins → 10 XP

    let xp = user.xp + xpFromCollect;
    let level = user.level;

    let coinsBonus = 0;
    let diamondsBonus = 0;

    // 🔥 LEVEL UP
    while (xp >= getXpNeeded(level)) {
      xp -= getXpNeeded(level);
      level++;

      coinsBonus += 25;

      if (level % 5 === 0) {
        diamondsBonus += 5;
      }

      if (level % 10 === 0) {
        diamondsBonus += 15;
      }
    }

    // 💰 ОНОВЛЕННЯ КОРИСТУВАЧА
    await prisma.user.update({
      where: { id: user.id },
      data: {
        coins: { increment: coinsAdded + coinsBonus },
        diamonds: { increment: diamondsBonus },
        xp,
        level,
      },
    });

    // 🔥 РЕФЕРАЛЬНИЙ ДОХІД (залишаємо як у тебе)
    const referral = await prisma.referral.findFirst({
      where: { referredId: user.id },
    });

    if (referral) {
      const percent = 0.05;
      const bonus = Math.floor(coinsAdded * percent);

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
      xpAdded: xpFromCollect,
      level,
      levelUp: coinsBonus > 0 || diamondsBonus > 0,
      reward: {
        coins: coinsBonus,
        diamonds: diamondsBonus,
      },
    });
  } catch (e) {
    console.error("COLLECT ERROR:", e);
    return res.status(500).json({ error: "Server error" });
  }
});

export default router;
