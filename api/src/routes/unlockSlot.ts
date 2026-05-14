import { Router } from "express";
import { prisma } from "../prisma";
import type { TgAuthedRequest } from "../middleware/telegramAuth";
import { AnimalType } from "@prisma/client";

const router = Router();

const MAX_SLOTS = 6;

const SLOT_PRICES: Record<number, { coins: number; diamonds: number }> = {
  3: { coins: 25000, diamonds: 0 },
  4: { coins: 150000, diamonds: 25 },
  5: { coins: 750000, diamonds: 100 },
  6: { coins: 2500000, diamonds: 300 },
};

function getSlotField(type: AnimalType) {
  if (type === "CHICKEN") return "chickenSlots";
  if (type === "SHEEP") return "sheepSlots";
  if (type === "COW") return "cowSlots";
  return null;
}

function getCurrentSlots(user: any, type: AnimalType) {
  if (type === "CHICKEN") return user.chickenSlots ?? 2;
  if (type === "SHEEP") return user.sheepSlots ?? 2;
  if (type === "COW") return user.cowSlots ?? 2;
  return 2;
}

router.post("/", async (req: TgAuthedRequest, res) => {
  try {
    if (!req.telegramUser?.id) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const type = String(req.body?.type ?? "").trim() as AnimalType;

    if (!type || !["CHICKEN", "SHEEP", "COW"].includes(type)) {
      return res.status(400).json({ error: "Invalid animal type" });
    }

    const telegramId = BigInt(req.telegramUser.id);

    const user = await prisma.user.findUnique({
      where: { telegramId },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const currentSlots = getCurrentSlots(user, type);

    if (currentSlots >= MAX_SLOTS) {
      return res.status(400).json({
        error: "Уже відкрито максимум слотів",
        currentSlots,
        maxSlots: MAX_SLOTS,
      });
    }

    const nextSlot = currentSlots + 1;
    const price = SLOT_PRICES[nextSlot];

    if (!price) {
      return res.status(400).json({ error: "Slot price not found" });
    }

    if ((user.coins ?? 0) < price.coins) {
      return res.status(400).json({
        error: "Не вистачає coins",
        needCoins: price.coins,
        haveCoins: user.coins ?? 0,
      });
    }

    if ((user.diamonds ?? 0) < price.diamonds) {
      return res.status(400).json({
        error: "Не вистачає diamonds",
        needDiamonds: price.diamonds,
        haveDiamonds: user.diamonds ?? 0,
      });
    }

    const slotField = getSlotField(type);

    if (!slotField) {
      return res.status(400).json({ error: "Wrong slot field" });
    }

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        coins: { decrement: price.coins },
        diamonds: { decrement: price.diamonds },
        [slotField]: nextSlot,
      } as any,
      select: {
        coins: true,
        diamonds: true,
        chickenSlots: true,
        sheepSlots: true,
        cowSlots: true,
      } as any,
    });

    return res.json({
      ok: true,
      type,
      unlockedSlot: nextSlot,
      spent: price,
      slots: {
        chicken: (updated as any).chickenSlots,
        sheep: (updated as any).sheepSlots,
        cow: (updated as any).cowSlots,
      },
      coins: updated.coins,
      diamonds: updated.diamonds,
    });
  } catch (e) {
    console.error("UNLOCK SLOT ERROR:", e);
    return res.status(500).json({ error: "Server error" });
  }
});

router.get("/prices", async (_req, res) => {
  return res.json({
    ok: true,
    maxSlots: MAX_SLOTS,
    prices: SLOT_PRICES,
  });
});

export default router;
