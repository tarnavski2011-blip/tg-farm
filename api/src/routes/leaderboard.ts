import { Router } from "express";
import { prisma } from "../prisma";

const router = Router();

router.get("/", async (_req, res) => {
  try {
    const referrals = await prisma.referral.groupBy({
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

    const leaderboard = await Promise.all(
      referrals.map(async (r, i) => {
        const user = await prisma.user.findUnique({
          where: { id: r.referrerId },
          select: {
            telegramId: true,
            coins: true,
            points: true,
          },
        });

        return {
          rank: i + 1,
          telegramId: user?.telegramId.toString() || "unknown",
          referrals: r._count.referrerId,
          coins: user?.coins ?? 0,
          points: user?.points ?? 0,
        };
      }),
    );

    return res.json({
      ok: true,
      leaderboard,
    });
  } catch (err) {
    console.error("Leaderboard error:", err);
    return res.status(500).json({ error: "Leaderboard failed" });
  }
});

export default router;
