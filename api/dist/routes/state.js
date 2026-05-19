"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../prisma");
const router = (0, express_1.Router)();
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
};
const AUTO_FEED_PRICES = {
    CHICKEN: 50,
    SHEEP: 120,
    COW: 250,
};
const SELL_PRICES = {
    eggs: 6,
    wool: 15,
    milk: 30,
};
function sellPointsRate(level, lvl4Rate, lvl5Rate) {
    if (level >= 5)
        return lvl5Rate;
    if (level >= 4)
        return lvl4Rate;
    return 0;
}
function secondsLeft(futureDate) {
    if (!futureDate)
        return 0;
    const diff = Math.floor((futureDate.getTime() - Date.now()) / 1000);
    return diff > 0 ? diff : 0;
}
function getXpNeeded(level) {
    return 100 + level * 50;
}
function getAnimalProducedPerCycle(type, level) {
    if (type === "CHICKEN")
        return 1 + (level - 1);
    if (type === "SHEEP")
        return 3 + (level - 1);
    if (type === "COW")
        return 7 + (level - 1) * 2;
    return 1;
}
function getAnimalPointsPerCycle(type, level) {
    if (level < 4)
        return 0;
    if (type === "CHICKEN")
        return level === 4 ? 1 : 3;
    if (type === "SHEEP")
        return level === 4 ? 3 : 8;
    if (type === "COW")
        return level === 4 ? 8 : 20;
    return 0;
}
function getAnimalLifeDays(type) {
    if (type === "CHICKEN")
        return 3;
    if (type === "SHEEP")
        return 5;
    if (type === "COW")
        return 7;
    return 1;
}
function getAnimalEfficiency(animal) {
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
    const hoursWithoutFeed = (now - new Date(animal.lastFedAt).getTime()) / (60 * 60 * 1000);
    const efficiencyLoss = Math.floor(hoursWithoutFeed / 12) * 10;
    const efficiencyPercent = Math.max(0, 100 - efficiencyLoss);
    const lifePercent = Math.max(0, Math.round(((totalLifeMs - ageMs) / totalLifeMs) * 100));
    return {
        lifePercent,
        efficiencyPercent,
        daysLeft: Math.ceil(daysLeft),
    };
}
router.get("/", async (req, res) => {
    try {
        if (!req.telegramUser?.id) {
            return res.status(401).json({ error: "Unauthorized" });
        }
        const telegramId = BigInt(req.telegramUser.id);
        let user = await prisma_1.prisma.user.findUnique({
            where: { telegramId },
            include: {
                animals: true,
                storage: true,
            },
        });
        if (!user) {
            user = await prisma_1.prisma.user.create({
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
            user = await prisma_1.prisma.user.update({
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
        const autoSellActiveNow = vipActiveNow || !!(user.autoCollectUntil && user.autoCollectUntil > now);
        let chickenFeedLeft = user.chickenFeed ?? 0;
        let sheepFeedLeft = user.sheepFeed ?? 0;
        let cowFeedLeft = user.cowFeed ?? 0;
        let userCoinsLeft = user.coins ?? 0;
        const animalUpdates = [];
        const deadAnimalDeletes = [];
        for (const animal of user.animals) {
            const preCheckStats = getAnimalEfficiency({
                type: animal.type,
                bornAt: animal.bornAt,
                lastFedAt: animal.lastFedAt,
            });
            if (preCheckStats.lifePercent <= 0) {
                deadAnimalDeletes.push(prisma_1.prisma.animal.delete({
                    where: { id: animal.id },
                }));
                continue;
            }
            const cfg = ANIMAL_PRODUCTION[animal.type];
            const passedSec = Math.floor((now.getTime() - animal.lastClaim.getTime()) / 1000);
            if (passedSec < cfg.seconds)
                continue;
            const fullCycles = Math.floor(passedSec / cfg.seconds);
            if (fullCycles <= 0)
                continue;
            let feedAvailable = 0;
            if (animal.type === "CHICKEN")
                feedAvailable = chickenFeedLeft;
            if (animal.type === "SHEEP")
                feedAvailable = sheepFeedLeft;
            if (animal.type === "COW")
                feedAvailable = cowFeedLeft;
            if (feedAvailable <= 0 && vipActiveNow) {
                const feedPrice = AUTO_FEED_PRICES[animal.type];
                if (userCoinsLeft >= feedPrice) {
                    userCoinsLeft -= feedPrice;
                    autoFeedCoinsSpent += feedPrice;
                    feedAvailable = 10;
                    if (animal.type === "CHICKEN")
                        chickenFeedLeft += 10;
                    if (animal.type === "SHEEP")
                        sheepFeedLeft += 10;
                    if (animal.type === "COW")
                        cowFeedLeft += 10;
                }
            }
            if (feedAvailable <= 0) {
                animalUpdates.push(prisma_1.prisma.animal.update({
                    where: { id: animal.id },
                    data: { lastClaim: now },
                }));
                continue;
            }
            const currentStorageTotal = (user.storage?.eggs ?? 0) +
                (user.storage?.wool ?? 0) +
                (user.storage?.milk ?? 0);
            const storageFreeSpace = Math.max(0, (user.storage?.capacity ?? 1000) - currentStorageTotal);
            let producedPerCycle = getAnimalProducedPerCycle(animal.type, animal.level);
            producedPerCycle = Math.max(1, Math.floor(producedPerCycle * (animal.breedBonus ?? 1)));
            const maxCyclesByFeed = Math.floor(feedAvailable / 1);
            const maxCyclesByStorage = Math.floor(storageFreeSpace / producedPerCycle);
            const usedCycles = Math.min(fullCycles, maxCyclesByFeed, maxCyclesByStorage);
            if (usedCycles <= 0) {
                animalUpdates.push(prisma_1.prisma.animal.update({
                    where: { id: animal.id },
                    data: { lastClaim: now },
                }));
                continue;
            }
            const animalStats = getAnimalEfficiency({
                type: animal.type,
                bornAt: animal.bornAt,
                lastFedAt: animal.lastFedAt,
            });
            if (animalStats.lifePercent <= 0) {
                deadAnimalDeletes.push(prisma_1.prisma.animal.delete({
                    where: { id: animal.id },
                }));
                continue;
            }
            if (animalStats.efficiencyPercent <= 0) {
                continue;
            }
            let produced = usedCycles * getAnimalProducedPerCycle(animal.type, animal.level);
            produced = Math.floor(produced * (animal.breedBonus ?? 1));
            produced = Math.floor(produced * (animalStats.efficiencyPercent / 100));
            if (user.boostUntil && user.boostUntil > now) {
                produced *= 2;
            }
            if (user.vipUntil && user.vipUntil > now) {
                produced = Math.ceil(produced * 1.2);
            }
            let earnedPoints = usedCycles * getAnimalPointsPerCycle(animal.type, animal.level);
            earnedPoints = Math.floor(earnedPoints * (animal.breedBonus ?? 1));
            earnedPoints = Math.floor(earnedPoints * (animalStats.efficiencyPercent / 100));
            if (user.vipUntil && user.vipUntil > now) {
                earnedPoints = Math.ceil(earnedPoints * 1.2);
            }
            pointsAdd += earnedPoints;
            if (animal.type === "CHICKEN")
                chickenFeedLeft -= usedCycles;
            if (animal.type === "SHEEP")
                sheepFeedLeft -= usedCycles;
            if (animal.type === "COW")
                cowFeedLeft -= usedCycles;
            if (cfg.storageField === "eggs")
                eggsAdd += produced;
            if (cfg.storageField === "wool")
                woolAdd += produced;
            if (cfg.storageField === "milk")
                milkAdd += produced;
            const consumedSec = usedCycles * cfg.seconds;
            const newLastClaim = new Date(animal.lastClaim.getTime() + consumedSec * 1000);
            animalUpdates.push(prisma_1.prisma.animal.update({
                where: { id: animal.id },
                data: {
                    lastClaim: newLastClaim,
                },
            }));
        }
        let storageEggs = user.storage?.eggs ?? 0;
        let storageWool = user.storage?.wool ?? 0;
        let storageMilk = user.storage?.milk ?? 0;
        let currentTotal = storageEggs + storageWool + storageMilk;
        const capacity = user.storage?.capacity ?? 1000;
        if (currentTotal > capacity && user.storage) {
            const overflow = currentTotal - capacity;
            let eggs = storageEggs;
            let wool = storageWool;
            let milk = storageMilk;
            let leftOverflow = overflow;
            const cutMilk = Math.min(milk, leftOverflow);
            milk -= cutMilk;
            leftOverflow -= cutMilk;
            const cutWool = Math.min(wool, leftOverflow);
            wool -= cutWool;
            leftOverflow -= cutWool;
            const cutEggs = Math.min(eggs, leftOverflow);
            eggs -= cutEggs;
            storageEggs = eggs;
            storageWool = wool;
            storageMilk = milk;
            currentTotal = capacity;
            await prisma_1.prisma.storage.update({
                where: { userId: user.id },
                data: {
                    eggs: storageEggs,
                    wool: storageWool,
                    milk: storageMilk,
                },
            });
        }
        let totalAdd = eggsAdd + woolAdd + milkAdd;
        if (autoSellActiveNow &&
            currentTotal > 0 &&
            currentTotal >= Math.floor(capacity * 0.95)) {
            autoSellCoinsAdd =
                storageEggs * SELL_PRICES.eggs +
                    storageWool * SELL_PRICES.wool +
                    storageMilk * SELL_PRICES.milk;
            const autoSellChickenAnimals = user.animals.filter((a) => a.type === "CHICKEN");
            const autoSellSheepAnimals = user.animals.filter((a) => a.type === "SHEEP");
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
        if (animalUpdates.length > 0 || deadAnimalDeletes.length > 0) {
            await Promise.all([...animalUpdates, ...deadAnimalDeletes]);
        }
        await prisma_1.prisma.user.update({
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
            await prisma_1.prisma.storage.update({
                where: { userId: user.id },
                data: autoSellCoinsAdd > 0
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
        user = await prisma_1.prisma.user.findUnique({
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
        function getReadyForAnimal(animal, feedCycles) {
            const stats = getAnimalEfficiency({
                type: animal.type,
                bornAt: animal.bornAt,
                lastFedAt: animal.lastFedAt,
            });
            if (stats.lifePercent <= 0 || stats.efficiencyPercent <= 0) {
                return 0;
            }
            const passedSec = Math.floor((Date.now() - animal.lastClaim.getTime()) / 1000);
            const fullCycles = Math.floor(Math.max(0, passedSec) / ANIMAL_PRODUCTION[animal.type].seconds);
            const usedCycles = Math.min(fullCycles, feedCycles);
            if (usedCycles <= 0) {
                return 0;
            }
            let produced = usedCycles * getAnimalProducedPerCycle(animal.type, animal.level);
            produced = Math.floor(produced * (animal.breedBonus ?? 1));
            produced = Math.floor(produced * (stats.efficiencyPercent / 100));
            if (user.boostUntil && user.boostUntil > new Date()) {
                produced *= 2;
            }
            if (user.vipUntil && user.vipUntil > new Date()) {
                produced = Math.ceil(produced * 1.2);
            }
            return produced;
        }
        const eggsReady = chickenAnimals.reduce((sum, animal) => {
            const feedCycles = Math.floor((user.chickenFeed ?? 0) / 1);
            return sum + getReadyForAnimal(animal, feedCycles);
        }, 0);
        const woolReady = sheepAnimals.reduce((sum, animal) => {
            const feedCycles = Math.floor((user.sheepFeed ?? 0) / 1);
            return sum + getReadyForAnimal(animal, feedCycles);
        }, 0);
        const milkReady = cowAnimals.reduce((sum, animal) => {
            const feedCycles = Math.floor((user.cowFeed ?? 0) / 1);
            return sum + getReadyForAnimal(animal, feedCycles);
        }, 0);
        const storageTotal = (user.storage.eggs ?? 0) +
            (user.storage.wool ?? 0) +
            (user.storage.milk ?? 0);
        const level = user.level ?? 1;
        const xp = user.xp ?? 0;
        const xpNeeded = getXpNeeded(level);
        const xpPercent = Math.max(0, Math.min(100, Math.round((xp / xpNeeded) * 100)));
        function getEffectivePerHour(type, animals) {
            if (animals.length <= 0)
                return 0;
            return animals.reduce((sum, animal) => {
                const stats = getAnimalEfficiency({
                    type: animal.type,
                    bornAt: animal.bornAt,
                    lastFedAt: animal.lastFedAt,
                });
                if (stats.lifePercent <= 0 || stats.efficiencyPercent <= 0) {
                    return sum;
                }
                const cyclesPerHour = 3600 / ANIMAL_PRODUCTION[type].seconds;
                let produced = cyclesPerHour * getAnimalProducedPerCycle(type, animal.level);
                produced = Math.floor(produced * (animal.breedBonus ?? 1));
                produced = Math.floor(produced * (stats.efficiencyPercent / 100));
                if (user.boostUntil && user.boostUntil > new Date()) {
                    produced *= 2;
                }
                if (user.vipUntil && user.vipUntil > new Date()) {
                    produced = Math.ceil(produced * 1.2);
                }
                return sum + produced;
            }, 0);
        }
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
                chickenSlots: user.chickenSlots ?? 2,
                sheepSlots: user.sheepSlots ?? 2,
                cowSlots: user.cowSlots ?? 2,
                chickenCards: chickenAnimals
                    .sort((a, b) => (a.slotIndex ?? 1) - (b.slotIndex ?? 1))
                    .map((animal) => {
                    const stats = getAnimalEfficiency({
                        type: animal.type,
                        bornAt: animal.bornAt,
                        lastFedAt: animal.lastFedAt,
                    });
                    return {
                        id: animal.id,
                        type: animal.type,
                        level: animal.level,
                        rarity: animal.rarity ?? "normal",
                        breedBonus: animal.breedBonus ?? 1,
                        slotIndex: animal.slotIndex ?? 1,
                        hp: stats.lifePercent,
                        upgradeFails: animal.upgradeFails ?? 0,
                        lifePercent: stats.lifePercent,
                        efficiencyPercent: stats.efficiencyPercent,
                        daysLeft: stats.daysLeft,
                    };
                }),
                sheepCards: sheepAnimals
                    .sort((a, b) => (a.slotIndex ?? 1) - (b.slotIndex ?? 1))
                    .map((animal) => {
                    const stats = getAnimalEfficiency({
                        type: animal.type,
                        bornAt: animal.bornAt,
                        lastFedAt: animal.lastFedAt,
                    });
                    return {
                        id: animal.id,
                        type: animal.type,
                        level: animal.level,
                        rarity: animal.rarity ?? "normal",
                        breedBonus: animal.breedBonus ?? 1,
                        slotIndex: animal.slotIndex ?? 1,
                        hp: stats.lifePercent,
                        upgradeFails: animal.upgradeFails ?? 0,
                        lifePercent: stats.lifePercent,
                        efficiencyPercent: stats.efficiencyPercent,
                        daysLeft: stats.daysLeft,
                    };
                }),
                cowCards: cowAnimals
                    .sort((a, b) => (a.slotIndex ?? 1) - (b.slotIndex ?? 1))
                    .map((animal) => {
                    const stats = getAnimalEfficiency({
                        type: animal.type,
                        bornAt: animal.bornAt,
                        lastFedAt: animal.lastFedAt,
                    });
                    return {
                        id: animal.id,
                        type: animal.type,
                        level: animal.level,
                        rarity: animal.rarity ?? "normal",
                        breedBonus: animal.breedBonus ?? 1,
                        slotIndex: animal.slotIndex ?? 1,
                        hp: stats.lifePercent,
                        upgradeFails: animal.upgradeFails ?? 0,
                        lifePercent: stats.lifePercent,
                        efficiencyPercent: stats.efficiencyPercent,
                        daysLeft: stats.daysLeft,
                    };
                }),
                chickenLevel: chickenAnimals.length
                    ? Math.max(...chickenAnimals.map((a) => a.level))
                    : 0,
                sheepLevel: sheepAnimals.length
                    ? Math.max(...sheepAnimals.map((a) => a.level))
                    : 0,
                cowLevel: cowAnimals.length
                    ? Math.max(...cowAnimals.map((a) => a.level))
                    : 0,
                chickenLife: chickenAnimals.length
                    ? Math.round(chickenAnimals.reduce((sum, a) => sum +
                        getAnimalEfficiency({
                            type: a.type,
                            bornAt: a.bornAt,
                            lastFedAt: a.lastFedAt,
                        }).lifePercent, 0) / chickenAnimals.length)
                    : 0,
                sheepLife: sheepAnimals.length
                    ? Math.round(sheepAnimals.reduce((sum, a) => sum +
                        getAnimalEfficiency({
                            type: a.type,
                            bornAt: a.bornAt,
                            lastFedAt: a.lastFedAt,
                        }).lifePercent, 0) / sheepAnimals.length)
                    : 0,
                cowLife: cowAnimals.length
                    ? Math.round(cowAnimals.reduce((sum, a) => sum +
                        getAnimalEfficiency({
                            type: a.type,
                            bornAt: a.bornAt,
                            lastFedAt: a.lastFedAt,
                        }).lifePercent, 0) / cowAnimals.length)
                    : 0,
                chickenEfficiency: chickenAnimals.length
                    ? Math.round(chickenAnimals.reduce((sum, a) => sum +
                        getAnimalEfficiency({
                            type: a.type,
                            bornAt: a.bornAt,
                            lastFedAt: a.lastFedAt,
                        }).efficiencyPercent, 0) / chickenAnimals.length)
                    : 0,
                sheepEfficiency: sheepAnimals.length
                    ? Math.round(sheepAnimals.reduce((sum, a) => sum +
                        getAnimalEfficiency({
                            type: a.type,
                            bornAt: a.bornAt,
                            lastFedAt: a.lastFedAt,
                        }).efficiencyPercent, 0) / sheepAnimals.length)
                    : 0,
                cowEfficiency: cowAnimals.length
                    ? Math.round(cowAnimals.reduce((sum, a) => sum +
                        getAnimalEfficiency({
                            type: a.type,
                            bornAt: a.bornAt,
                            lastFedAt: a.lastFedAt,
                        }).efficiencyPercent, 0) / cowAnimals.length)
                    : 0,
                chickenProductionPerHour: Math.floor(getEffectivePerHour("CHICKEN", chickenAnimals)),
                sheepProductionPerHour: Math.floor(getEffectivePerHour("SHEEP", sheepAnimals)),
                cowProductionPerHour: Math.floor(getEffectivePerHour("COW", cowAnimals)),
            },
            storage: {
                eggs: user.storage.eggs ?? 0,
                wool: user.storage.wool ?? 0,
                milk: user.storage.milk ?? 0,
                total: storageTotal,
                capacity: user.storage.capacity ?? 1000,
                sellValue: (user.storage.eggs ?? 0) * 6 +
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
                active: (user.chickenFeed ?? 0) > 0 ||
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
                    deadAnimalsRemoved: deadAnimalDeletes.length,
                },
            },
        });
    }
    catch (e) {
        console.error("STATE ERROR FULL:", e);
        return res.status(500).json({
            error: "Server error",
            details: String(e),
        });
    }
});
exports.default = router;
