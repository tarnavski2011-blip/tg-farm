import { Router } from "express";
import { prisma } from "../prisma";
import type { TgAuthedRequest } from "../middleware/telegramAuth";

const router = Router();

function getTodayKey() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getQuestList(user: {
  coins: number;
  dailyStreak: number;
  animals: { type: string }[];
}) {
  const chickenCount = user.animals.filter((a) => a.type === "CHICKEN").length;

  return [
    {
      code: "tap_master",
      title: "Зароби 100 монет",
      done: user.coins >= 100,
      reward: 50,
    },
    {
      code: "first_chicken",
      title: "Купи 1 курку",
      done: chickenCount >= 1,
      reward: 75,
    },
    {
      code: "daily_player",
      title: "Забери daily reward",
      done: user.dailyStreak >= 1,
      reward: 100,
    },
  ];
}

router.get("/", async (req: TgAuthedRequest, res) => {
  try {
    if (!req.telegramUser?.id) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const telegramId = BigInt(req.telegramUser.id);
    const today = getTodayKey();

    const user = await prisma.user.findUnique({
      where: { telegramId },
      include: {
        animals: true,
        dailyQuestClaims: {
          where: { claimDate: today },
        },
      },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const quests = getQuestList(user).map((q) => ({
      ...q,
      claimed: user.dailyQuestClaims.some((c) => c.code === q.code),
    }));

    return res.json({
      ok: true,
      quests,
      date: today,
    });
  } catch (e) {
    console.error("QUESTS GET ERROR:", e);
    return res.status(500).json({ error: "Server error" });
  }
});

router.post("/claim", async (req: TgAuthedRequest, res) => {
  try {
    if (!req.telegramUser?.id) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const code = String(req.body?.code ?? "").trim();
    if (!code) {
      return res.status(400).json({ error: "Quest code required" });
    }

    const telegramId = BigInt(req.telegramUser.id);
    const today = getTodayKey();

    const user = await prisma.user.findUnique({
      where: { telegramId },
      include: {
        animals: true,
        dailyQuestClaims: {
          where: { claimDate: today },
        },
      },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const quest = getQuestList(user).find((q) => q.code === code);

    if (!quest) {
      return res.status(404).json({ error: "Quest not found" });
    }

    if (!quest.done) {
      return res.status(400).json({ error: "Quest not completed" });
    }

    const alreadyClaimed = user.dailyQuestClaims.some((c) => c.code === code);
    if (alreadyClaimed) {
      return res.status(400).json({ error: "Already claimed" });
    }

    await prisma.$transaction([
      prisma.dailyQuestClaim.create({
        data: {
          userId: user.id,
          code,
          claimDate: today,
        },
      }),
      prisma.user.update({
        where: { id: user.id },
        data: {
          coins: { increment: quest.reward },
        },
      }),
    ]);

    return res.json({
      ok: true,
      code,
      reward: quest.reward,
    });
  } catch (e) {
    console.error("QUEST CLAIM ERROR:", e);
    return res.status(500).json({ error: "Server error" });
  }
});

export default router;
