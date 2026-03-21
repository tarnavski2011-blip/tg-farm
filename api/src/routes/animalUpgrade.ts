import { Router } from "express";
import { prisma } from "../prisma";
import type { TgAuthedRequest } from "../middleware/telegramAuth";
import { upgradePrice } from "../config/economy";

const router = Router();

router.post("/", async (req: TgAuthedRequest, res) => {
  if (!req.tgUserId) return res.status(401).json({ error: "Unauthorized" });
  const type = String(req.body?.type ?? "")
    .trim()
    .toUpperCase() as "CHICKEN" | "SHEEP" | "COW";
  const telegramId = BigInt(req.tgUserId);

  const user = await prisma.user.findUnique({
    where: { telegramId },
    select: { id: true, coins: true },
  });
  if (!user) return res.status(404).json({ error: "User not found" });

  const animal = await prisma.animal.findFirst({
    where: { userId: user.id, type },
    orderBy: { level: "desc" },
  });
  if (!animal) return res.status(404).json({ error: "Animal not owned" });

  const price = upgradePrice(type, animal.level);
  if (user.coins < price)
    return res.status(400).json({ error: "Not enough coins" });

  const updated = await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data: { coins: { decrement: price }, xp: { increment: 3 } },
    });
    return await tx.animal.update({
      where: { id: animal.id },
      data: { level: { increment: 1 } },
      select: { level: true },
    });
  });

  return res.json({ ok: true, level: updated.level, pricePaid: price });
});

export default router;
