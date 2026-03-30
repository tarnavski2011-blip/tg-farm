import { Router } from "express";
import { prisma } from "../prisma";
import type { TgAuthedRequest } from "../middleware/telegramAuth";

const router = Router();

// отримати дані
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
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Server error" });
  }
});

// застосувати код
router.post("/apply", async (req: TgAuthedRequest, res) => {
  try {
    if (!req.telegramUser?.id) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const telegramId = BigInt(req.telegramUser.id);
    const code = String(req.body?.code ?? "");

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

    if (user.referredById) {
      return res.status(400).json({ error: "Already has referral" });
    }

    const refUser = await prisma.user.findUnique({
      where: { telegramId: BigInt(code) },
    });

    if (!refUser) {
      return res.status(404).json({ error: "Ref not found" });
    }

    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { referredById: refUser.id },
      }),
      prisma.referral.create({
        data: {
          referrerId: refUser.id,
          referredId: user.id,
        },
      }),
      prisma.user.update({
        where: { id: refUser.id },
        data: { coins: { increment: 200 } },
      }),
      prisma.user.update({
        where: { id: user.id },
        data: { coins: { increment: 100 } },
      }),
    ]);

    res.json({
      ok: true,
      reward: 100,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
