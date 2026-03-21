import { Router } from "express";
import type { TgAuthedRequest } from "../middleware/telegramAuth";
import { prisma } from "../prisma";
import { getOrCreateStorage, warehouseCapacity } from "./_helpers";

const router = Router();

router.get("/", async (req: TgAuthedRequest, res) => {
  if (!req.tgUserId) return res.status(401).json({ error: "Unauthorized" });

  const telegramId = BigInt(req.tgUserId);
  const user = await prisma.user.findUnique({ where: { telegramId } });
  if (!user) return res.status(404).json({ error: "user not found" });

  const storage = await getOrCreateStorage(user.id);
  const cap = warehouseCapacity(user.warehouseLevel);

  return res.json({
    eggs: storage.eggs,
    wool: storage.wool,
    milk: storage.milk,
    total: storage.eggs + storage.wool + storage.milk,
    capacity: cap,
    warehouseLevel: user.warehouseLevel,
  });
});

export default router;
