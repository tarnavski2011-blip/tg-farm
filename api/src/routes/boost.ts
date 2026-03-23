import { Router } from "express";
import type { TgAuthedRequest } from "../middleware/telegramAuth";
import { prisma } from "../prisma";

const router = Router();

const BOOST_PRICE_DIAMONDS = 50;
const BOOST_DURATION_MS = 60 * 60 * 1000;

const VIP_PRICE_DIAMONDS = 200;
const VIP_DURATION_MS = 30 * 24 * 60 * 60 * 1000;

router.post("/activate", async (req: TgAuthedRequest, res) => {
  if (!req.telegramUser!.id)
    return res.status(401).json({ error: "Unauthorized" });

  const telegramId = BigInt(req.telegramUser!.id);
  const user = await prisma.user.findUnique({ where: { telegramId } });
  if (!user) return res.status(404).json({ error: "user not found" });

  if (user.diamonds < BOOST_PRICE_DIAMONDS) {
    return res
      .status(400)
      .json({
        error: "Not enough diamonds",
        need: BOOST_PRICE_DIAMONDS,
        have: user.diamonds,
      });
  }

  const now = Date.now();
  const base =
    user.boostUntil && user.boostUntil.getTime() > now
      ? user.boostUntil.getTime()
      : now;
  const until = new Date(base + BOOST_DURATION_MS);

  const updated = await prisma.user.update({
    where: { telegramId },
    data: {
      diamonds: { decrement: BOOST_PRICE_DIAMONDS },
      boostUntil: until,
    },
  });

  return res.json({
    ok: true,
    diamonds: updated.diamonds,
    boostUntil: updated.boostUntil,
  });
});

router.post("/vip", async (req: TgAuthedRequest, res) => {
  if (!req.telegramUser!.id)
    return res.status(401).json({ error: "Unauthorized" });

  const telegramId = BigInt(req.telegramUser!.id);
  const user = await prisma.user.findUnique({ where: { telegramId } });
  if (!user) return res.status(404).json({ error: "user not found" });

  if (user.diamonds < VIP_PRICE_DIAMONDS) {
    return res
      .status(400)
      .json({
        error: "Not enough diamonds",
        need: VIP_PRICE_DIAMONDS,
        have: user.diamonds,
      });
  }

  const now = Date.now();
  const base =
    user.vipUntil && user.vipUntil.getTime() > now
      ? user.vipUntil.getTime()
      : now;
  const until = new Date(base + VIP_DURATION_MS);

  const updated = await prisma.user.update({
    where: { telegramId },
    data: {
      diamonds: { decrement: VIP_PRICE_DIAMONDS },
      vipUntil: until,
    },
  });

  return res.json({
    ok: true,
    diamonds: updated.diamonds,
    vipUntil: updated.vipUntil,
  });
});

export default router;
