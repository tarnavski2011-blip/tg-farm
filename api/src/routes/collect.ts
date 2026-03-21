import { Router } from "express";
import { prisma } from "../prisma";
import { antiSpamPerUser } from "../middleware/antiSpam";
import { requestLockByUser } from "../middleware/requestLock";

const router = Router();

export async function collectToStorageByUserId(userId: number) {
  const animals = await prisma.animal.findMany({
    where: { userId },
  });

  if (!animals.length) return;

  let eggs = 0;
  let wool = 0;
  let milk = 0;

  const now = Date.now();

  for (const animal of animals) {
    const last = animal.lastClaim.getTime();
    const seconds = Math.floor((now - last) / 1000);

    if (seconds <= 0) continue;

    const cycles = Math.floor(seconds / 30);
    if (cycles <= 0) continue;

    if (animal.type === "CHICKEN") {
      eggs += cycles * animal.level;
    }

    if (animal.type === "SHEEP") {
      wool += cycles * animal.level;
    }

    if (animal.type === "COW") {
      milk += cycles * animal.level;
    }

    await prisma.animal.update({
      where: { id: animal.id },
      data: {
        lastClaim: new Date(),
      },
    });
  }

  if (eggs === 0 && wool === 0 && milk === 0) return;

  await prisma.storage.upsert({
    where: { userId },
    create: {
      userId,
      eggs,
      wool,
      milk,
    },
    update: {
      eggs: { increment: eggs },
      wool: { increment: wool },
      milk: { increment: milk },
    },
  });
}

router.post(
  "/claim",
  antiSpamPerUser(2000, 3), // максимум 3 collect за 2 секунди
  requestLockByUser(1200), // блокує подвійні кліки
  async (req, res) => {
    const telegramIdStr = String(req.body?.telegramId ?? "");

    if (!telegramIdStr) {
      return res.status(400).json({ error: "telegramId is required" });
    }

    let telegramId: bigint;

    try {
      telegramId = BigInt(telegramIdStr);
    } catch {
      return res
        .status(400)
        .json({ error: "telegramId must be an integer string" });
    }

    const user = await prisma.user.findUnique({
      where: { telegramId },
    });

    if (!user) {
      return res.status(404).json({ error: "user not found" });
    }

    await collectToStorageByUserId(user.id);

    const storage = await prisma.storage.findUnique({
      where: { userId: user.id },
    });

    return res.json({
      eggs: storage?.eggs ?? 0,
      wool: storage?.wool ?? 0,
      milk: storage?.milk ?? 0,
    });
  },
);

export default router;
