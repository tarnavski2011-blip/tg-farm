import { Router } from "express";
import { prisma } from "../prisma";
import type { TgAuthedRequest } from "../middleware/telegramAuth";

const router = Router();

const ANIMAL_PRODUCTION = {
  CHICKEN: {
    seconds: 20,
    storageField: "eggs",
  },
  SHEEP: {
    seconds: 45,
    storageField: "wool",
  },
  COW: {
    seconds: 90,
    storageField: "milk",
  },
} as const;

function secondsLeft(futureDate?: Date | null) {
  if (!futureDate) return 0;
  const diff = Math.floor((futureDate.getTime() - Date.now()) / 1000);
  return diff > 0 ? diff : 0;
}

function getXpNeeded(level: number) {
  return 100 + level * 50;
}

function getAnimalProducedPerCycle(
  type: "CHICKEN" | "SHEEP" | "COW",
  level: number,
) {
  if (type === "CHICKEN") {
    return 1 + (level - 1);
  }

  if (type === "SHEEP") {
    return 3 + (level - 1);
  }

  if (type === "COW") {
    return 7 + (level - 1) * 2;
  }

  return 1;
}

router.get("/", async (req: TgAuthedRequest, res) => {
  try {
    if (!req.telegramUser?.id) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const telegramId = BigInt(req.telegramUser.id);

    let user = await prisma.user.findUnique({
      where: { telegramId },
      include: {
        animals: true,
        storage: true,
      },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          telegramId,
          level: 1,
          xp: 0,
          storage: {
            create: {
              eggs: 0,
              wool: 0,
              milk: 0,
              capacity: 1000,
            },
          },
        },
        include: {
          animals: true,
          storage: true,
        },
      });
    }

    if (!user.storage) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          storage: {
            create: {
              eggs: 0,
              wool: 0,
              milk: 0,
              capacity: 1000,
            },
          },
        },
        include: {
          animals: true,
          storage: true,
        },
      });
    }

    const now = new Date();

    let eggsAdd = 0;
    let woolAdd = 0;
    let milkAdd = 0;

    let chickenFeedLeft = user.chickenFeed ?? 0;
    let sheepFeedLeft = user.sheepFeed ?? 0;
    let cowFeedLeft = user.cowFeed ?? 0;

    const animalUpdates: Promise<any>[] = [];

    for (const animal of user.animals) {
      const cfg = ANIMAL_PRODUCTION[animal.type];
      const passedSec = Math.floor(
        (now.getTime() - animal.lastClaim.getTime()) / 1000,
      );

      if (passedSec < cfg.seconds) continue;

      const fullCycles = Math.floor(passedSec / cfg.seconds);
      if (fullCycles <= 0) continue;

      let feedAvailable = 0;

      if (animal.type === "CHICKEN") feedAvailable = chickenFeedLeft;
      if (animal.type === "SHEEP") feedAvailable = sheepFeedLeft;
      if (animal.type === "COW") feedAvailable = cowFeedLeft;

      if (feedAvailable <= 0) {
        animalUpdates.push(
          prisma.animal.update({
            where: { id: animal.id },
            data: { lastClaim: now },
          }),
        );
        continue;
      }

      // 1 цикл = 1 корм, незалежно від рівня
      const maxCyclesByFeed = Math.floor(feedAvailable / 1);
      const usedCycles = Math.min(fullCycles, maxCyclesByFeed);

      if (usedCycles <= 0) {
        animalUpdates.push(
          prisma.animal.update({
            where: { id: animal.id },
            data: { lastClaim: now },
          }),
        );
        continue;
      }

      let produced =
        usedCycles * getAnimalProducedPerCycle(animal.type, animal.level);

      produced = Math.floor(produced * (user.labMultiplier || 1));

      if (user.boostUntil && user.boostUntil > now) {
        produced *= 2;
      }

      if (animal.type === "CHICKEN") {
        chickenFeedLeft -= usedCycles;
      }

      if (animal.type === "SHEEP") {
        sheepFeedLeft -= usedCycles;
      }

      if (animal.type === "COW") {
        cowFeedLeft -= usedCycles;
      }

      if (cfg.storageField === "eggs") eggsAdd += produced;
      if (cfg.storageField === "wool") woolAdd += produced;
      if (cfg.storageField === "milk") milkAdd += produced;

      const consumedSec = usedCycles * cfg.seconds;

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

    const currentTotal =
      (user.storage?.eggs ?? 0) +
      (user.storage?.wool ?? 0) +
      (user.storage?.milk ?? 0);

    const capacity = user.storage?.capacity ?? 1000;
    const freeSpace = Math.max(0, capacity - currentTotal);

    let totalAdd = eggsAdd + woolAdd + milkAdd;

    if (totalAdd > freeSpace && totalAdd > 0) {
      const ratio = freeSpace / totalAdd;
      eggsAdd = Math.floor(eggsAdd * ratio);
      woolAdd = Math.floor(woolAdd * ratio);
      milkAdd = Math.floor(milkAdd * ratio);
      totalAdd = eggsAdd + woolAdd + milkAdd;
    }

    if (animalUpdates.length > 0) {
      await Promise.all(animalUpdates);
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        chickenFeed: chickenFeedLeft,
        sheepFeed: sheepFeedLeft,
        cowFeed: cowFeedLeft,
        lastSeenAt: now,
      },
    });

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

    user = await prisma.user.findUnique({
      where: { id: user.id },
      include: {
        animals: true,
        storage: true,
      },
    });

    if (!user || !user.storage) {
      return res.status(404).json({ error: "User not found after update" });
    }

    const chickenAnimals = user.animals.filter((a) => a.type === "CHICKEN");
    const sheepAnimals = user.animals.filter((a) => a.type === "SHEEP");
    const cowAnimals = user.animals.filter((a) => a.type === "COW");

    const eggsReady = chickenAnimals.reduce((sum, animal) => {
      const passedSec = Math.floor(
        (Date.now() - animal.lastClaim.getTime()) / 1000,
      );
      const fullCycles = Math.floor(
        Math.max(0, passedSec) / ANIMAL_PRODUCTION.CHICKEN.seconds,
      );
      const feedCycles = Math.floor((user.chickenFeed ?? 0) / 1);

      return (
        sum +
        Math.min(fullCycles, feedCycles) *
          getAnimalProducedPerCycle("CHICKEN", animal.level)
      );
    }, 0);

    const woolReady = sheepAnimals.reduce((sum, animal) => {
      const passedSec = Math.floor(
        (Date.now() - animal.lastClaim.getTime()) / 1000,
      );
      const fullCycles = Math.floor(
        Math.max(0, passedSec) / ANIMAL_PRODUCTION.SHEEP.seconds,
      );
      const feedCycles = Math.floor((user.sheepFeed ?? 0) / 1);

      return (
        sum +
        Math.min(fullCycles, feedCycles) *
          getAnimalProducedPerCycle("SHEEP", animal.level)
      );
    }, 0);

    const milkReady = cowAnimals.reduce((sum, animal) => {
      const passedSec = Math.floor(
        (Date.now() - animal.lastClaim.getTime()) / 1000,
      );
      const fullCycles = Math.floor(
        Math.max(0, passedSec) / ANIMAL_PRODUCTION.COW.seconds,
      );
      const feedCycles = Math.floor((user.cowFeed ?? 0) / 1);

      return (
        sum +
        Math.min(fullCycles, feedCycles) *
          getAnimalProducedPerCycle("COW", animal.level)
      );
    }, 0);

    const storageTotal =
      (user.storage.eggs ?? 0) +
      (user.storage.wool ?? 0) +
      (user.storage.milk ?? 0);

    const level = user.level ?? 1;
    const xp = user.xp ?? 0;
    const xpNeeded = getXpNeeded(level);
    const xpPercent = Math.max(
      0,
      Math.min(100, Math.round((xp / xpNeeded) * 100)),
    );

    return res.json({
      ok: true,

      coins: user.coins,
      diamonds: user.diamonds,
      points: user.points,
      level,
      xp,
      xpNeeded,
      xpPercent,

      animals: {
        chicken: chickenAnimals.length,
        sheep: sheepAnimals.length,
        cow: cowAnimals.length,

        chickenLevel: chickenAnimals.length
          ? Math.max(...chickenAnimals.map((a) => a.level))
          : 0,
        sheepLevel: sheepAnimals.length
          ? Math.max(...sheepAnimals.map((a) => a.level))
          : 0,
        cowLevel: cowAnimals.length
          ? Math.max(...cowAnimals.map((a) => a.level))
          : 0,
      },

      storage: {
        eggs: user.storage.eggs ?? 0,
        wool: user.storage.wool ?? 0,
        milk: user.storage.milk ?? 0,
        total: storageTotal,
        capacity: user.storage.capacity ?? 1000,
      },

      feedStock: {
        chicken: user.chickenFeed ?? 0,
        sheep: user.sheepFeed ?? 0,
        cow: user.cowFeed ?? 0,
      },

      ready: {
        eggsReady,
        woolReady,
        milkReady,
      },

      levels: {
        warehouseLevel: user.warehouseLevel,
        warehouseCapacity: user.storage.capacity ?? 1000,
        labLevel: user.labLevel,
        labMultiplier: user.labMultiplier,
      },

      feed: {
        active:
          (user.chickenFeed ?? 0) > 0 ||
          (user.sheepFeed ?? 0) > 0 ||
          (user.cowFeed ?? 0) > 0,
        leftSec: 0,
        waitSec: 0,
      },

      boost: {
        active: secondsLeft(user.boostUntil) > 0,
        leftSec: secondsLeft(user.boostUntil),
      },

      autoCollect: {
        active: secondsLeft(user.autoCollectUntil) > 0,
        leftSec: secondsLeft(user.autoCollectUntil),
      },

      vip: {
        active: secondsLeft(user.vipUntil) > 0,
        leftSec: secondsLeft(user.vipUntil),
      },

      daily: {
        dailyStreak: user.dailyStreak,
      },

      offline: {
        minutes: 0,
        added: {
          eggs: eggsAdd,
          wool: woolAdd,
          milk: milkAdd,
        },
      },
    });
  } catch (e) {
    console.error("STATE ERROR FULL:", e);
    return res.status(500).json({
      error: "Server error",
      details: String(e),
    });
  }
});

export default router;
