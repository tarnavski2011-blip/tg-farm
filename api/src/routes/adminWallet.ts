import { Router } from "express";
import { prisma } from "../prisma";

const router = Router();

router.post("/wallet/add-ton", async (req, res) => {
  try {
    const secret = req.body.secret;
    const telegramId = req.body.telegramId;
    const amount = Number(req.body.amount);

    if (!process.env.ADMIN_SECRET || secret !== process.env.ADMIN_SECRET) {
      return res.status(401).json({
        ok: false,
        error: "Unauthorized",
      });
    }

    if (!telegramId || !amount || amount <= 0) {
      return res.status(400).json({
        ok: false,
        error: "Invalid telegramId or amount",
      });
    }

    const updated = await prisma.user.update({
      where: {
        telegramId: BigInt(telegramId),
      },
      data: {
        tonBalance: {
          increment: amount,
        },
      },
      select: {
        telegramId: true,
        tonBalance: true,
      },
    });

    return res.json({
      ok: true,
      telegramId: updated.telegramId.toString(),
      addedTon: amount,
      tonBalance: updated.tonBalance,
    });
  } catch (e) {
    console.error("ADMIN WALLET ERROR:", e);

    return res.status(500).json({
      ok: false,
      error: "Server error",
    });
  }
});

export default router;
