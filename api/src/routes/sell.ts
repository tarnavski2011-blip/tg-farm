import { Router } from "express";
import { prisma } from "../prisma";
import type { TgAuthedRequest } from "../middleware/telegramAuth";
import { ECONOMY } from "../config/economy";

const router = Router();

router.post("/all", async (req: TgAuthedRequest, res) => {
  if (!req.telegramUser!.id)
    return res.status(401).json({ error: "Unauthorized" });
  const telegramId = BigInt(req.telegramUser!.id);
  const user = await prisma.user.findUnique({
    where: { telegramId },
    select: { id: true },
  });
  if (!user) return res.status(404).json({ error: "User not found" });

  const storage = await prisma.storage.findUnique({
    where: { userId: user.id },
  });
  if (!storage) return res.status(404).json({ error: "Storage not found" });

  const earned =
    storage.eggs * ECONOMY.sell.egg +
    storage.wool * ECONOMY.sell.wool +
    storage.milk * ECONOMY.sell.milk;
  if (earned <= 0) return res.json({ ok: true, earned: 0 });

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data: {
        coins: { increment: earned },
        xp: { increment: Math.max(1, Math.floor(earned / 25)) },
      },
    });
    await tx.storage.update({
      where: { userId: user.id },
      data: { eggs: 0, wool: 0, milk: 0 },
    });
  });

  return res.json({ ok: true, earned });
});

export default router;
