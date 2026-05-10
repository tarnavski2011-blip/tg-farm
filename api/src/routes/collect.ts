import { Router } from "express";
import { prisma } from "../prisma";
import type { TgAuthedRequest } from "../middleware/telegramAuth";
import { addTapToday } from "../lib/questProgress";
import { calculateLevelProgress } from "../lib/levelSystem";

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

    const coinsAdded = 1;
    const xpAdded = 0;

    const levelResult = calculateLevelProgress(
      user.level ?? 1,
      user.xp ?? 0,
      xpAdded,
    );

    await prisma.user.update({
      where: { id: user.id },
      data: {
        coins: { increment: coinsAdded + levelResult.rewardCoins },
        diamonds: { increment: levelResult.rewardDiamonds },
        xp: levelResult.xp,
        level: levelResult.level,
      },
    });

    await addTapToday(user.id, 1);

    const referral = await prisma.referral.findFirst({
      where: { referredId: user.id },
    });

    if (referral) {
      const bonusCoins = Math.floor(coinsAdded * 0.05);

      if (bonusCoins > 0) {
        await prisma.user.update({
          where: { id: referral.referrerId },
          data: {
            coins: { increment: bonusCoins },
          },
        });
      }
    }

    return res.json({
      ok: true,
      coinsAdded,
      xpAdded,
      level: levelResult.level,
      xp: levelResult.xp,

      levelUpData: {
        leveledUp: levelResult.leveledUp,
        level: levelResult.lastReachedLevel,
        rewardCoins: levelResult.rewardCoins,
        rewardDiamonds: levelResult.rewardDiamonds,
        reachedLevels: levelResult.reachedLevels,
      },

      reward: {
        coins: levelResult.rewardCoins,
        diamonds: levelResult.rewardDiamonds,
      },
    });
  } catch (e) {
    console.error("COLLECT ERROR:", e);
    return res.status(500).json({ error: "Server error" });
  }
});

export default router;
