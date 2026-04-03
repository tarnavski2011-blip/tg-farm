import { Router } from "express";
import { prisma } from "../prisma";
import type { TgAuthedRequest } from "../middleware/telegramAuth";

const router = Router();

const PRICES = {
  eggs: 6,
  wool: 15,
  milk: 30,
} as const;

router.post("/", async (req: TgAuthedRequest, res) => {
  try {
    if (!req.telegramUser?.id) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const telegramId = BigInt(req.telegramUser.id);

    const user = await prisma.user.findUnique({
      where: { telegramId },
      include: { storage: true },
    });

    if (!user || !user.storage) {
      return res.status(404).json({ error: "Storage not found" });
    }

    const eggs = user.storage.eggs ?? 0;
    const wool = user.storage.wool ?? 0;
    const milk = user.storage.milk ?? 0;

    const eggsCoins = eggs * PRICES.eggs;
    const woolCoins = wool * PRICES.wool;
    const milkCoins = milk * PRICES.milk;

    const totalCoins = eggsCoins + woolCoins + milkCoins;

    if (totalCoins <= 0) {
      return res.json({
        ok: true,
        sold: {
          eggs,
          wool,
          milk,
        },
        earned: 0,
        totalCoins: user.coins,
      });
    }

    const updated = await prisma.user.update({
      where: { telegramId },
      data: {
        coins: { increment: totalCoins },
        storage: {
          update: {
            eggs: 0,
            wool: 0,
            milk: 0,
          },
        },
      },
      select: {
        coins: true,
      },
    });

    return res.json({
      ok: true,
      sold: {
        eggs,
        wool,
        milk,
      },
      prices: PRICES,
      earned: totalCoins,
      totalCoins: updated.coins,
    });
  } catch (e) {
    console.error("SELL ERROR:", e);
    return res.status(500).json({ error: "Server error" });
  }
});

export default router;