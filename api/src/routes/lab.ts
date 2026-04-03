import { Router } from "express";
import { prisma } from "../prisma";
import type { TgAuthedRequest } from "../middleware/telegramAuth";

const router = Router();

function getLabUpgradeCost(level: number) {
  switch (level) {
    case 1:
      return { coins: 1000, diamonds: 0 };
    case 2:
      return { coins: 3000, diamonds: 0 };
    case 3:
      return { coins: 10000, diamonds: 10 };
    case 4:
      return { coins: 25000, diamonds: 25 };
    case 5:
      return { coins: 60000, diamonds: 50 };
    default:
      return { coins: 100000, diamonds: 75 };
  }
}

function getNextMultiplier(level: number) {
  switch (level) {
    case 1:
      return 1.2;
    case 2:
      return 1.5;
    case 3:
      return 2.0;
    case 4:
      return 2.5;
    case 5:
      return 3.0;
    default:
      return 3.0;
  }
}

router.get("/", async (req: TgAuthedRequest, res) => {
  try {
    if (!req.telegramUser?.id) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const telegramId = BigInt(req.telegramUser.id);

    const user = await prisma.user.findUnique({
      where: { telegramId },
      select: {
        labLevel: true,
        labMultiplier: true,
        coins: true,
        diamonds: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const nextCost = getLabUpgradeCost(user.labLevel);

    return res.json({
      ok: true,
      level: user.labLevel,
      multiplier: user.labMultiplier,
      coins: user.coins,
      diamonds: user.diamonds,
      nextCostCoins: nextCost.coins,
      nextCostDiamonds: nextCost.diamonds,
      nextMultiplier: getNextMultiplier(user.labLevel),
    });
  } catch (e) {
    console.error("LAB GET ERROR:", e);
    return res.status(500).json({ error: "Server error" });
  }
});

router.post("/upgrade", async (req: TgAuthedRequest, res) => {
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
        labLevel: true,
        labMultiplier: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const cost = getLabUpgradeCost(user.labLevel);
    const nextMultiplier = getNextMultiplier(user.labLevel);

    if (user.coins < cost.coins) {
      return res.status(400).json({
        error: "Not enough coins",
        needCoins: cost.coins,
        haveCoins: user.coins,
      });
    }

    if (user.diamonds < cost.diamonds) {
      return res.status(400).json({
        error: "Not enough diamonds",
        needDiamonds: cost.diamonds,
        haveDiamonds: user.diamonds,
      });
    }

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        coins: { decrement: cost.coins },
        diamonds: { decrement: cost.diamonds },
        labLevel: { increment: 1 },
        labMultiplier: nextMultiplier,
      },
      select: {
        coins: true,
        diamonds: true,
        labLevel: true,
        labMultiplier: true,
      },
    });

    return res.json({
      ok: true,
      coins: updated.coins,
      diamonds: updated.diamonds,
      level: updated.labLevel,
      multiplier: updated.labMultiplier,
    });
  } catch (e) {
    console.error("LAB UPGRADE ERROR:", e);
    return res.status(500).json({ error: "Server error" });
  }
});

export default router;
