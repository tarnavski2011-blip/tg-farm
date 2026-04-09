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

    // 1 TAP = 1 COIN
    const coinsAdded = 1;

    // 1 TAP = 1 XP
    const xpAdded = 1;

    let xp = (user.xp ?? 0) + xpAdded;
    let level = user.level ?? 1;

    let levelRewardCoins = 0;
    let levelRewardDiamonds = 0;

    // LEVEL UP
    while (xp >= getXpNeeded(level)) {
      xp -= getXpNeeded(level);
      level += 1;

      // за кожен рівень маленький бонус
      levelRewardCoins += 25;

      // за кожен 5 рівень — діаманти
      if (level % 10 === 0) {
        levelRewardDiamonds += 15;
      } else if (level % 5 === 0) {
        levelRewardDiamonds += 5;
      }
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        coins: { increment: coinsAdded + levelRewardCoins },
        diamonds: { increment: levelRewardDiamonds },
        xp,
        level,
      },
    });

    // ПАСИВНИЙ ДОХІД РЕФЕРЕРУ
    const referral = await prisma.referral.findFirst({
      where: { referredId: user.id },
    });

    if (referral) {
      const percent = 0.05; // 5%
      const bonusCoins = Math.floor(coinsAdded * percent);

      // мінімальні points
      let pointsBonus = 0;
      if (coinsAdded >= 1) pointsBonus = 1;

      if (bonusCoins > 0 || pointsBonus > 0) {
        await prisma.user.update({
          where: { id: referral.referrerId },
          data: {
            coins: { increment: bonusCoins },
            points: { increment: pointsBonus },
          },
        });
      }
    }

    return res.json({
      ok: true,
      coinsAdded,
      xpAdded,
      level,
      levelUp: levelRewardCoins > 0 || levelRewardDiamonds > 0,
      reward: {
        coins: levelRewardCoins,
        diamonds: levelRewardDiamonds,
      },
    });
  } catch (e) {
    console.error("COLLECT ERROR:", e);
    return res.status(500).json({ error: "Server error" });
  }
});

export default router;
