import { Router } from "express";
import { prisma } from "../prisma";
import type { TgAuthedRequest } from "../middleware/telegramAuth";
import { AnimalType } from "@prisma/client";

const router = Router();

type QuestGroup = "daily" | "progress" | "achievement";

type Quest = {
  code: string;
  title: string;
  group: QuestGroup;
  reward: number;
  done: boolean;
  claimed: boolean;
  progress?: number;
  target?: number;
};

function getTodayKey() {
  const now = new Date();
  return now.toISOString().slice(0, 10);
}

// =======================
// GET QUESTS
// =======================
router.get("/", async (req: TgAuthedRequest, res) => {
  try {
    const telegramId = BigInt(req.telegramUser!.id);

    const user = await prisma.user.findUnique({
      where: { telegramId },
      include: {
        animals: true,
        achievementClaims: true,
        dailyQuestClaims: true,
      },
    });

    if (!user) return res.status(404).json({ error: "User not found" });

    const today = getTodayKey();

    // ===== counts =====
    const chickenCount = user.animals.filter(
      (a) => a.type === AnimalType.CHICKEN,
    ).length;
    const sheepCount = user.animals.filter(
      (a) => a.type === AnimalType.SHEEP,
    ).length;
    const cowCount = user.animals.filter(
      (a) => a.type === AnimalType.COW,
    ).length;

    const maxLevel = user.animals.length
      ? Math.max(...user.animals.map((a) => a.level))
      : 1;

    // ===== claimed =====
    const dailyClaimed = user.dailyQuestClaims
      .filter((q) => q.claimDate === today)
      .map((q) => q.code);

    const achievementClaimed = user.achievementClaims
      .filter((a) => a.claimed)
      .map((a) => a.code);

    // ================= QUESTS =================
    const quests: Quest[] = [
      // ===== DAILY =====
      {
        code: "tap_20",
        title: "Зроби 20 тапів",
        group: "daily",
        reward: 50,
        progress: user.tapsToday,
        target: 20,
        done: user.tapsToday >= 20,
        claimed: dailyClaimed.includes("tap_20"),
      },
      {
        code: "sell_once",
        title: "Продай ресурси",
        group: "daily",
        reward: 75,
        progress: user.sellsToday,
        target: 1,
        done: user.sellsToday >= 1,
        claimed: dailyClaimed.includes("sell_once"),
      },
      {
        code: "buy_feed",
        title: "Купи корм",
        group: "daily",
        reward: 50,
        progress: user.feedBuysToday,
        target: 1,
        done: user.feedBuysToday >= 1,
        claimed: dailyClaimed.includes("buy_feed"),
      },

      // ===== PROGRESS =====
      {
        code: "buy_chicken",
        title: "Купи курку",
        group: "progress",
        reward: 100,
        done: chickenCount >= 1,
        claimed: achievementClaimed.includes("buy_chicken"),
      },
      {
        code: "buy_sheep",
        title: "Купи вівцю",
        group: "progress",
        reward: 150,
        done: sheepCount >= 1,
        claimed: achievementClaimed.includes("buy_sheep"),
      },
      {
        code: "buy_cow",
        title: "Купи корову",
        group: "progress",
        reward: 250,
        done: cowCount >= 1,
        claimed: achievementClaimed.includes("buy_cow"),
      },

      // ===== ACHIEVEMENTS =====
      {
        code: "upgrade",
        title: "Прокачай тварину",
        group: "achievement",
        reward: 200,
        done: maxLevel > 1,
        claimed: achievementClaimed.includes("upgrade"),
      },
      {
        code: "rich_1000",
        title: "Накопич 1000 монет",
        group: "achievement",
        reward: 300,
        done: user.coins >= 1000,
        claimed: achievementClaimed.includes("rich_1000"),
      },
      {
        code: "warehouse_lvl2",
        title: "Покращ склад до LVL 2",
        group: "achievement",
        reward: 250,
        done: (user.warehouseLevel ?? 1) >= 2,
        claimed: achievementClaimed.includes("warehouse_lvl2"),
      },
    ];

    return res.json({ ok: true, quests });
  } catch (e) {
    console.error("QUESTS ERROR:", e);
    return res.status(500).json({ error: "Server error" });
  }
});

// =======================
// CLAIM QUEST
// =======================
router.post("/claim", async (req: TgAuthedRequest, res) => {
  try {
    const telegramId = BigInt(req.telegramUser!.id);
    const { code } = req.body;

    const user = await prisma.user.findUnique({
      where: { telegramId },
    });

    if (!user) return res.status(404).json({ error: "User not found" });

    const today = getTodayKey();

    const rewards: Record<string, number> = {
      tap_20: 50,
      sell_once: 75,
      buy_feed: 50,
      buy_chicken: 100,
      buy_sheep: 150,
      buy_cow: 250,
      upgrade: 200,
      rich_1000: 300,
      warehouse_lvl2: 250,
    };

    const reward = rewards[code];
    if (!reward) {
      return res.status(400).json({ error: "Invalid quest" });
    }

    // DAILY
    const isDaily = ["tap_20", "sell_once", "buy_feed"].includes(code);

    if (isDaily) {
      const existing = await prisma.dailyQuestClaim.findFirst({
        where: {
          userId: user.id,
          code,
          claimDate: today,
        },
      });

      if (existing) {
        return res.status(400).json({ error: "Already claimed today" });
      }

      await prisma.$transaction([
        prisma.user.update({
          where: { id: user.id },
          data: {
            coins: { increment: reward },
          },
        }),
        prisma.dailyQuestClaim.create({
          data: {
            userId: user.id,
            code,
            claimDate: today,
          },
        }),
      ]);
    } else {
      // ACHIEVEMENT / PROGRESS
      const existing = await prisma.achievementClaim.findFirst({
        where: {
          userId: user.id,
          code,
        },
      });

      if (existing?.claimed) {
        return res.status(400).json({ error: "Already claimed" });
      }

      await prisma.$transaction([
        prisma.user.update({
          where: { id: user.id },
          data: {
            coins: { increment: reward },
          },
        }),
        prisma.achievementClaim.upsert({
          where: {
            userId_code: {
              userId: user.id,
              code,
            },
          },
          update: {
            claimed: true,
            claimedAt: new Date(),
          },
          create: {
            userId: user.id,
            code,
            claimed: true,
            claimedAt: new Date(),
          },
        }),
      ]);
    }

    return res.json({ ok: true, reward });
  } catch (e) {
    console.error("QUEST CLAIM ERROR:", e);
    return res.status(500).json({ error: "Server error" });
  }
});

export default router;
