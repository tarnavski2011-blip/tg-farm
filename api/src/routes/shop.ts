import { Router } from "express";
import { prisma } from "../prisma";
import type { TgAuthedRequest } from "../middleware/telegramAuth";
import { ECONOMY } from "../config/economy";
import { antiSpamPerUser } from "../middleware/antiSpam";
import { requestLockByUser } from "../middleware/requestLock";

const router = Router();

const SHOP_ITEMS = {
  FEED_PACK: {
    code: "FEED_PACK",
    title: "Feed Pack",
    priceCoins: ECONOMY.shop.FEED_PACK.priceCoins,
  },
  BOOST_X2_1H: {
    code: "BOOST_X2_1H",
    title: "Boost x2 1h",
    priceDiamonds: ECONOMY.shop.BOOST_X2_1H.priceDiamonds,
  },
  AUTO_COLLECT_1H: {
    code: "AUTO_COLLECT_1H",
    title: "Auto Collect 1h",
    priceDiamonds: ECONOMY.shop.AUTO_COLLECT_1H.priceDiamonds,
  },
  VIP_1D: {
    code: "VIP_1D",
    title: "VIP 1 day",
    priceDiamonds: ECONOMY.shop.VIP_1D.priceDiamonds,
  },
  DIAMONDS_25: {
    code: "DIAMONDS_25",
    title: "25 diamonds",
    priceCoins: ECONOMY.shop.DIAMONDS_25.priceCoins,
  },
} as const;

function addMinutes(base: Date, minutes: number) {
  return new Date(base.getTime() + minutes * 60 * 1000);
}

function addDays(base: Date, days: number) {
  return new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
}

router.get("/", async (req: TgAuthedRequest, res) => {
  if (!req.telegramUser!.id) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const telegramId = BigInt(req.telegramUser!.id);

  const user = await prisma.user.findUnique({
    where: { telegramId },
    select: {
      coins: true,
      diamonds: true,
    },
  });

  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  return res.json({
    coins: user.coins,
    diamonds: user.diamonds,
    items: Object.values(SHOP_ITEMS),
  });
});

router.post(
  "/buy",
  antiSpamPerUser(3000, 4),
  requestLockByUser(1500),
  async (req: TgAuthedRequest, res) => {
    if (!req.telegramUser!.id) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const telegramId = BigInt(req.telegramUser!.id);
    const code = String(req.body?.code ?? "").trim() as keyof typeof SHOP_ITEMS;

    const item = SHOP_ITEMS[code];
    if (!item) {
      return res.status(400).json({ error: "Unknown shop item" });
    }

    const user = await prisma.user.findUnique({
      where: { telegramId },
      select: {
        id: true,
        coins: true,
        diamonds: true,
        boostUntil: true,
        autoCollectUntil: true,
        vipUntil: true,
        feedUntil: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if ("priceCoins" in item && user.coins < item.priceCoins) {
      return res.status(400).json({ error: "Not enough coins" });
    }

    if ("priceDiamonds" in item && user.diamonds < item.priceDiamonds) {
      return res.status(400).json({ error: "Not enough diamonds" });
    }

    const now = new Date();

    const updated = await prisma.$transaction(async (tx) => {
      if ("priceCoins" in item && item.priceCoins) {
        await tx.user.update({
          where: { id: user.id },
          data: {
            coins: { decrement: item.priceCoins },
          },
        });
      }

      if ("priceDiamonds" in item && item.priceDiamonds) {
        await tx.user.update({
          where: { id: user.id },
          data: {
            diamonds: { decrement: item.priceDiamonds },
          },
        });
      }

      if (code === "DIAMONDS_25") {
        return await tx.user.update({
          where: { id: user.id },
          data: {
            diamonds: { increment: ECONOMY.shop.DIAMONDS_25.diamonds },
          },
          select: {
            coins: true,
            diamonds: true,
          },
        });
      }

      if (code === "FEED_PACK") {
        const base =
          user.feedUntil && user.feedUntil > now ? user.feedUntil : now;

        return await tx.user.update({
          where: { id: user.id },
          data: {
            feedUntil: addMinutes(base, ECONOMY.shop.FEED_PACK.minutes),
          },
          select: {
            coins: true,
            diamonds: true,
            feedUntil: true,
          },
        });
      }

      if (code === "BOOST_X2_1H") {
        const base =
          user.boostUntil && user.boostUntil > now ? user.boostUntil : now;

        return await tx.user.update({
          where: { id: user.id },
          data: {
            boostUntil: addMinutes(base, ECONOMY.shop.BOOST_X2_1H.minutes),
          },
          select: {
            coins: true,
            diamonds: true,
            boostUntil: true,
          },
        });
      }

      if (code === "AUTO_COLLECT_1H") {
        const base =
          user.autoCollectUntil && user.autoCollectUntil > now
            ? user.autoCollectUntil
            : now;

        return await tx.user.update({
          where: { id: user.id },
          data: {
            autoCollectUntil: addMinutes(
              base,
              ECONOMY.shop.AUTO_COLLECT_1H.minutes,
            ),
          },
          select: {
            coins: true,
            diamonds: true,
            autoCollectUntil: true,
          },
        });
      }

      if (code === "VIP_1D") {
        const base = user.vipUntil && user.vipUntil > now ? user.vipUntil : now;

        return await tx.user.update({
          where: { id: user.id },
          data: {
            vipUntil: addDays(base, ECONOMY.shop.VIP_1D.days),
          },
          select: {
            coins: true,
            diamonds: true,
            vipUntil: true,
          },
        });
      }

      return await tx.user.findUniqueOrThrow({
        where: { id: user.id },
        select: {
          coins: true,
          diamonds: true,
        },
      });
    });

    return res.json({
      ok: true,
      code,
      title: item.title,
      user: updated,
    });
  },
);

export default router;
