"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../prisma");
const router = (0, express_1.Router)();
router.get("/", async (req, res) => {
    try {
        const type = String(req.query.type || "referrals");
        if (type === "coins") {
            const users = await prisma_1.prisma.user.findMany({
                take: 10,
                orderBy: {
                    coins: "desc",
                },
                select: {
                    telegramId: true,
                    coins: true,
                    points: true,
                },
            });
            return res.json({
                ok: true,
                type: "coins",
                leaderboard: users.map((u, i) => ({
                    rank: i + 1,
                    telegramId: u.telegramId.toString(),
                    value: u.coins,
                    coins: u.coins,
                    points: u.points,
                    referrals: 0,
                })),
            });
        }
        if (type === "points") {
            const users = await prisma_1.prisma.user.findMany({
                take: 10,
                orderBy: {
                    points: "desc",
                },
                select: {
                    telegramId: true,
                    coins: true,
                    points: true,
                },
            });
            return res.json({
                ok: true,
                type: "points",
                leaderboard: users.map((u, i) => ({
                    rank: i + 1,
                    telegramId: u.telegramId.toString(),
                    value: u.points,
                    coins: u.coins,
                    points: u.points,
                    referrals: 0,
                })),
            });
        }
        // default: referrals
        const referralGroups = await prisma_1.prisma.referral.groupBy({
            by: ["referrerId"],
            _count: {
                referrerId: true,
            },
            orderBy: {
                _count: {
                    referrerId: "desc",
                },
            },
            take: 10,
        });
        const leaderboard = await Promise.all(referralGroups.map(async (r, i) => {
            const user = await prisma_1.prisma.user.findUnique({
                where: {
                    id: r.referrerId,
                },
                select: {
                    telegramId: true,
                    coins: true,
                    points: true,
                },
            });
            return {
                rank: i + 1,
                telegramId: user?.telegramId.toString() || "unknown",
                value: r._count.referrerId,
                referrals: r._count.referrerId,
                coins: user?.coins ?? 0,
                points: user?.points ?? 0,
            };
        }));
        return res.json({
            ok: true,
            type: "referrals",
            leaderboard,
        });
    }
    catch (e) {
        console.error("LEADERBOARD ERROR:", e);
        return res.status(500).json({
            ok: false,
            error: "Server error",
        });
    }
});
exports.default = router;
