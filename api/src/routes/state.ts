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

const AUTO_FEED_PRICES = {
  CHICKEN: 50,
  SHEEP: 120,
  COW: 250,
} as const;

const SELL_PRICES = {
  eggs: 6,
  wool: 15,
  milk: 30,
} as const;

function sellPointsRate(level: number, lvl4Rate: number, lvl5Rate: number) {
  if (level >= 5) return lvl5Rate;
  if (level >= 4) return lvl4Rate;
  return 0;
}

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
  if (type === "CHICKEN") return 1 + (level - 1);
  if (type === "SHEEP") return 3 + (level - 1);
  if (type === "COW") return 7 + (level - 1) * 2;
  return 1;
}

function getAnimalPointsPerCycle(
  type: "CHICKEN" | "SHEEP" | "COW",
  level: number,
) {
  if (level < 4) return 0;

  if (type === "CHICKEN") return level === 4 ? 1 : 3;
  if (type === "SHEEP") return level === 4 ? 3 : 8;
  if (type === "COW") return level === 4 ? 8 : 20;

  return 0;
}

function getAnimalLifeDays(type: "CHICKEN" | "SHEEP" | "COW") {
  if (type === "CHICKEN") return 3;
  if (type === "SHEEP") return 5;
  if (type === "COW") return 7;
  return 1;
}

