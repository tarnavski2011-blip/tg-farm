import { Router } from "express";
import type { TgAuthedRequest } from "../middleware/telegramAuth";
import { prisma } from "../prisma";

const router = Router();

function warehouseUpgradeCost(level: number) {
  return 1000 * level;
}

function labUpgradeCost(level: number) {
  return 1500 * level;
}

router.post("/warehouse", async (req: TgAuthedRequest, res) => {
  if (!req.telegramUser!.id)
    return res.status(401).json({ error: "Unauthorized" });

  const telegramId = BigInt(req.telegramUser!.id);
  const user = await prisma.user.findUnique({ where: { telegramId } });
  if (!user) return res.status(404).json({ error: "user not found" });

  const cost = warehouseUpgradeCost(user.warehouseLevel);
  if (user.coins < cost) {
    return res
      .status(400)
      .json({ error: "Not enough coins", need: cost, have: user.coins });
  }

  const updated = await prisma.user.update({
    where: { telegramId },
    data: { coins: { decrement: cost }, warehouseLevel: { increment: 1 } },
  });

  return res.json({
    ok: true,
    cost,
    coins: updated.coins,
    warehouseLevel: updated.warehouseLevel,
  });
});

router.post("/lab", async (req: TgAuthedRequest, res) => {
  if (!req.telegramUser!.id)
    return res.status(401).json({ error: "Unauthorized" });

  const telegramId = BigInt(req.telegramUser!.id);
  const user = await prisma.user.findUnique({ where: { telegramId } });
  if (!user) return res.status(404).json({ error: "user not found" });

  const cost = labUpgradeCost(user.labLevel);
  if (user.coins < cost) {
    return res
      .status(400)
      .json({ error: "Not enough coins", need: cost, have: user.coins });
  }

  const updated = await prisma.user.update({
    where: { telegramId },
    data: { coins: { decrement: cost }, labLevel: { increment: 1 } },
  });

  return res.json({
    ok: true,
    cost,
    coins: updated.coins,
    labLevel: updated.labLevel,
  });
});

export default router;
