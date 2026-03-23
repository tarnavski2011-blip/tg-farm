import { Router } from "express";
import { prisma } from "../prisma";
import type { TgAuthedRequest } from "../middleware/telegramAuth";
import { ECONOMY } from "../config/economy";

const router = Router();

router.post("/buy", async (req: TgAuthedRequest, res) => {
  if (!req.telegramUser!.id)
    return res.status(401).json({ error: "Unauthorized" });
  const type = String(req.body?.type ?? "")
    .trim()
    .toUpperCase() as keyof typeof ECONOMY.animals;
  if (!ECONOMY.animals[type])
    return res.status(400).json({ error: "Unknown animal type" });

  const telegramId = BigInt(req.telegramUser!.id);
  const user = await prisma.user.findUnique({
    where: { telegramId },
    select: { id: true, coins: true },
  });
  if (!user) return res.status(404).json({ error: "User not found" });

  const price = ECONOMY.animals[type].buyPrice;
  if (user.coins < price)
    return res.status(400).json({ error: "Not enough coins" });

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data: { coins: { decrement: price }, xp: { increment: 5 } },
    });
    await tx.animal.create({ data: { userId: user.id, type, level: 1 } });
  });

  return res.json({ ok: true, type, pricePaid: price });
});

export default router;
