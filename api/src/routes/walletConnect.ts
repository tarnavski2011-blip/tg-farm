import { Router } from "express";
import { prisma } from "../prisma";
import type { TgAuthedRequest } from "../middleware/telegramAuth";

const router = Router();

router.post("/connect", async (req: TgAuthedRequest, res) => {
  try {
    const telegramId = BigInt(req.telegramUser!.id);
    const address = String(req.body.address || "");

    if (!address) {
      return res.status(400).json({
        ok: false,
        error: "Address required",
      });
    }

    await prisma.user.update({
      where: { telegramId },
      data: {
        walletAddress: address,
      },
    });

    return res.json({
      ok: true,
      address,
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({
      ok: false,
      error: "Server error",
    });
  }
});

router.post("/disconnect", async (req: TgAuthedRequest, res) => {
  try {
    const telegramId = BigInt(req.telegramUser!.id);

    await prisma.user.update({
      where: { telegramId },
      data: {
        walletAddress: null,
      },
    });

    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: "Server error",
    });
  }
});

export default router;
