"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.COMBO_ITEMS = void 0;
exports.comboDay = comboDay;
exports.generatedCombo = generatedCombo;
exports.comboForDay = comboForDay;
exports.validCombo = validCombo;
exports.nextReset = nextReset;
const express_1 = require("express");
const crypto_1 = __importDefault(require("crypto"));
const prisma_1 = require("../prisma");
const router = (0, express_1.Router)();
exports.COMBO_ITEMS = [
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
const ids = new Set(exports.COMBO_ITEMS.map((x) => x.id));
function comboDay(now = new Date()) {
    return new Intl.DateTimeFormat("en-CA", {
        timeZone: "Europe/Prague",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).format(now);
}
function generatedCombo(day) {
    const hash = crypto_1.default
        .createHmac("sha256", process.env.COMBO_SECRET || process.env.BOT_TOKEN || "dev-only-combo-key")
        .update(`my-farm-combo-v1:${day}`)
        .digest();
    const pool = exports.COMBO_ITEMS.map((x) => x.id);
    const result = [];
    for (let i = 0; i < 3; i++)
        result.push(pool.splice(hash.readUInt32BE(i * 4) % pool.length, 1)[0]);
    return result;
}
async function comboForDay(day, tx = prisma_1.prisma) {
    const overrides = (await tx.$queryRawUnsafe('SELECT "items" FROM "DailyCombo" WHERE "day" = $1', day));
    return overrides[0]?.items || generatedCombo(day);
}
function validCombo(items) {
    return (Array.isArray(items) &&
        items.length === 3 &&
        new Set(items).size === 3 &&
        items.every((x) => typeof x === "string" && ids.has(x)));
}
function nextReset(now = new Date()) {
    // Calculate Prague's next midnight without assuming a fixed UTC offset (DST).
    let lo = now.getTime(), hi = lo + 27 * 3600000;
    const today = comboDay(now);
    while (hi - lo > 1000) {
        const mid = Math.floor((hi + lo) / 2);
        if (comboDay(new Date(mid)) === today)
            lo = mid;
        else
            hi = mid;
    }
    return new Date(hi).toISOString();
}
router.get("/state", async (req, res) => {
    try {
        if (!req.telegramUser?.id)
            return res.status(401).json({ error: "Unauthorized" });
        const user = await prisma_1.prisma.user.findUnique({
            where: { telegramId: BigInt(req.telegramUser.id) },
            select: { id: true },
        });
        if (!user)
            return res.status(404).json({ error: "Гравця не знайдено" });
        const day = comboDay();
        const attempts = (await prisma_1.prisma.$queryRawUnsafe('SELECT "won" FROM "DailyComboAttempt" WHERE "day" = $1 AND "userId" = $2 ORDER BY "attemptNo"', day, user.id));
        return res.json({
            day,
            items: exports.COMBO_ITEMS,
            attemptsUsed: attempts.length,
            attemptsLeft: Math.max(0, 3 - attempts.length),
            won: attempts.some((x) => x.won),
            reward: 500,
            nextResetAt: nextReset(),
        });
    }
    catch (err) {
        console.error("COMBO STATE", err);
        return res.status(500).json({ error: "Помилка сервера" });
    }
});
router.post("/guess", async (req, res) => {
    try {
        if (!req.telegramUser?.id)
            return res.status(401).json({ error: "Unauthorized" });
        if (!validCombo(req.body?.items))
            return res.status(400).json({ error: "Вибери три різні предмети" });
        const user = await prisma_1.prisma.user.findUnique({
            where: { telegramId: BigInt(req.telegramUser.id) },
            select: { id: true },
        });
        if (!user)
            return res.status(404).json({ error: "Гравця не знайдено" });
        const result = await prisma_1.prisma.$transaction(async (tx) => {
            const day = comboDay();
            // Serialize guesses for the same user, including across API instances.
            await tx.$queryRawUnsafe("SELECT 1::int AS locked FROM (SELECT pg_advisory_xact_lock($1::int, $2::int)) AS lock_row", user.id, 987654);
            const previous = (await tx.$queryRawUnsafe('SELECT "won" FROM "DailyComboAttempt" WHERE "day" = $1 AND "userId" = $2 ORDER BY "attemptNo"', day, user.id));
            if (previous.some((x) => x.won))
                return { error: "Комбо вже розгадане", status: 409 };
            if (previous.length >= 3)
                return { error: "Спроби закінчилися", status: 409 };
            const answer = await comboForDay(day, tx);
            const won = answer.every((x, i) => x === req.body.items[i]);
            await tx.$executeRawUnsafe('INSERT INTO "DailyComboAttempt" ("day", "userId", "attemptNo", "items", "won") VALUES ($1,$2,$3,ARRAY(SELECT jsonb_array_elements_text($4::jsonb)),$5)', day, user.id, previous.length + 1, JSON.stringify(req.body.items), won);
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
    }
    catch (err) {
        console.error("COMBO GUESS", err);
        return res.status(500).json({ error: "Помилка сервера" });
    }
});
exports.default = router;
