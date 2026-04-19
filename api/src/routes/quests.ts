import { Router } from "express";
import { prisma } from "../prisma";
import type { TgAuthedRequest } from "../middleware/telegramAuth";

const router = Router();

function isToday(date: Date) {
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

router.get("/", async (req: TgAuthedRequest, res) => {
  try {
    const telegramId = BigInt(req.telegramUser!.id);

    const user = await prisma.user.findUnique({
      where: { telegramId },
      include: {
        animals: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const claimedCodes: string[] = ((user as any).claimedQuests ??
      []) as string[];
    const animals = (user.animals ?? []) as Array<{
      type: string;
      level: number;
    }>;

    const chickenCount = animals.filter((a) => a.type === "CHICKEN").length;
    const sheepCount = animals.filter((a) => a.type === "SHEEP").length;
    const cowCount = animals.filter((a) => a.type === "COW").length;

    const maxLevel = animals.length
      ? Math.max(...animals.map((a) => a.level))
      : 1;

    const referralCount = await prisma.referral.count({
      where: { referrerId: user.id },
    });

    const quests = [
      // ================= DAILY =================
      {
        code: "daily_claim",
        title: "Забери daily reward",
        group: "daily",
        reward: 100,
        done: !!user.lastDailyAt && isToday(user.lastDailyAt),
        claimed: claimedCodes.includes("daily_claim"),
      },
      {
        code: "daily_have_1_animal",
        title: "Май хоча б 1 тварину",
        group: "daily",
        reward: 50,
        done: chickenCount + sheepCount + cowCount >= 1,
        claimed: claimedCodes.includes("daily_have_1_animal"),
      },
      {
        code: "daily_earn_200",
        title: "Май 200 монет",
        group: "daily",
        reward: 75,
        done: (user.coins ?? 0) >= 200,
        claimed: claimedCodes.includes("daily_earn_200"),
      },

      // ================= PROGRESS =================
      {
        code: "earn_100",
        title: "Зароби 100 монет",
        group: "progress",
        reward: 50,
        done: (user.coins ?? 0) >= 100,
        claimed: claimedCodes.includes("earn_100"),
      },
      {
        code: "buy_chicken",
        title: "Купи 1 курку",
        group: "progress",
        reward: 75,
        done: chickenCount >= 1,
        claimed: claimedCodes.includes("buy_chicken"),
      },
      {
        code: "buy_sheep",
        title: "Купи 1 вівцю",
        group: "progress",
        reward: 120,
        done: sheepCount >= 1,
        claimed: claimedCodes.includes("buy_sheep"),
      },
      {
        code: "buy_cow",
        title: "Купи 1 корову",
        group: "progress",
        reward: 200,
        done: cowCount >= 1,
        claimed: claimedCodes.includes("buy_cow"),
      },

      // ================= ACHIEVEMENTS =================
      {
        code: "upgrade_animal",
        title: "Зроби upgrade тварини",
        group: "achievement",
        reward: 150,
        done: maxLevel > 1,
        claimed: claimedCodes.includes("upgrade_animal"),
      },
      {
        code: "reach_1000",
        title: "Накопич 1000 монет",
        group: "achievement",
        reward: 300,
        done: (user.coins ?? 0) >= 1000,
        claimed: claimedCodes.includes("reach_1000"),
      },
      {
        code: "invite_friend",
        title: "Запроси друга",
        group: "achievement",
        reward: 200,
        done: referralCount >= 1,
        claimed: claimedCodes.includes("invite_friend"),
      },
      {
        code: "warehouse_lvl_2",
        title: "Покращ склад до LVL 2",
        group: "achievement",
        reward: 250,
        done: (user.warehouseLevel ?? 1) >= 2,
        claimed: claimedCodes.includes("warehouse_lvl_2"),
      },
    ];

    return res.json({ ok: true, quests });
  } catch (e) {
    console.error("QUESTS GET ERROR:", e);
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
      },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    let claimedCodes: string[] = ((user as any).claimedQuests ??
      []) as string[];

    if (claimedCodes.includes(code)) {
      return res.status(400).json({ error: "Already claimed" });
    }

    const animals = (user.animals ?? []) as Array<{
      type: string;
      level: number;
    }>;

    const chickenCount = animals.filter((a) => a.type === "CHICKEN").length;
    const sheepCount = animals.filter((a) => a.type === "SHEEP").length;
    const cowCount = animals.filter((a) => a.type === "COW").length;

    const maxLevel = animals.length
      ? Math.max(...animals.map((a) => a.level))
      : 1;

    const referralCount = await prisma.referral.count({
      where: { referrerId: user.id },
    });

    const rewardMap: Record<string, { reward: number; done: boolean }> = {
      daily_claim: {
        reward: 100,
        done: !!user.lastDailyAt && isToday(user.lastDailyAt),
      },
      daily_have_1_animal: {
        reward: 50,
        done: chickenCount + sheepCount + cowCount >= 1,
      },
      daily_earn_200: {
        reward: 75,
        done: (user.coins ?? 0) >= 200,
      },

      earn_100: {
        reward: 50,
        done: (user.coins ?? 0) >= 100,
      },
      buy_chicken: {
        reward: 75,
        done: chickenCount >= 1,
      },
      buy_sheep: {
        reward: 120,
        done: sheepCount >= 1,
      },
      buy_cow: {
        reward: 200,
        done: cowCount >= 1,
      },

      upgrade_animal: {
        reward: 150,
        done: maxLevel > 1,
      },
      reach_1000: {
        reward: 300,
        done: (user.coins ?? 0) >= 1000,
      },
      invite_friend: {
        reward: 200,
        done: referralCount >= 1,
      },
      warehouse_lvl_2: {
        reward: 250,
        done: (user.warehouseLevel ?? 1) >= 2,
      },
    };

    const quest = rewardMap[code];

    if (!quest) {
      return res.status(404).json({ error: "Quest not found" });
    }

    if (!quest.done) {
      return res.status(400).json({ error: "Quest not completed" });
    }

    claimedCodes = [...claimedCodes, code];

    await prisma.user.update({
      where: { id: user.id },
      data: {
        coins: { increment: quest.reward },
        claimedQuests: claimedCodes as any,
      },
    });

    return res.json({
      ok: true,
      reward: quest.reward,
    });
  } catch (e) {
    console.error("QUEST CLAIM ERROR:", e);
    return res.status(500).json({ error: "Server error" });
  }
});

export default router;
