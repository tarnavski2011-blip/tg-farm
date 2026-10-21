import { Router } from "express";
import crypto from "crypto";
import { prisma } from "../prisma";
import type { TgAuthedRequest } from "../middleware/telegramAuth";

const router = Router();
export const COMBO_ITEMS = [
  { id: "chicken", emoji: "🐔", name: "Курка" },
  { id: "sheep", emoji: "🐑", name: "Вівця" },
  { id: "cow", emoji: "🐄", name: "Корова" },
  { id: "egg", emoji: "🥚", name: "Яйце" },
  { id: "milk", emoji: "🥛", name: "Молоко" },
  { id: "wool", emoji: "🧶", name: "Вовна" },
  { id: "corn", emoji: "🌽", name: "Кукурудза" },
  { id: "carrot", emoji: "🥕", name: "Морква" },
  { id: "wheat", emoji: "🌾", name: "Пшениця" },
  { id: "tractor", emoji: "🚜", name: "Трактор" },
  { id: "barn", emoji: "🏠", name: "Сарай" },
  { id: "apple", emoji: "🍎", name: "Яблуко" },
];
const ids = new Set(COMBO_ITEMS.map((x) => x.id));
export function comboDay(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Prague",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
export function generatedCombo(day: string) {
  const hash = crypto
    .createHmac(
      "sha256",
      process.env.COMBO_SECRET || process.env.BOT_TOKEN || "dev-only-combo-key",
    )
    .update(`my-farm-combo-v1:${day}`)
    .digest();
  const pool = COMBO_ITEMS.map((x) => x.id);
  const result: string[] = [];
  for (let i = 0; i < 3; i++)
    result.push(pool.splice(hash.readUInt32BE(i * 4) % pool.length, 1)[0]);
  return result;
}
export async function comboForDay(day: string, tx: any = prisma) {
  const overrides = (await tx.$queryRawUnsafe(
    'SELECT "items" FROM "DailyCombo" WHERE "day" = $1',
    day,
  )) as { items: string[] }[];
  return overrides[0]?.items || generatedCombo(day);
}
export function validCombo(items: unknown): items is string[] {
  return (
    Array.isArray(items) &&
    items.length === 3 &&
    new Set(items).size === 3 &&
    items.every((x) => typeof x === "string" && ids.has(x))
  );
}
export function nextReset(now = new Date()) {
  // Calculate Prague's next midnight without assuming a fixed UTC offset (DST).
  let lo = now.getTime(),
    hi = lo + 27 * 3600_000;
  const today = comboDay(now);
  while (hi - lo > 1000) {
    const mid = Math.floor((hi + lo) / 2);
    if (comboDay(new Date(mid)) === today) lo = mid;
    else hi = mid;
  }
  return new Date(hi).toISOString();
}
router.get("/state", async (req: TgAuthedRequest, res) => {
  try {
    if (!req.telegramUser?.id)
      return res.status(401).json({ error: "Unauthorized" });
    const user = await prisma.user.findUnique({
      where: { telegramId: BigInt(req.telegramUser.id) },
      select: { id: true },
    });
    if (!user) return res.status(404).json({ error: "Гравця не знайдено" });
    const day = comboDay();
    const attempts = (await prisma.$queryRawUnsafe(
      'SELECT "won" FROM "DailyComboAttempt" WHERE "day" = $1 AND "userId" = $2 ORDER BY "attemptNo"',
      day,
      user.id,
    )) as { won: boolean }[];
    return res.json({
      day,
      items: COMBO_ITEMS,
      attemptsUsed: attempts.length,
      attemptsLeft: Math.max(0, 3 - attempts.length),
      won: attempts.some((x) => x.won),
      reward: 500,
      nextResetAt: nextReset(),
    });
  } catch (err) {
    console.error("COMBO STATE", err);
    return res.status(500).json({ error: "Помилка сервера" });
  }
});
router.post("/guess", async (req: TgAuthedRequest, res) => {
  try {
    if (!req.telegramUser?.id)
      return res.status(401).json({ error: "Unauthorized" });
    if (!validCombo(req.body?.items))
      return res.status(400).json({ error: "Вибери три різні предмети" });
    const user = await prisma.user.findUnique({
      where: { telegramId: BigInt(req.telegramUser.id) },
      select: { id: true },
    });
    if (!user) return res.status(404).json({ error: "Гравця не знайдено" });
    const result = await prisma.$transaction(async (tx: any) => {
      const day = comboDay();
      // Serialize guesses for the same user, including across API instances.
      await tx.$queryRawUnsafe(
        "SELECT 1::int AS locked FROM (SELECT pg_advisory_xact_lock($1::int, $2::int)) AS lock_row",
        user.id,
        987654,
      );
      const previous = (await tx.$queryRawUnsafe(
        'SELECT "won" FROM "DailyComboAttempt" WHERE "day" = $1 AND "userId" = $2 ORDER BY "attemptNo"',
        day,
        user.id,
      )) as { won: boolean }[];
      if (previous.some((x) => x.won))
        return { error: "Комбо вже розгадане", status: 409 };
      if (previous.length >= 3)
        return { error: "Спроби закінчилися", status: 409 };
      const answer = await comboForDay(day, tx);
      const won = answer.every((x, i) => x === req.body.items[i]);
      await tx.$executeRawUnsafe(
        'INSERT INTO "DailyComboAttempt" ("day", "userId", "attemptNo", "items", "won") VALUES ($1,$2,$3,ARRAY(SELECT jsonb_array_elements_text($4::jsonb)),$5)',
        day,
        user.id,
        previous.length + 1,
        JSON.stringify(req.body.items),
        won,
      );
      if (won)
        await tx.user.update({
          where: { id: user.id },
          data: { points: { increment: 500 } },
        });
      return {
        ok: true,
        won,
        reward: won ? 500 : 0,
        attemptsLeft: 2 - previous.length,
        day,
      };
    });
    if ("error" in result) {
      const status = typeof result.status === "number" ? result.status : 409;
      return res.status(status).json({ error: result.error });
    }
    return res.json(result);
  } catch (err) {
    console.error("COMBO GUESS", err);
    return res.status(500).json({ error: "Помилка сервера" });
  }
});
export default router;
