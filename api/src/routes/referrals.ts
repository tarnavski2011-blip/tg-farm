import { Router } from "express";
import { prisma } from "../prisma";
import type { TgAuthedRequest } from "../middleware/telegramAuth";

const router = Router();

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

    return res.json({
      ok: true,
      myCode: String(user.telegramId),
      totalRefs: user.referrals.length,
      refs: user.referrals.map((r) => ({
        id: r.id,
        createdAt: r.createdAt,
      })),
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

    const telegramId = BigInt(req.telegramUser.id);
    const code = String(req.body?.code ?? "").trim();

    if (!code) {
      return res.status(400).json({ error: "Code required" });
    }

    if (code === String(telegramId)) {
      return res.status(400).json({ error: "Cannot refer yourself" });
    }

    const user = await prisma.user.findUnique({
      where: { telegramId },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const refUser = await prisma.user.findUnique({
      where: { telegramId: BigInt(code) },
    });

    if (!refUser) {
      return res.status(404).json({ error: "Ref user not found" });
    }

    // перевірка: цього користувача вже хтось запросив?
    const already = await prisma.referral.findFirst({
      where: {
        referredId: user.id,
      },
    });

    if (already) {
      return res.status(400).json({ error: "Already referred" });
    }

    await prisma.$transaction([
      prisma.referral.create({
        data: {
          referrerId: refUser.id,
          referredId: user.id,
        } as any,
      }),
      prisma.user.update({
        where: { id: refUser.id },
        data: {
          coins: { increment: 200 },
        },
      }),
      prisma.user.update({
        where: { id: user.id },
        data: {
          coins: { increment: 100 },
        },
      }),
    ]);

    return res.json({
      ok: true,
      rewardYou: 100,
      rewardRef: 200,
    });
  } catch (e) {
    console.error("REF APPLY ERROR:", e);
    return res.status(500).json({ error: "Server error" });
  }
});

export default router;
