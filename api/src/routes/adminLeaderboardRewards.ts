import { Router } from "express";
import { prisma } from "../prisma";

const router = Router();

router.post("/", async (_req, res) => {
  try {
    const period = new Date().toISOString().slice(0, 10);

    const topUsers = await prisma.user.findMany({
      take: 10,
      orderBy: {
        points: "desc",
      },
      select: {
        id: true,
        telegramId: true,
      },
    });

    const rewards = [];

    for (let i = 0; i < topUsers.length; i++) {
      const user = topUsers[i];
      const rank = i + 1;

      let reward = "";

      if (rank === 1) {
        await prisma.user.update({
          where: { id: user.id },
          data: {
            diamonds: {
              increment: 100,
            },
          },
        });

        reward = "100 diamonds";
      } else if (rank <= 3) {
        const vipUntil = new Date();
        vipUntil.setDate(vipUntil.getDate() + 3);

        await prisma.user.update({
          where: { id: user.id },
          data: {
            vipUntil,
          },
        });

        reward = "VIP 3 days";
      } else {
        await prisma.user.update({
          where: { id: user.id },
          data: {
            coins: {
              increment: 5000,
            },
          },
        });

        reward = "5000 coins";
      }

      rewards.push({
        telegramId: user.telegramId.toString(),
        rank,
        reward,
      });
    }

    return res.json({
      ok: true,
      period,
      rewards,
    });
  } catch (e) {
    console.error("ADMIN LEADERBOARD ERROR:", e);

    return res.status(500).json({
      ok: false,
      error: "Server error",
    });
  }
});

export default router;
