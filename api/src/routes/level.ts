import { Router } from "express";
import { prisma } from "../prisma";

const router = Router();

router.get("/", async (req, res) => {
  const telegramIdRaw = req.query.telegramId;

  if (typeof telegramIdRaw !== "string" || !telegramIdRaw.trim()) {
    return res.status(400).json({ error: "telegramId is required" });
  }

  let telegramId: bigint;
  try {
    telegramId = BigInt(telegramIdRaw);
  } catch {
    return res.status(400).json({ error: "Invalid telegramId" });
  }

  const user = await prisma.user.findUnique({
    where: { telegramId },
    select: {
      level: true,
      xp: true,
    },
  });

  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  return res.json(user);
});

export default router;
