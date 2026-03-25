import { Router } from "express";
import { prisma } from "../prisma";
import type { TgAuthedRequest } from "../middleware/telegramAuth";

const router = Router();

router.post("/auto", async (req: TgAuthedRequest, res) => {
  try {
    const telegramId = BigInt(req.telegramUser!.id);

    const until = new Date(Date.now() + 60 * 60 * 1000); // 1 година

    await prisma.user.update({
      where: { telegramId },
      data: {
        autoCollectUntil: until,
      },
    });

    res.json({ ok: true, auto: true });
  } catch (e) {
    res.status(500).json({ error: "auto error" });
  }
});

router.post("/boost", async (req: TgAuthedRequest, res) => {
  try {
    const telegramId = BigInt(req.telegramUser!.id);

    const until = new Date(Date.now() + 60 * 60 * 1000);

    await prisma.user.update({
      where: { telegramId },
      data: {
        boostUntil: until,
      },
    });

    res.json({ ok: true, boost: true });
  } catch (e) {
    res.status(500).json({ error: "boost error" });
  }
});

export default router;
