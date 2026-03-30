import { Router } from "express";
import { prisma } from "../prisma";
import type { TgAuthedRequest } from "../middleware/telegramAuth";

const router = Router();

const SHOP_ITEMS = {
  feed_pack_small: {
    code: "feed_pack_small",
    title: "Малий корм-пак",
    currency: "coins",
    price: 100,
    effect: "feed_30m",
  },
  boost_1h: {
    code: "boost_1h",
    title: "Boost x2 на 1 годину",
    currency: "diamonds",
    price: 10,
    effect: "boost_1h",
  },
  auto_1h: {
    code: "auto_1h",
    title: "Auto Collect на 1 годину",
    currency: "diamonds",
    price: 10,
    effect: "auto_1h",
  },
  vip_1d: {
    code: "vip_1d",
    title: "VIP на 1 день",
    currency: "diamonds",
    price: 50,
    effect: "vip_1d",
  },
} as const;

router.get("/", async (_req, res) => {
  return res.json({
    ok: true,
    items: Object.values(SHOP_ITEMS),
  });
});

router.post("/buy", async (req: TgAuthedRequest, res) => {
  try {
    if (!req.telegramUser?.id) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const telegramId = BigInt(req.telegramUser.id);
    const code = String(req.body?.code ?? "").trim() as keyof typeof SHOP_ITEMS;

    if (!code || !SHOP_ITEMS[code]) {
      return res.status(400).json({ error: "Invalid item code" });
    }

    const item = SHOP_ITEMS[code];

    const user = await prisma.user.findUnique({
      where: { telegramId },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (item.currency === "coins" && user.coins < item.price) {
      return res.status(400).json({
        error: "Not enough coins",
        need: item.price,
        have: user.coins,
      });
    }

    if (item.currency === "diamonds" && user.diamonds < item.price) {
      return res.status(400).json({
        error: "Not enough diamonds",
        need: item.price,
        have: user.diamonds,
      });
    }

    const now = Date.now();

    let data: any = {};

    if (item.currency === "coins") {
      data.coins = { decrement: item.price };
    }

    if (item.currency === "diamonds") {
      data.diamonds = { decrement: item.price };
    }

    if (item.effect === "feed_30m") {
      data.feedUntil = new Date(now + 30 * 60 * 1000);
      data.feedActivatedAt = new Date(now);
    }

    if (item.effect === "boost_1h") {
      const base =
        user.boostUntil && user.boostUntil.getTime() > now
          ? user.boostUntil.getTime()
          : now;
      data.boostUntil = new Date(base + 60 * 60 * 1000);
    }

    if (item.effect === "auto_1h") {
      const base =
        user.autoCollectUntil && user.autoCollectUntil.getTime() > now
          ? user.autoCollectUntil.getTime()
          : now;
      data.autoCollectUntil = new Date(base + 60 * 60 * 1000);
    }

    if (item.effect === "vip_1d") {
      const base =
        user.vipUntil && user.vipUntil.getTime() > now
          ? user.vipUntil.getTime()
          : now;
      data.vipUntil = new Date(base + 24 * 60 * 60 * 1000);
    }

    const updated = await prisma.user.update({
      where: { telegramId },
      data,
      select: {
        coins: true,
        diamonds: true,
        boostUntil: true,
        autoCollectUntil: true,
        vipUntil: true,
        feedUntil: true,
      },
    });

    return res.json({
      ok: true,
      item,
      user: updated,
    });
  } catch (e) {
    console.error("SHOP BUY ERROR:", e);
    return res.status(500).json({ error: "Server error" });
  }
});

export default router;
