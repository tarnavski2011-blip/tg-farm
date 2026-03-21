import { Router } from "express";
import { prisma } from "../prisma";
import type { TgAuthedRequest } from "../middleware/telegramAuth";

const router = Router();

function secondsLeft(futureDate?: Date | null) {
  if (!futureDate) return 0;
  const diff = Math.floor((futureDate.getTime() - Date.now()) / 1000);
  return diff > 0 ? diff : 0;
}

router.get("/status", async (req: TgAuthedRequest, res) => {
  if (!req.tgUserId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const telegramId = BigInt(req.tgUserId);

  const user = await prisma.user.findUnique({
    where: { telegramId },
    select: {
      boostUntil: true,
      autoCollectUntil: true,
      vipUntil: true,
      feedUntil: true,
    },
  });

  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  return res.json({
    boost: {
      active: secondsLeft(user.boostUntil) > 0,
      leftSec: secondsLeft(user.boostUntil),
      label: "x2 Coins",
    },
    autoCollect: {
      active: secondsLeft(user.autoCollectUntil) > 0,
      leftSec: secondsLeft(user.autoCollectUntil),
      label: "Auto Collect",
    },
    vip: {
      active: secondsLeft(user.vipUntil) > 0,
      leftSec: secondsLeft(user.vipUntil),
      label: "VIP",
    },
    feed: {
      active: secondsLeft(user.feedUntil) > 0,
      leftSec: secondsLeft(user.feedUntil),
      label: "Feed Active",
    },
  });
});

export default router;
