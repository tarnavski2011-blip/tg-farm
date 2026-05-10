"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../prisma");
const router = (0, express_1.Router)();
const NEW_USER_BONUS_COINS = 1000;
const NEW_USER_BONUS_DIAMONDS = 10;
const REFERRER_BONUS_COINS = 500;
const REFERRER_BONUS_POINTS = 5000;
const REFERRER_BONUS_DIAMONDS = 5;
function makeRefCode(userId) {
    return `REF${userId}`;
}
function parseRefCode(code) {
    const cleaned = code.trim().toUpperCase();
    if (!cleaned.startsWith("REF"))
        return null;
    const rawId = cleaned.slice(3);
    if (!/^\d+$/.test(rawId))
        return null;
    return Number(rawId);
}
router.get("/", async (req, res) => {
    try {
        if (!req.telegramUser?.id) {
            return res.status(401).json({ error: "Unauthorized" });
        }
        const telegramId = BigInt(req.telegramUser.id);
        const user = await prisma_1.prisma.user.findUnique({
            where: { telegramId },
            select: { id: true },
        });
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }
        const totalRefs = await prisma_1.prisma.referral.count({
            where: { referrerId: user.id },
        });
        const earnedCoins = totalRefs * REFERRER_BONUS_COINS;
        const earnedPoints = totalRefs * REFERRER_BONUS_POINTS;
        const earnedDiamonds = totalRefs * REFERRER_BONUS_DIAMONDS;
        return res.json({
            ok: true,
            myCode: makeRefCode(user.id),
            totalRefs,
            earnedCoins,
            earnedPoints,
            earnedDiamonds,
            bonuses: {
                newUser: {
                    coins: NEW_USER_BONUS_COINS,
                    diamonds: NEW_USER_BONUS_DIAMONDS,
                },
                referrer: {
                    coins: REFERRER_BONUS_COINS,
                    points: REFERRER_BONUS_POINTS,
                    diamonds: REFERRER_BONUS_DIAMONDS,
                },
            },
        });
    }
    catch (e) {
        console.error("REFERRALS GET ERROR:", e);
        return res.status(500).json({ error: "Server error" });
    }
});
router.post("/apply", async (req, res) => {
    try {
        if (!req.telegramUser?.id) {
            return res.status(401).json({ error: "Unauthorized" });
        }
        const code = String(req.body?.code ?? "").trim();
        const referrerId = parseRefCode(code);
        if (!referrerId) {
            return res.status(400).json({ error: "Невірний код" });
        }
        const telegramId = BigInt(req.telegramUser.id);
        const user = await prisma_1.prisma.user.findUnique({
            where: { telegramId },
            select: {
                id: true,
                referredById: true,
            },
        });
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }
        if (user.id === referrerId) {
            return res.status(400).json({ error: "Не можна ввести свій код" });
        }
        const existingReferral = await prisma_1.prisma.referral.findUnique({
            where: { referredId: user.id },
            select: { id: true },
        });
        if (existingReferral || user.referredById) {
            return res
                .status(400)
                .json({ error: "Реферальний код вже застосований" });
        }
        const referrer = await prisma_1.prisma.user.findUnique({
            where: { id: referrerId },
            select: { id: true },
        });
        if (!referrer) {
            return res.status(404).json({ error: "Реферер не знайдений" });
        }
        await prisma_1.prisma.$transaction([
            prisma_1.prisma.user.update({
                where: { id: user.id },
                data: {
                    coins: { increment: NEW_USER_BONUS_COINS },
                    diamonds: { increment: NEW_USER_BONUS_DIAMONDS },
                    referredById: referrer.id,
                },
            }),
            prisma_1.prisma.user.update({
                where: { id: referrer.id },
                data: {
                    coins: { increment: REFERRER_BONUS_COINS },
                    points: { increment: REFERRER_BONUS_POINTS },
                    diamonds: { increment: REFERRER_BONUS_DIAMONDS },
                },
            }),
            prisma_1.prisma.referral.create({
                data: {
                    referrerId: referrer.id,
                    referredId: user.id,
                },
            }),
        ]);
        return res.json({
            ok: true,
            rewardYou: {
                coins: NEW_USER_BONUS_COINS,
                diamonds: NEW_USER_BONUS_DIAMONDS,
            },
            rewardReferrer: {
                coins: REFERRER_BONUS_COINS,
                points: REFERRER_BONUS_POINTS,
                diamonds: REFERRER_BONUS_DIAMONDS,
            },
        });
    }
    catch (e) {
        console.error("REFERRALS APPLY ERROR:", e);
        return res.status(500).json({ error: "Server error" });
    }
});
exports.default = router;
