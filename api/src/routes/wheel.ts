import { Router } from "express";
import { prisma } from "../prisma";
import type { TgAuthedRequest } from "../middleware/telegramAuth";

const router = Router();

function isSameDay(a?: Date | null, b?: Date | null) {
  if (!a || !b) return false;
  return a.toDateString() === b.toDateString();
}

// можливі нагороди
const REWARDS = [
  { type: "coins", amount: 50 },
  { type: "coins", amount: 100 },
  { type: "coins", amount: 200 },
  { type: "diamonds", amount: 5 },
  { type: "diamonds", amount: 10 },
  { type: "nothing", amount: 0 },
];

function getRandomReward() {
  const index = Math.floor(Math.random() * REWARDS.length);
  return REWARDS[index];
}

router.post("/spin", async (req: TgAuthedRequest, res) => {
  try {
    if (!req.telegramUser?.id) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const telegramId = BigInt(req.telegramUser.id);

    const user = await prisma.user.findUnique({
      where: { telegramId },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // 1 раз в день
    if (isSameDay(user.lastWheelSpinAt, new Date())) {
      return res.status(400).json({
        error: "Already spun today",
      });
    }

    const reward = getRandomReward();

    let updateData: any = {
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
    });

    return res.json({
      ok: true,
      reward,
      coins: updated.coins,
      diamonds: updated.diamonds,
    });
  } catch (e) {
    console.error("WHEEL ERROR:", e);
    return res.status(500).json({ error: "Server error" });
  }
});

export default router;
