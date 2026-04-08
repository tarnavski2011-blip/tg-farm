import { Router } from "express";
import { prisma } from "../prisma";
import type { TgAuthedRequest } from "../middleware/telegramAuth";

const router = Router();

// 📊 GET REFERRALS + СТАТИСТИКА
router.get("/", async (req: TgAuthedRequest, res) => {
  try {
    const telegramId = BigInt(req.telegramUser!.id);

    const user = await prisma.user.findUnique({
      where: { telegramId },
      include: {
        referrals: {
          include: {
            referred: true,
          },
        },
      },
    });

    if (!user) return res.status(404).json({ error: "User not found" });

    // 🔥 СТАТИСТИКА ДОХОДУ
    let totalEarnedCoins = 0;
    let totalEarnedPoints = 0;

    const referredUsers = await prisma.user.findMany({
      where: {
        id: {
          in: user.referrals.map((r) => r.referredId),
        },
      },
      select: {
        coins: true,
      },
    });

    referredUsers.forEach((u) => {
      const coins = u.coins ?? 0;

      const coinsFromRef = Math.floor(coins * 0.05);
      totalEarnedCoins += coinsFromRef;

      if (coins >= 100) totalEarnedPoints += 1;
      if (coins >= 1000) totalEarnedPoints += 2;
      if (coins >= 5000) totalEarnedPoints += 3;
      if (coins >= 10000) totalEarnedPoints += 5;
    });

    return res.json({
      ok: true,
      myCode: String(user.telegramId),
      totalRefs: user.referrals.length,

      stats: {
        earnedCoins: totalEarnedCoins,
        earnedPoints: totalEarnedPoints,
      },

      refs: user.referrals.map((r) => ({
        id: r.id,
        telegramId: r.referred.telegramId,
        createdAt: r.createdAt,
      })),
    });
  } catch (e) {
    console.error("REFERRALS GET ERROR:", e);
    res.status(500).json({ error: "Server error" });
  }
});

// 🎯 APPLY REFERRAL (ручний ввод)
router.post("/apply", async (req: TgAuthedRequest, res) => {
  try {
    const telegramId = BigInt(req.telegramUser!.id);
    const code = String(req.body.code ?? "");

    if (!code) return res.status(400).json({ error: "No code" });
    if (code === String(telegramId))
      return res.status(400).json({ error: "Self ref" });

    const user = await prisma.user.findUnique({
      where: { telegramId },
    });

    const refUser = await prisma.user.findUnique({
      where: { telegramId: BigInt(code) },
      include: { referrals: true },
    });

    if (!user || !refUser)
      return res.status(404).json({ error: "User not found" });

    const already = await prisma.referral.findFirst({
      where: { referredId: user.id },
    });

    if (already) return res.status(400).json({ error: "Already referred" });

    // 🎁 БАЗОВІ БОНУСИ
    const rewardYou = 100;
    const rewardRefCoins = 200;
    const rewardRefDiamonds = 10;
    const rewardRefPoints = 5;

    await prisma.$transaction([
      prisma.referral.create({
        data: {
          referrerId: refUser.id,
          referredId: user.id,
        } as any,
      }),

      prisma.user.update({
        where: { id: user.id },
        data: {
          coins: { increment: rewardYou },
        },
      }),

      prisma.user.update({
        where: { id: refUser.id },
        data: {
          coins: { increment: rewardRefCoins },
          diamonds: { increment: rewardRefDiamonds },
          points: { increment: rewardRefPoints },
        },
      }),
    ]);

    // 🎯 БОНУСИ ЗА КІЛЬКІСТЬ
    const totalRefs = refUser.referrals.length + 1;

    let bonus = 0;
    let bonusDiamonds = 0;

    if (totalRefs === 1) bonus = 50;
    if (totalRefs === 3) bonus = 200;
    if (totalRefs === 5) bonus = 500;
    if (totalRefs === 10) {
      bonus = 1000;
      bonusDiamonds = 50;
    }

    if (bonus > 0 || bonusDiamonds > 0) {
      await prisma.user.update({
        where: { id: refUser.id },
        data: {
          coins: { increment: bonus },
          diamonds: { increment: bonusDiamonds },
        },
      });
    }

    return res.json({
      ok: true,
      rewardYou,
      rewardRefCoins,
      rewardRefDiamonds,
      rewardRefPoints,
      bonus,
      bonusDiamonds,
      totalRefs,
    });
  } catch (e) {
    console.error("REF APPLY ERROR:", e);
    res.status(500).json({ error: "Server error" });
  }
});

// 🏆 ТОП РЕФЕРАЛІВ
router.get("/top", async (_req, res) => {
  try {
    const users = await prisma.user.findMany({
      include: {
        referrals: true,
      },
    });

    const sorted = users
      .map((u) => ({
        telegramId: u.telegramId,
        refs: u.referrals.length,
      }))
      .sort((a, b) => b.refs - a.refs)
      .slice(0, 10);

    return res.json({
      ok: true,
      top: sorted,
    });
  } catch (e) {
    console.error("REF TOP ERROR:", e);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
