import { Router } from "express";
import { prisma } from "../prisma";
import type { TgAuthedRequest } from "../middleware/telegramAuth";

const router = Router();

router.get("/link", async (req: TgAuthedRequest, res) => {
  if (!req.telegramUser!.id)
    return res.status(401).json({ error: "Unauthorized" });

  const telegramId = BigInt(req.telegramUser!.id);

  const user = await prisma.user.findUnique({
    where: { telegramId },
  });

  if (!user) return res.status(404).json({ error: "User not found" });

  const link = `https://t.me/my_farm_clicker_bot?start=${user.id}`;

  res.json({ link });
});

router.post("/activate", async (req: TgAuthedRequest, res) => {
  if (!req.telegramUser!.id)
    return res.status(401).json({ error: "Unauthorized" });

  const telegramId = BigInt(req.telegramUser!.id);
  const referrerId = Number(req.body.referrerId);

  const user = await prisma.user.findUnique({
    where: { telegramId },
  });

  if (!user) return res.status(404).json({ error: "User not found" });

  if (user.id === referrerId)
    return res.status(400).json({ error: "Cannot refer yourself" });

  const referrer = await prisma.user.findUnique({
    where: { id: referrerId },
  });

  if (!referrer) return res.status(404).json({ error: "Referrer not found" });

  await prisma.referral.create({
    data: {
      referrerId,
      invitedId: user.id,
    },
  });

  await prisma.user.update({
    where: { id: referrerId },
    data: {
      diamonds: { increment: 20 },
      coins: { increment: 1000 },
    },
  });

  res.json({ ok: true });
});

export default router;