function getAnimalEfficiency(animal: {
  type: "CHICKEN" | "SHEEP" | "COW";
  bornAt: Date;
  lastFedAt: Date;
}) {
  const now = Date.now();

  const totalLifeMs = getAnimalLifeDays(animal.type) * 24 * 60 * 60 * 1000;

  const ageMs = now - new Date(animal.bornAt).getTime();

  if (ageMs >= totalLifeMs) {
    return {
      lifePercent: 0,
      efficiencyPercent: 0,
      daysLeft: 0,
    };
  }

  const daysLeft = Math.max(0, (totalLifeMs - ageMs) / (24 * 60 * 60 * 1000));

  const hoursWithoutFeed =
    (now - new Date(animal.lastFedAt).getTime()) / (60 * 60 * 1000);

  const efficiencyLoss = Math.floor(hoursWithoutFeed / 12) * 10;

  const efficiencyPercent = Math.max(0, 100 - efficiencyLoss);

  const lifePercent = Math.max(
    0,
    Math.round(((totalLifeMs - ageMs) / totalLifeMs) * 100),
  );

  return {
    lifePercent,
    efficiencyPercent,
    daysLeft: Math.ceil(daysLeft),
  };
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
          warehouseLevel: 1,
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
    let pointsAdd = 0;
    let autoFeedCoinsSpent = 0;
    let autoSellCoinsAdd = 0;
    let autoSellPointsAdd = 0;
    const vipActiveNow = !!(user.vipUntil && user.vipUntil > now);
    const autoSellActiveNow =
      vipActiveNow || !!(user.autoCollectUntil && user.autoCollectUntil > now);

    let chickenFeedLeft = user.chickenFeed ?? 0;
    let sheepFeedLeft = user.sheepFeed ?? 0;
    let cowFeedLeft = user.cowFeed ?? 0;
    let userCoinsLeft = user.coins ?? 0;

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

      if (feedAvailable <= 0 && vipActiveNow) {
        const feedPrice = AUTO_FEED_PRICES[animal.type];

        if (userCoinsLeft >= feedPrice) {
          userCoinsLeft -= feedPrice;
          autoFeedCoinsSpent += feedPrice;
          feedAvailable = 10;

          if (animal.type === "CHICKEN") chickenFeedLeft += 10;
          if (animal.type === "SHEEP") sheepFeedLeft += 10;
          if (animal.type === "COW") cowFeedLeft += 10;
        }
      }

      if (feedAvailable <= 0) {
        animalUpdates.push(
          prisma.animal.update({
            where: { id: animal.id },
            data: { lastClaim: now },
          }),
        );
        continue;
      }

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

      const animalStats = getAnimalEfficiency({
        type: animal.type,
        bornAt: animal.bornAt,
        lastFedAt: animal.lastFedAt,
      });

      if (animalStats.lifePercent <= 0 || animalStats.efficiencyPercent <= 0) {
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

      produced = Math.floor(produced * (animalStats.efficiencyPercent / 100));

      if (user.boostUntil && user.boostUntil > now) {
        produced *= 2;
      }

      if (user.vipUntil && user.vipUntil > now) {
        produced = Math.ceil(produced * 1.2);
      }

      let earnedPoints =
        usedCycles * getAnimalPointsPerCycle(animal.type, animal.level);

      if (user.vipUntil && user.vipUntil > now) {
        earnedPoints = Math.ceil(earnedPoints * 1.2);
      }

      pointsAdd += earnedPoints;

      if (animal.type === "CHICKEN") chickenFeedLeft -= usedCycles;
      if (animal.type === "SHEEP") sheepFeedLeft -= usedCycles;
      if (animal.type === "COW") cowFeedLeft -= usedCycles;

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
          data: {
            lastClaim: newLastClaim,
            lastFedAt: now,
          },
        }),
      );
    }

    let storageEggs = user.storage?.eggs ?? 0;
    let storageWool = user.storage?.wool ?? 0;
    let storageMilk = user.storage?.milk ?? 0;

    let currentTotal = storageEggs + storageWool + storageMilk;

    const capacity = user.storage?.capacity ?? 1000;

    let totalAdd = eggsAdd + woolAdd + milkAdd;

    if (
      autoSellActiveNow &&
      currentTotal > 0 &&
      currentTotal >= Math.floor(capacity * 0.95)
    ) {
      autoSellCoinsAdd =
        storageEggs * SELL_PRICES.eggs +
        storageWool * SELL_PRICES.wool +
        storageMilk * SELL_PRICES.milk;

      const autoSellChickenAnimals = user.animals.filter(
        (a) => a.type === "CHICKEN",
      );
      const autoSellSheepAnimals = user.animals.filter(
        (a) => a.type === "SHEEP",
      );
      const autoSellCowAnimals = user.animals.filter((a) => a.type === "COW");

      const chickenLevel = autoSellChickenAnimals.length
        ? Math.max(...autoSellChickenAnimals.map((a) => a.level))
        : 0;

      const sheepLevel = autoSellSheepAnimals.length
        ? Math.max(...autoSellSheepAnimals.map((a) => a.level))
        : 0;

      const cowLevel = autoSellCowAnimals.length
        ? Math.max(...autoSellCowAnimals.map((a) => a.level))
        : 0;

      autoSellPointsAdd =
        storageEggs * sellPointsRate(chickenLevel, 1, 3) +
        storageWool * sellPointsRate(sheepLevel, 2, 6) +
        storageMilk * sellPointsRate(cowLevel, 3, 10);

      storageEggs = 0;
      storageWool = 0;
      storageMilk = 0;
      currentTotal = 0;
    }

    const freeSpace = Math.max(0, capacity - currentTotal);

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
        coins: { increment: autoSellCoinsAdd - autoFeedCoinsSpent },
        points: { increment: pointsAdd + autoSellPointsAdd },
        lastSeenAt: now,
      },
    });

    if (autoSellCoinsAdd > 0 || totalAdd > 0) {
      await prisma.storage.update({
        where: { userId: user.id },
        data:
          autoSellCoinsAdd > 0
            ? {
                eggs: eggsAdd,
                wool: woolAdd,
                milk: milkAdd,
              }
            : {
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
      const feedCycles = Math.floor((user!.chickenFeed ?? 0) / 1);

      return (
        sum +
        Math.min(fullCycles, feedCycles) *
          (user!.vipUntil && user!.vipUntil > new Date()
            ? Math.ceil(
                getAnimalProducedPerCycle("CHICKEN", animal.level) * 1.2,
              )
            : getAnimalProducedPerCycle("CHICKEN", animal.level))
      );
    }, 0);

    const woolReady = sheepAnimals.reduce((sum, animal) => {
      const passedSec = Math.floor(
        (Date.now() - animal.lastClaim.getTime()) / 1000,
      );
      const fullCycles = Math.floor(
        Math.max(0, passedSec) / ANIMAL_PRODUCTION.SHEEP.seconds,
      );
      const feedCycles = Math.floor((user!.sheepFeed ?? 0) / 1);

      return (
        sum +
        Math.min(fullCycles, feedCycles) *
          (user!.vipUntil && user!.vipUntil > new Date()
            ? Math.ceil(getAnimalProducedPerCycle("SHEEP", animal.level) * 1.2)
            : getAnimalProducedPerCycle("SHEEP", animal.level))
      );
    }, 0);

    const milkReady = cowAnimals.reduce((sum, animal) => {
      const passedSec = Math.floor(
        (Date.now() - animal.lastClaim.getTime()) / 1000,
      );
      const fullCycles = Math.floor(
        Math.max(0, passedSec) / ANIMAL_PRODUCTION.COW.seconds,
      );
      const feedCycles = Math.floor((user!.cowFeed ?? 0) / 1);

      return (
        sum +
        Math.min(fullCycles, feedCycles) *
          (user!.vipUntil && user!.vipUntil > new Date()
            ? Math.ceil(getAnimalProducedPerCycle("COW", animal.level) * 1.2)
            : getAnimalProducedPerCycle("COW", animal.level))
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
      xpNeeded: 100 + (user.level ?? 1) * 50,
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
        sellValue:
          (user.storage.eggs ?? 0) * 6 +
          (user.storage.wool ?? 0) * 15 +
          (user.storage.milk ?? 0) * 30,
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
        warehouseLevel: user.warehouseLevel ?? 1,
        warehouseCapacity: user.storage.capacity ?? 1000,
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
          points: pointsAdd,
          autoFeedCoinsSpent,
          autoSellCoins: autoSellCoinsAdd,
          autoSellPoints: autoSellPointsAdd,
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
