import { Router } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import type { TgAuthedRequest } from "../middleware/telegramAuth";

const router = Router();
router.post("/", async (req: TgAuthedRequest, res) => {
  if (!req.telegramUser?.id) return res.status(401).json({ error: "Unauthorized" });
  const nickname = typeof req.body?.nickname === "string" ? req.body.nickname.trim().replace(/\s+/g, " ") : "";
  if (nickname.length < 3 || nickname.length > 20 || !/^[\p{L}\p{N}_ .-]+$/u.test(nickname)) {
    return res.status(400).json({ error: "Ім'я має містити 3–20 символів: літери, цифри, пробіли, _ . -" });
  }
  // Serialize competing requests and compare case-insensitively in PostgreSQL.
  const normalized = nickname.toLowerCase();
  try {
    const saved = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(91472910)`;
      const duplicates = await tx.$queryRaw<{ id: number }[]>`
        SELECT id FROM "User"
        WHERE LOWER(TRIM(nickname)) = ${normalized}
          AND "telegramId" <> ${BigInt(req.telegramUser!.id)}
        LIMIT 1
      `;
      if (duplicates.length) return null;
      return tx.user.update({
        where: { telegramId: BigInt(req.telegramUser!.id) },
        data: { nickname },
        select: { nickname: true },
      });
    });
    if (!saved) return res.status(409).json({ error: "Це ім'я вже зайняте. Спробуйте інше." });
    return res.json({ ok: true, nickname: saved.nickname });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return res.status(409).json({ error: "Це ім'я вже зайняте. Спробуйте інше." });
    }
    console.error("Nickname update failed", error);
    return res.status(500).json({ error: "Не вдалося зберегти ім'я" });
  }
});
export default router;
