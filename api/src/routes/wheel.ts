import { Router } from "express";
import { prisma } from "../prisma";
import type { TgAuthedRequest } from "../middleware/telegramAuth";

const router = Router();

function isSameDay(a?: Date | null, b?: Date | null) {
  if (!a || !b) return false;
  return a.toDateString() === b.toDateString();
}

const REWARDS = [
  { type: "coins", amount: 50, label: "50 coins" },
  { type: "coins", amount: 100, label: "100 coins" },
  { type: "coins", amount: 200, label: "200 coins" },
  { type: "diamonds", amount: 5, label: "5 diamonds" },
  { type: "diamonds", amount: 10, label: "10 diamonds" },
  { type: "nothing", amount: 0, label: "Nothing" },
] as const;

function getRandomReward() {
  const index = Math.floor(Math.random() * REWARDS.length);
  return REWARDS[index];
}

router.get("/state", async (req: TgAuthedRequest, res) => {
  try {
    if (!req.telegramUser?.id) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const telegramId = BigInt(req.telegramUser.id);

    const user = await prisma.user.findUnique({
      where: { telegramId },
      select: {
        lastWheelSpinAt: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const now = new Date();
    let cooldownSec = 0;

    if (user.lastWheelSpinAt && isSameDay(user.lastWheelSpinAt, now)) {
      const tomorrow = new Date(now);
      tomorrow.setHours(24, 0, 0, 0);

      cooldownSec = Math.max(
        0,
        Math.floor((tomorrow.getTime() - now.getTime()) / 1000),
      );
    }

    return res.json({
      ok: true,
      rewards: REWARDS.map((r) => ({
        type: r.type,
        amount: r.amount,
        label: r.label,
      })),
      cooldownSec,
      costDiamonds: 0,
    });
  } catch (e) {
    console.error("WHEEL STATE ERROR:", e);
    return res.status(500).json({ error: "Server error" });
  }
});

router.post("/spin", async (req: TgAuthedRequest, res) => {
  try {
    if (!req.telegramUser?.id) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const telegramId = BigInt(req.telegramUser.id);

    const user = await prisma.user.findUnique({
      where: { telegramId },
      select: {
        id: true,
        coins: true,
        diamonds: true,
        lastWheelSpinAt: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (isSameDay(user.lastWheelSpinAt, new Date())) {
      return res.status(400).json({
        error: "Already spun today",
      });
    }

    const reward = getRandomReward();

    const updateData: {
      lastWheelSpinAt: Date;
      coins?: { increment: number };
      diamonds?: { increment: number };
    } = {
      lastWheelSpinAt: new Date(),
    };

    if (reward.type === "coins") {
      updateData.coins = { increment: reward.amount };
    }

    if (reward.type === "diamonds") {
      updateData.diamonds = { increment: reward.amount };
    }

    const updated = await prisma.user.update({
      where: { telegramId },
      data: updateData,
      select: {
        coins: true,
        diamonds: true,
        lastWheelSpinAt: true,
      },
    });

    return res.json({
      ok: true,
      reward: reward, // 🔥 головне
      coins: updated.coins,
      diamonds: updated.diamonds,
    });
  } catch (e) {
    console.error("WHEEL SPIN ERROR:", e);
    return res.status(500).json({ error: "Server error" });
  }
});

export default router;
