import { Router } from "express";
import { prisma } from "../prisma";
import type { TgAuthedRequest } from "../middleware/telegramAuth";
import { ECONOMY } from "../config/economy";

const router = Router();

router.post("/", async (req: TgAuthedRequest, res) => {
  if (!req.tgUserId) return res.status(401).json({ error: "Unauthorized" });
  const telegramId = BigInt(req.tgUserId);
  const user = await prisma.user.findUnique({
    where: { telegramId },
    select: { id: true, coins: true, feedUntil: true },
  });
  if (!user) return res.status(404).json({ error: "User not found" });
  if (user.coins < ECONOMY.feed.priceCoins)
    return res.status(400).json({ error: "Not enough coins" });

  const now = new Date();
  const base = user.feedUntil && user.feedUntil > now ? user.feedUntil : now;
  const nextFeedUntil = new Date(
    base.getTime() + ECONOMY.feed.durationMinutes * 60 * 1000,
  );

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      coins: { decrement: ECONOMY.feed.priceCoins },
      feedUntil: nextFeedUntil,
      feedActivatedAt: now,
      xp: { increment: 2 },
    },
    select: { coins: true, feedUntil: true },
  });

  return res.json({
    ok: true,
    coins: updated.coins,
    feedUntil: updated.feedUntil,
    durationMinutes: ECONOMY.feed.durationMinutes,
  });
});

export default router;
