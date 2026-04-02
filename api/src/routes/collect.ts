import { Router } from "express";
import { prisma } from "../prisma";

const router = Router();

router.post("/", async (req: any, res) => {
  try {
    const telegramId = req.telegramUser.id;

    const user = await prisma.user.findUnique({
      where: { telegramId },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    let eggs = user.eggs;
    let milk = user.milk;
    let wool = user.wool;

    // 🐔 КУРКИ
    if (user.chickens > 0 && user.chickenFeed > 0) {
      eggs += user.chickens;
      await prisma.user.update({
        where: { id: user.id },
        data: { chickenFeed: { decrement: user.chickens } },
      });
    }

    // 🐄 КОРОВИ
    if (user.cows > 0 && user.cowFeed > 0) {
      milk += user.cows;
      await prisma.user.update({
        where: { id: user.id },
        data: { cowFeed: { decrement: user.cows } },
      });
    }

    // 🐑 ВІВЦІ
    if (user.sheep > 0 && user.sheepFeed > 0) {
      wool += user.sheep;
      await prisma.user.update({
        where: { id: user.id },
        data: { sheepFeed: { decrement: user.sheep } },
      });
    }

    // 💾 зберігаємо ресурси
    await prisma.user.update({
      where: { id: user.id },
      data: {
        eggs,
        milk,
        wool,
      },
    });

    res.json({ eggs, milk, wool });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "collect error" });
  }
});

export default router;
