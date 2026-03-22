"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../prisma");
const router = (0, express_1.Router)();
const CHICKEN_RATE_PER_MIN = 1;
const SHEEP_RATE_PER_MIN = 1;
const COW_RATE_PER_MIN = 1;
const MAX_OFFLINE_MINUTES = 8 * 60; // максимум 8 годин
function secondsLeft(futureDate) {
    if (!futureDate)
        return 0;
    const diff = Math.floor((futureDate.getTime() - Date.now()) / 1000);
    return diff > 0 ? diff : 0;
}
router.get("/", async (req, res) => {
    if (!req.tgUserId) {
        return res.status(401).json({ error: "Unauthorized" });
    }
    const telegramId = BigInt(req.tgUserId);
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
                coins: 0,
                diamonds: 0,
                points: 0,
                lastSeenAt: new Date(),
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
    const lastSeenAt = user.lastSeenAt ?? now;
    let offlineMinutes = Math.floor((now.getTime() - lastSeenAt.getTime()) / 60000);
    if (offlineMinutes < 0)
        offlineMinutes = 0;
    if (offlineMinutes > MAX_OFFLINE_MINUTES)
        offlineMinutes = MAX_OFFLINE_MINUTES;
    const chickenCount = user.animals.filter((a) => a.type === "CHICKEN").length;
    const sheepCount = user.animals.filter((a) => a.type === "SHEEP").length;
    const cowCount = user.animals.filter((a) => a.type === "COW").length;
    const feedActive = secondsLeft(user.feedUntil) > 0;
    let offlineAdded = {
        eggs: 0,
        wool: 0,
        milk: 0,
    };
    if (offlineMinutes > 0 && feedActive) {
        offlineAdded = {
            eggs: chickenCount * CHICKEN_RATE_PER_MIN * offlineMinutes,
            wool: sheepCount * SHEEP_RATE_PER_MIN * offlineMinutes,
            milk: cowCount * COW_RATE_PER_MIN * offlineMinutes,
        };
        const currentTotal = (user.storage?.eggs ?? 0) +
            (user.storage?.wool ?? 0) +
            (user.storage?.milk ?? 0);
        const freeSpace = Math.max(0, (user.storage?.capacity ?? 0) - currentTotal);
        const totalToAdd = offlineAdded.eggs + offlineAdded.wool + offlineAdded.milk;
        if (totalToAdd > freeSpace && totalToAdd > 0) {
            const ratio = freeSpace / totalToAdd;
            offlineAdded.eggs = Math.floor(offlineAdded.eggs * ratio);
            offlineAdded.wool = Math.floor(offlineAdded.wool * ratio);
            offlineAdded.milk = Math.floor(offlineAdded.milk * ratio);
        }
        user = await prisma_1.prisma.user.update({
            where: { id: user.id },
            data: {
                lastSeenAt: now,
                storage: {
                    update: {
                        eggs: { increment: offlineAdded.eggs },
                        wool: { increment: offlineAdded.wool },
                        milk: { increment: offlineAdded.milk },
                    },
                },
            },
            include: {
                animals: true,
                storage: true,
            },
        });
    }
    else {
        user = await prisma_1.prisma.user.update({
            where: { id: user.id },
            data: {
                lastSeenAt: now,
            },
            include: {
                animals: true,
                storage: true,
            },
        });
    }
    const eggsReady = user.animals
        .filter((a) => a.type === "CHICKEN")
        .reduce((sum, a) => sum + a.level, 0);
    const woolReady = user.animals
        .filter((a) => a.type === "SHEEP")
        .reduce((sum, a) => sum + a.level, 0);
    const milkReady = user.animals
        .filter((a) => a.type === "COW")
        .reduce((sum, a) => sum + a.level, 0);
    const storageTotal = (user.storage?.eggs ?? 0) +
        (user.storage?.wool ?? 0) +
        (user.storage?.milk ?? 0);
    return res.json({
        coins: user.coins,
        diamonds: user.diamonds,
        points: user.points,
        animals: {
            chicken: chickenCount,
            sheep: sheepCount,
            cow: cowCount,
        },
        storage: {
            eggs: user.storage?.eggs ?? 0,
            wool: user.storage?.wool ?? 0,
            milk: user.storage?.milk ?? 0,
            total: storageTotal,
            capacity: user.storage?.capacity ?? 0,
        },
        ready: {
            eggsReady,
            woolReady,
            milkReady,
        },
        levels: {
            warehouseLevel: user.warehouseLevel ?? 1,
            warehouseCapacity: user.storage?.capacity ?? 1000,
            labLevel: user.labLevel ?? 1,
            labMultiplier: user.labMultiplier ?? 1,
        },
        feed: {
            active: feedActive,
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
            dailyStreak: user.dailyStreak ?? 0,
        },
        offline: {
            minutes: offlineMinutes,
            added: offlineAdded,
        },
    });
});
exports.default = router;
