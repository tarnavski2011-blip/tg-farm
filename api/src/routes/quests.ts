import { Router } from "express";
import { prisma } from "../prisma";
import type { TgAuthedRequest } from "../middleware/telegramAuth";
import { AnimalType } from "@prisma/client";
import { resetDailyQuestProgressIfNeeded } from "../lib/questProgress";

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
  return new Date().toISOString().slice(0, 10);
}

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

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    await resetDailyQuestProgressIfNeeded(user.id, user.lastSeenAt);

    const freshUser = await prisma.user.findUnique({
      where: { id: user.id },
      include: {
        animals: true,
        achievementClaims: true,
        dailyQuestClaims: true,
      },
    });

    if (!freshUser) {
      return res.status(404).json({ error: "User not found" });
    }

    const today = getTodayKey();

    const chickenCount = freshUser.animals.filter(
      (a) => a.type === AnimalType.CHICKEN,
    ).length;
    const sheepCount = freshUser.animals.filter(
      (a) => a.type === AnimalType.SHEEP,
    ).length;
    const cowCount = freshUser.animals.filter(
      (a) => a.type === AnimalType.COW,
    ).length;

    const maxLevel = freshUser.animals.length
      ? Math.max(...freshUser.animals.map((a) => a.level))
      : 1;

    const dailyClaimed = freshUser.dailyQuestClaims
      .filter((q) => q.claimDate === today)
      .map((q) => q.code);

    const achievementClaimed = freshUser.achievementClaims
      .filter((q) => q.claimed)
      .map((q) => q.code);

    const quests: Quest[] = [
      {
        code: "tap_20",
        title: "Зроби 20 тапів",
        group: "daily",
        reward: 50,
        progress: freshUser.tapsToday,
        target: 20,
        done: freshUser.tapsToday >= 20,
        claimed: dailyClaimed.includes("tap_20"),
      },
      {
        code: "sell_once",
        title: "Продай ресурси",
        group: "daily",
        reward: 75,
        progress: freshUser.sellsToday,
        target: 1,
        done: freshUser.sellsToday >= 1,
        claimed: dailyClaimed.includes("sell_once"),
      },
      {
        code: "buy_feed",
        title: "Купи корм",
        group: "daily",
        reward: 50,
        progress: freshUser.feedBuysToday,
        target: 1,
        done: freshUser.feedBuysToday >= 1,
        claimed: dailyClaimed.includes("buy_feed"),
      },

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
        done: freshUser.coins >= 1000,
        claimed: achievementClaimed.includes("rich_1000"),
      },
      {
        code: "warehouse_lvl2",
        title: "Покращ склад до LVL 2",
        group: "achievement",
        reward: 250,
        done: (freshUser.warehouseLevel ?? 1) >= 2,
        claimed: achievementClaimed.includes("warehouse_lvl2"),
      },
    ];

    return res.json({ ok: true, quests });
  } catch (e) {
    console.error("QUESTS ERROR:", e);
    return res.status(500).json({ error: "Server error" });
  }
});

router.post("/claim", async (req: TgAuthedRequest, res) => {
  try {
    const telegramId = BigInt(req.telegramUser!.id);
    const { code } = req.body as { code?: string };

    if (!code) {
      return res.status(400).json({ error: "Quest code required" });
    }

    const user = await prisma.user.findUnique({
      where: { telegramId },
      include: {
        animals: true,
        achievementClaims: true,
        dailyQuestClaims: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    await resetDailyQuestProgressIfNeeded(user.id, user.lastSeenAt);

    const freshUser = await prisma.user.findUnique({
      where: { id: user.id },
      include: {
        animals: true,
        achievementClaims: true,
        dailyQuestClaims: true,
      },
    });

    if (!freshUser) {
      return res.status(404).json({ error: "User not found" });
    }

    const today = getTodayKey();

    const chickenCount = freshUser.animals.filter(
      (a) => a.type === AnimalType.CHICKEN,
    ).length;
    const sheepCount = freshUser.animals.filter(
      (a) => a.type === AnimalType.SHEEP,
    ).length;
    const cowCount = freshUser.animals.filter(
      (a) => a.type === AnimalType.COW,
    ).length;

    const maxLevel = freshUser.animals.length
      ? Math.max(...freshUser.animals.map((a) => a.level))
      : 1;

    const rewardMap: Record<
      string,
      { reward: number; done: boolean; daily: boolean }
    > = {
      tap_20: {
        reward: 50,
        done: freshUser.tapsToday >= 20,
        daily: true,
      },
      sell_once: {
        reward: 75,
        done: freshUser.sellsToday >= 1,
        daily: true,
      },
      buy_feed: {
        reward: 50,
        done: freshUser.feedBuysToday >= 1,
        daily: true,
      },

      buy_chicken: {
        reward: 100,
        done: chickenCount >= 1,
        daily: false,
      },
      buy_sheep: {
        reward: 150,
        done: sheepCount >= 1,
        daily: false,
      },
      buy_cow: {
        reward: 250,
        done: cowCount >= 1,
        daily: false,
      },

      upgrade: {
        reward: 200,
        done: maxLevel > 1,
        daily: false,
      },
      rich_1000: {
        reward: 300,
        done: freshUser.coins >= 1000,
        daily: false,
      },
      warehouse_lvl2: {
        reward: 250,
        done: (freshUser.warehouseLevel ?? 1) >= 2,
        daily: false,
      },
    };

    const quest = rewardMap[code];

    if (!quest) {
      return res.status(400).json({ error: "Invalid quest" });
    }

    if (!quest.done) {
      return res.status(400).json({ error: "Quest not completed" });
    }

    if (quest.daily) {
      const already = await prisma.dailyQuestClaim.findUnique({
        where: {
          userId_code_claimDate: {
            userId: freshUser.id,
            code,
            claimDate: today,
          },
        },
      });

      if (already) {
        return res.status(400).json({ error: "Already claimed today" });
      }

      await prisma.$transaction([
        prisma.user.update({
          where: { id: freshUser.id },
          data: {
            coins: { increment: quest.reward },
          },
        }),
        prisma.dailyQuestClaim.create({
          data: {
            userId: freshUser.id,
            code,
            claimDate: today,
          },
        }),
      ]);
    } else {
      const already = await prisma.achievementClaim.findUnique({
        where: {
          userId_code: {
            userId: freshUser.id,
            code,
          },
        },
      });

      if (already?.claimed) {
        return res.status(400).json({ error: "Already claimed" });
      }

      await prisma.$transaction([
        prisma.user.update({
          where: { id: freshUser.id },
          data: {
            coins: { increment: quest.reward },
          },
        }),
        prisma.achievementClaim.upsert({
          where: {
            userId_code: {
              userId: freshUser.id,
              code,
            },
          },
          update: {
            claimed: true,
            claimedAt: new Date(),
          },
          create: {
            userId: freshUser.id,
            code,
            claimed: true,
            claimedAt: new Date(),
          },
        }),
      ]);
    }

    return res.json({ ok: true, reward: quest.reward });
  } catch (e) {
    console.error("QUEST CLAIM ERROR:", e);
    return res.status(500).json({ error: "Server error" });
  }
});

export default router;
