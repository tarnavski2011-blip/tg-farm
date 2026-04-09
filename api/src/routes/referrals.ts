import { Router } from "express";
import { prisma } from "../prisma";
import type { TgAuthedRequest } from "../middleware/telegramAuth";

const router = Router();

// GET MY REFERRALS + STATS
router.get("/", async (req: TgAuthedRequest, res) => {
  try {
    if (!req.telegramUser?.id) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const telegramId = BigInt(req.telegramUser.id);

    const user = await prisma.user.findUnique({
      where: { telegramId },
      include: {
        referrals: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const referredIds = user.referrals.map((r) => r.referredId);

    let referredUsers: Array<{
      id: number;
      telegramId: bigint;
      coins: number | null;
      points: number | null;
    }> = [];

    if (referredIds.length > 0) {
      referredUsers = await prisma.user.findMany({
        where: {
          id: {
            in: referredIds,
          },
        },
        select: {
          id: true,
          telegramId: true,
          coins: true,
          points: true,
        },
      });
    }

    const userById = new Map(referredUsers.map((u) => [u.id, u]));

    let totalEarnedCoins = 0;
    let totalEarnedPoints = 0;

    for (const ru of referredUsers) {
      const coins = Number(ru.coins ?? 0);

      totalEarnedCoins += Math.floor(coins * 0.05);

      if (coins >= 100) totalEarnedPoints += 1;
      if (coins >= 1000) totalEarnedPoints += 2;
      if (coins >= 5000) totalEarnedPoints += 3;
      if (coins >= 10000) totalEarnedPoints += 5;
    }

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
        telegramId: userById.get(r.referredId)
          ? String(userById.get(r.referredId)!.telegramId)
          : "-",
        createdAt: r.createdAt,
      })),
    });
  } catch (e) {
    console.error("REFERRALS GET ERROR:", e);
    return res.status(500).json({ error: "Server error" });
  }
});

// APPLY REFERRAL (manual code input)
router.post("/apply", async (req: TgAuthedRequest, res) => {
  try {
    if (!req.telegramUser?.id) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const telegramId = BigInt(req.telegramUser.id);
    const code = String(req.body?.code ?? "").trim();

    if (!code) {
      return res.status(400).json({ error: "No code" });
    }

    if (code === String(telegramId)) {
      return res.status(400).json({ error: "Self ref" });
    }

    const user = await prisma.user.findUnique({
      where: { telegramId },
    });

    const refUser = await prisma.user.findUnique({
      where: { telegramId: BigInt(code) },
      include: { referrals: true },
    });

    if (!user || !refUser) {
      return res.status(404).json({ error: "User not found" });
    }

    const already = await prisma.referral.findFirst({
      where: { referredId: user.id },
    });

    if (already) {
      return res.status(400).json({ error: "Already referred" });
    }

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
    return res.status(500).json({ error: "Server error" });
  }
});

// TOP REFERRALS
router.get("/top", async (_req, res) => {
  try {
    const users = await prisma.user.findMany({
      include: {
        referrals: true,
      },
    });

    const sorted = users
      .map((u) => ({
        telegramId: String(u.telegramId),
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
    return res.status(500).json({ error: "Server error" });
  }
});

export default router;
