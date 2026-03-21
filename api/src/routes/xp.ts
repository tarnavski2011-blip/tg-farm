
import { Router } from "express";
import { prisma } from "../prisma";

const router = Router();

const XP_PER_ACTION = 5;

function xpToNext(level: number) {
  return 100 + level * 50;
}

router.post("/add", async (req, res) => {
  const telegramId = BigInt(req.body.telegramId);

  const user = await prisma.user.findUnique({
    where: { telegramId }
  });

  if (!user) return res.status(404).json({ error: "User not found" });

  let xp = user.xp + XP_PER_ACTION;
  let level = user.level;

  const need = xpToNext(level);

  if (xp >= need) {
    xp = xp - need;
    level += 1;
  }

  const updated = await prisma.user.update({
    where: { telegramId },
    data: {
      xp,
      level
    }
  });

  res.json({
    xp: updated.xp,
    level: updated.level
  });
});

export default router;
