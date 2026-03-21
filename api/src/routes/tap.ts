import { Router } from "express";
import { prisma } from "../prisma";
import { antiSpamPerUser } from "../middleware/antiSpam";
import { requestLockByUser } from "../middleware/requestLock";

const router = Router();

const TAP_COOLDOWN_MS = 1000;

router.post(
  "/",
  antiSpamPerUser(1000, 8), // максимум 8 тапів за секунду
  requestLockByUser(120), // блокує подвійний клік
  async (req, res) => {
    const telegramIdStr = String(req.body?.telegramId ?? "");

    if (!telegramIdStr) {
      return res.status(400).json({ error: "telegramId is required" });
    }

    let telegramId: bigint;

    try {
      telegramId = BigInt(telegramIdStr);
    } catch {
      return res
        .status(400)
        .json({ error: "telegramId must be an integer string" });
    }

    const user = await prisma.user.findUnique({
      where: { telegramId },
    });

    if (!user) {
      return res.status(404).json({ error: "user not found" });
    }

    const now = Date.now();
    const lastTap = user.lastTapAt ? user.lastTapAt.getTime() : 0;

    if (now - lastTap < TAP_COOLDOWN_MS) {
      return res.status(400).json({ error: "Tap cooldown" });
    }

    const updated = await prisma.user.update({
      where: { telegramId },
      data: {
        coins: { increment: 1 },
        lastTapAt: new Date(),
        xp: { increment: 1 },
      },
    });

    return res.json({
      coins: updated.coins,
      xp: updated.xp,
    });
  },
);

export default router;
