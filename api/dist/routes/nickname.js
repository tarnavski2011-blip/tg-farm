"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const client_1 = require("@prisma/client");
const prisma_1 = require("../prisma");
const router = (0, express_1.Router)();
router.post("/", async (req, res) => {
    if (!req.telegramUser?.id)
        return res.status(401).json({ error: "Unauthorized" });
    const nickname = typeof req.body?.nickname === "string" ? req.body.nickname.trim().replace(/\s+/g, " ") : "";
    if (nickname.length < 3 || nickname.length > 20 || !/^[\p{L}\p{N}_ .-]+$/u.test(nickname)) {
        return res.status(400).json({ error: "Ім'я має містити 3–20 символів: літери, цифри, пробіли, _ . -" });
    }
    // Serialize competing requests and compare case-insensitively in PostgreSQL.
    const normalized = nickname.toLowerCase();
    try {
        const saved = await prisma_1.prisma.$transaction(async (tx) => {
            await tx.$executeRaw `SELECT pg_advisory_xact_lock(91472910)`;
            const duplicates = await tx.$queryRaw `
        SELECT id FROM "User"
        WHERE LOWER(TRIM(nickname)) = ${normalized}
          AND "telegramId" <> ${BigInt(req.telegramUser.id)}
        LIMIT 1
      `;
            if (duplicates.length)
                return null;
            return tx.user.update({
                where: { telegramId: BigInt(req.telegramUser.id) },
                data: { nickname },
                select: { nickname: true },
            });
        });
        if (!saved)
            return res.status(409).json({ error: "Це ім'я вже зайняте. Спробуйте інше." });
        return res.json({ ok: true, nickname: saved.nickname });
    }
    catch (error) {
        if (error instanceof client_1.Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
            return res.status(409).json({ error: "Це ім'я вже зайняте. Спробуйте інше." });
        }
        console.error("Nickname update failed", error);
        return res.status(500).json({ error: "Не вдалося зберегти ім'я" });
    }
});
exports.default = router;
