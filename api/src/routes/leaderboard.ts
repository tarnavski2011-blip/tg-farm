import { Router } from "express";
import { prisma } from "../prisma";

const router = Router();

router.get("/", async (req, res) => {
  const top = await prisma.user.findMany({
    orderBy: {
      coins: "desc",
    },
    take: 20,
    select: {
      telegramId: true,
      coins: true,
      level: true,
    },
  });

  res.json(top);
});

export default router;
