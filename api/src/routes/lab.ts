import { Router } from "express";
import { prisma } from "../prisma";
import type { TgAuthedRequest } from "../middleware/telegramAuth";

const router = Router();

function getLabUpgradeCost(level: number) {
  switch (level) {
    case 1:
      return 1000;
    case 2:
      return 3000;
    case 3:
      return 10000;
    case 4:
      return 50000;
    default:
      return 100000;
  }
}

function getNextMultiplier(level: number) {
  switch (level) {
    case 1:
      return 1.2;
    case 2:
      return 1.5;
    case 3:
      return 2;
    case 4:
      return 3;
    default:
      return 3;
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
      },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    return res.json({
      ok: true,
      level: user.labLevel,
      multiplier: user.labMultiplier,
      coins: user.coins,
      nextCost: getLabUpgradeCost(user.labLevel),
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
        labLevel: true,
        labMultiplier: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const cost = getLabUpgradeCost(user.labLevel);
    const nextMultiplier = getNextMultiplier(user.labLevel);

    if (user.coins < cost) {
      return res.status(400).json({
        error: "Not enough coins",
        need: cost,
        have: user.coins,
      });
    }

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        coins: { decrement: cost },
        labLevel: { increment: 1 },
        labMultiplier: nextMultiplier,
      },
      select: {
        coins: true,
        labLevel: true,
        labMultiplier: true,
      },
    });

    return res.json({
      ok: true,
      coins: updated.coins,
      level: updated.labLevel,
      multiplier: updated.labMultiplier,
    });
  } catch (e) {
    console.error("LAB UPGRADE ERROR:", e);
    return res.status(500).json({ error: "Server error" });
  }
});

export default router;
