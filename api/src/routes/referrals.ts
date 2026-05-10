import { Router } from "express";
import { prisma } from "../prisma";
import type { TgAuthedRequest } from "../middleware/telegramAuth";

const router = Router();

const NEW_USER_BONUS_COINS = 1000;
const NEW_USER_BONUS_DIAMONDS = 10;
const REFERRER_BONUS_COINS = 500;
const REFERRER_BONUS_POINTS = 5000;
const REFERRER_BONUS_DIAMONDS = 5;

function makeRefCode(userId: number) {
  return `REF${userId}`;
}

function parseRefCode(code: string) {
  const cleaned = code.trim().toUpperCase();
  if (!cleaned.startsWith("REF")) return null;
  const rawId = cleaned.slice(3);
  if (!/^\d+$/.test(rawId)) return null;
  return Number(rawId);
}

router.get("/", async (req: TgAuthedRequest, res) => {
  try {
    if (!req.telegramUser?.id) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const telegramId = BigInt(req.telegramUser.id);

    const user = await prisma.user.findUnique({
      where: { telegramId },
      select: { id: true },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const totalRefs = await prisma.referral.count({
      where: { referrerId: user.id },
    });

    const earnedCoins = totalRefs * REFERRER_BONUS_COINS;
    const earnedPoints = totalRefs * REFERRER_BONUS_POINTS;

    const earnedDiamonds = totalRefs * REFERRER_BONUS_DIAMONDS;

    return res.json({
      ok: true,
      myCode: makeRefCode(user.id),
      totalRefs,
      earnedCoins,
      earnedPoints,
      earnedDiamonds,
      bonuses: {
        newUser: {
          coins: NEW_USER_BONUS_COINS,
          diamonds: NEW_USER_BONUS_DIAMONDS,
        },
        referrer: {
          coins: REFERRER_BONUS_COINS,
          points: REFERRER_BONUS_POINTS,
          diamonds: REFERRER_BONUS_DIAMONDS,
        },
      },
    });
  } catch (e) {
    console.error("REFERRALS GET ERROR:", e);
    return res.status(500).json({ error: "Server error" });
  }
});

router.post("/apply", async (req: TgAuthedRequest, res) => {
  try {
    if (!req.telegramUser?.id) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const code = String(req.body?.code ?? "").trim();
    const referrerId = parseRefCode(code);

    if (!referrerId) {
      return res.status(400).json({ error: "Невірний код" });
    }

    const telegramId = BigInt(req.telegramUser.id);

    const user = await prisma.user.findUnique({
      where: { telegramId },
      select: {
        id: true,
        referredById: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (user.id === referrerId) {
      return res.status(400).json({ error: "Не можна ввести свій код" });
    }

    const existingReferral = await prisma.referral.findUnique({
      where: { referredId: user.id },
      select: { id: true },
    });

    if (existingReferral || user.referredById) {
      return res
        .status(400)
        .json({ error: "Реферальний код вже застосований" });
    }

    const referrer = await prisma.user.findUnique({
      where: { id: referrerId },
      select: { id: true },
    });

    if (!referrer) {
      return res.status(404).json({ error: "Реферер не знайдений" });
    }

    const result = await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: {
          coins: { increment: NEW_USER_BONUS_COINS },
          diamonds: { increment: NEW_USER_BONUS_DIAMONDS },
          referredById: referrer.id,
        },
      });

      await tx.user.update({
        where: { id: referrer.id },
        data: {
          coins: { increment: REFERRER_BONUS_COINS },
          points: { increment: REFERRER_BONUS_POINTS },
          diamonds: { increment: REFERRER_BONUS_DIAMONDS },
        },
      });

      await tx.referral.create({
        data: {
          referrerId: referrer.id,
          referredId: user.id,
        },
      });

      const totalRefs = await tx.referral.count({
        where: { referrerId: referrer.id },
      });

      const milestoneReward: {
        diamonds: number;
        vipHours: number;
        label: string | null;
      } = {
        diamonds: 0,
        vipHours: 0,
        label: null,
      };

      if (totalRefs === 1) {
        milestoneReward.diamonds = 5;
        milestoneReward.label = "1 referral";
      }

      if (totalRefs === 5) {
        milestoneReward.diamonds = 25;
        milestoneReward.label = "5 referrals";
      }

      if (totalRefs === 10) {
        milestoneReward.vipHours = 24;
        milestoneReward.label = "10 referrals";
      }

      if (totalRefs === 25) {
        milestoneReward.diamonds = 100;
        milestoneReward.label = "25 referrals";
      }

      if (totalRefs === 50) {
        milestoneReward.vipHours = 24 * 7;
        milestoneReward.label = "50 referrals";
      }

      if (milestoneReward.diamonds > 0 || milestoneReward.vipHours > 0) {
        const updateData: {
          diamonds?: { increment: number };
          vipUntil?: Date;
        } = {};

        if (milestoneReward.diamonds > 0) {
          updateData.diamonds = { increment: milestoneReward.diamonds };
        }

        if (milestoneReward.vipHours > 0) {
          const currentReferrer = await tx.user.findUnique({
            where: { id: referrer.id },
            select: { vipUntil: true },
          });

          const now = new Date();
          const baseDate =
            currentReferrer?.vipUntil && currentReferrer.vipUntil > now
              ? currentReferrer.vipUntil
              : now;

          updateData.vipUntil = new Date(
            baseDate.getTime() + milestoneReward.vipHours * 60 * 60 * 1000,
          );
        }

        await tx.user.update({
          where: { id: referrer.id },
          data: updateData,
        });
      }

      return {
        totalRefs,
        milestoneReward,
      };
    });

    return res.json({
      ok: true,
      rewardYou: {
        coins: NEW_USER_BONUS_COINS,
        diamonds: NEW_USER_BONUS_DIAMONDS,
      },
      rewardReferrer: {
        coins: REFERRER_BONUS_COINS,
        points: REFERRER_BONUS_POINTS,
        diamonds: REFERRER_BONUS_DIAMONDS,
      },
      totalRefs: result.totalRefs,
      milestoneReward: result.milestoneReward,
    });
  } catch (e) {
    console.error("REFERRALS APPLY ERROR:", e);
    return res.status(500).json({ error: "Server error" });
  }
});

export default router;
