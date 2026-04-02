import { Router } from "express";
import { prisma } from "../prisma";
import type { TgAuthedRequest } from "../middleware/telegramAuth";

const router = Router();

const ANIMAL_PRODUCTION = {
  CHICKEN: { seconds: 10, storageField: "eggs" },
  SHEEP: { seconds: 30, storageField: "wool" },
  COW: { seconds: 60, storageField: "milk" },
} as const;

router.get("/", async (req: TgAuthedRequest, res) => {
  try {
    if (!req.telegramUser?.id) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const telegramId = BigInt(req.telegramUser.id);

    const user = await prisma.user.findUnique({
      where: { telegramId },
      include: {
        animals: true,
        storage: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const now = new Date();

    let eggsAdd = 0;
    let woolAdd = 0;
    let milkAdd = 0;

    let chickenFeedLeft = user.chickenFeed ?? 0;
    let sheepFeedLeft = user.sheepFeed ?? 0;
    let cowFeedLeft = user.cowFeed ?? 0;

    const animalUpdates: any[] = [];

    for (const animal of user.animals) {
      const cfg =
        ANIMAL_PRODUCTION[animal.type as keyof typeof ANIMAL_PRODUCTION];

      if (!cfg) continue;

      const passedSec = Math.floor(
        (now.getTime() - animal.lastClaim.getTime()) / 1000,
      );

      if (passedSec < cfg.seconds) continue;

      let produced = Math.floor(passedSec / cfg.seconds) * animal.level;

      // лабораторія
      produced = Math.floor(produced * (user.labMultiplier || 1));

      // BOOST
      if (user.boostUntil && user.boostUntil > now) {
        produced *= 2;
      }

      if (produced <= 0) continue;

      // 🔥 корм по тваринах
      if (animal.type === "CHICKEN") {
        produced = Math.min(produced, chickenFeedLeft);
        chickenFeedLeft -= produced;
      }

      if (animal.type === "SHEEP") {
        produced = Math.min(produced, sheepFeedLeft);
        sheepFeedLeft -= produced;
      }

      if (animal.type === "COW") {
        produced = Math.min(produced, cowFeedLeft);
        cowFeedLeft -= produced;
      }

      if (produced <= 0) continue;

      if (cfg.storageField === "eggs") eggsAdd += produced;
      if (cfg.storageField === "wool") woolAdd += produced;
      if (cfg.storageField === "milk") milkAdd += produced;

      const consumedSec = Math.floor(passedSec / cfg.seconds) * cfg.seconds;

      const newLastClaim = new Date(
        animal.lastClaim.getTime() + consumedSec * 1000,
      );

      animalUpdates.push(
        prisma.animal.update({
          where: { id: animal.id },
          data: { lastClaim: newLastClaim },
        }),
      );
    }

    if (animalUpdates.length > 0) {
      await prisma.$transaction(animalUpdates);
    }

    // 🔥 зберігаємо корм
    await prisma.user.update({
      where: { id: user.id },
      data: {
        chickenFeed: chickenFeedLeft,
        sheepFeed: sheepFeedLeft,
        cowFeed: cowFeedLeft,
      },
    });

    const totalAdd = eggsAdd + woolAdd + milkAdd;

    if (totalAdd > 0) {
      await prisma.storage.update({
        where: { userId: user.id },
        data: {
          eggs: { increment: eggsAdd },
          wool: { increment: woolAdd },
          milk: { increment: milkAdd },
        },
      });
    }

    const updatedStorage = await prisma.storage.findUnique({
      where: { userId: user.id },
    });

    return res.json({
      ok: true,

      coins: user.coins,
      diamonds: user.diamonds,

      storage: {
        eggs: updatedStorage?.eggs ?? 0,
        wool: updatedStorage?.wool ?? 0,
        milk: updatedStorage?.milk ?? 0,
      },

      feedStock: {
        chicken: chickenFeedLeft,
        sheep: sheepFeedLeft,
        cow: cowFeedLeft,
      },

      animals: user.animals,

      boost: user.boostUntil,
      autoCollect: user.autoCollectUntil,
      vip: user.vipUntil,

      labMultiplier: user.labMultiplier,
      labLevel: user.labLevel,
    });
  } catch (e) {
    console.error("STATE ERROR:", e);
    return res.status(500).json({ error: "Server error" });
  }
});

export default router;
