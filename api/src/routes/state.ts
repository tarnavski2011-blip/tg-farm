import { Router } from "express";
import { prisma } from "../prisma";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const user = (req as any).telegramUser;

    if (!user?.id) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const telegramId = BigInt(user.id);

    let dbUser = await prisma.user.findUnique({
      where: { telegramId },
    });

    if (!dbUser) {
      dbUser = await prisma.user.create({
        data: {
          telegramId,
          coins: 100,
          diamonds: 0,
        },
      });
    }

    return res.json({
      ok: true,
      user: {
        id: dbUser.telegramId.toString(),
        coins: dbUser.coins,
        diamonds: dbUser.diamonds,
      },
    });
  } catch (e) {
    console.error("STATE ERROR:", e);
    return res.status(500).json({ error: "Server error" });
  }
});

export default router;
