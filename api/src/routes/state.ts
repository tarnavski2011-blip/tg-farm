import { Router } from "express";
import { prisma } from "../prisma";
import type { TgAuthedRequest } from "../middleware/telegramAuth";

const router = Router();

const ANIMAL_PRODUCTION = {
  CHICKEN: {
    seconds: 10,
    storageField: "eggs",
  },
  SHEEP: {
    seconds: 30,
    storageField: "wool",
  },
  COW: {
    seconds: 60,
    storageField: "milk",
  },
} as const;

function secondsLeft(futureDate?: Date | null) {
  if (!futureDate) return 0;
  const diff = Math.floor((futureDate.getTime() - Date.now()) / 1000);
  return diff > 0 ? diff : 0;
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

    const animalUpdates: Promise<any>[] = [];

    for (const animal of user.animals) {
      const cfg = ANIMAL_PRODUCTION[animal.type];
      const passedSec = Math.floor(
        (now.getTime() - animal.lastClaim.getTime()) / 1000,
      );

      if (passedSec < cfg.seconds) continue;

      let produced = Math.floor(passedSec / cfg.seconds) * animal.level;

      produced = Math.floor(produced * (user.labMultiplier || 1));

      // BOOST x2
      if (user.boostUntil && user.boostUntil > new Date()) {
        produced *= 2;
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

    user = await prisma.user.update({
      where: { id: user.id },
      data: {
        lastSeenAt: now,
      },
      include: {
        animals: true,
        storage: true,
      },
    });

    const chickenAnimals = user.animals.filter((a) => a.type === "CHICKEN");
    const sheepAnimals = user.animals.filter((a) => a.type === "SHEEP");
    const cowAnimals = user.animals.filter((a) => a.type === "COW");

    const eggsReady = chickenAnimals.reduce((sum, animal) => {
      const passedSec = Math.floor(
        (Date.now() - animal.lastClaim.getTime()) / 1000,
      );
      return (
        sum +
        Math.floor(Math.max(0, passedSec) / ANIMAL_PRODUCTION.CHICKEN.seconds) *
          animal.level
      );
    }, 0);

    const woolReady = sheepAnimals.reduce((sum, animal) => {
      const passedSec = Math.floor(
        (Date.now() - animal.lastClaim.getTime()) / 1000,
      );
      return (
        sum +
        Math.floor(Math.max(0, passedSec) / ANIMAL_PRODUCTION.SHEEP.seconds) *
          animal.level
      );
    }, 0);

    const milkReady = cowAnimals.reduce((sum, animal) => {
      const passedSec = Math.floor(
        (Date.now() - animal.lastClaim.getTime()) / 1000,
      );
      return (
        sum +
        Math.floor(Math.max(0, passedSec) / ANIMAL_PRODUCTION.COW.seconds) *
          animal.level
      );
    }, 0);

    const storageTotal =
      (user.storage?.eggs ?? 0) +
      (user.storage?.wool ?? 0) +
      (user.storage?.milk ?? 0);

    return res.json({
      coins: user.coins,
      diamonds: user.diamonds,
      points: user.points,
      level: user.level,
      xp: user.xp,

      animals: {
        chicken: chickenAnimals.length,
        sheep: sheepAnimals.length,
        cow: cowAnimals.length,
      },

      storage: {
        eggs: user.storage?.eggs ?? 0,
        wool: user.storage?.wool ?? 0,
        milk: user.storage?.milk ?? 0,
        total: storageTotal,
        capacity: user.storage?.capacity ?? 1000,
      },

      ready: {
        eggsReady,
        woolReady,
        milkReady,
      },

      levels: {
        warehouseLevel: user.warehouseLevel,
        warehouseCapacity: user.storage?.capacity ?? 1000,
        labLevel: user.labLevel,
        labMultiplier: user.labMultiplier,
      },

      feed: {
        active: secondsLeft(user.feedUntil) > 0,
        leftSec: secondsLeft(user.feedUntil),
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
