import { Router } from "express";
import { prisma } from "../prisma";
import type { TgAuthedRequest } from "../middleware/telegramAuth";

const router = Router();

const NEW_USER_BONUS_COINS = 100;
const REFERRER_BONUS_COINS = 50;
const REFERRER_BONUS_POINTS = 25;

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

    return res.json({
      ok: true,
      myCode: makeRefCode(user.id),
      totalRefs,
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

    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: {
          coins: { increment: NEW_USER_BONUS_COINS },
          referredById: referrer.id,
        },
      }),
      prisma.user.update({
        where: { id: referrer.id },
        data: {
          coins: { increment: REFERRER_BONUS_COINS },
          points: { increment: REFERRER_BONUS_POINTS },
        },
      }),
      prisma.referral.create({
        data: {
          referrerId: referrer.id,
          referredId: user.id,
        },
      }),
    ]);

    return res.json({
      ok: true,
      rewardYou: NEW_USER_BONUS_COINS,
      rewardReferrer: {
        coins: REFERRER_BONUS_COINS,
        points: REFERRER_BONUS_POINTS,
      },
    });
  } catch (e) {
    console.error("REFERRALS APPLY ERROR:", e);
    return res.status(500).json({ error: "Server error" });
  }
});

export default router;
