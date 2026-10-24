"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const questMetrics_1 = require("../lib/questMetrics");
const express_1 = require("express");
const prisma_1 = require("../prisma");
const router = (0, express_1.Router)();
const CHANNEL = "@myfarmclickerofficial";
async function isChannelMember(telegramId) {
    const token = process.env.BOT_TOKEN;
    if (!token)
        throw new Error("BOT_TOKEN is missing");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
        const url = `https://api.telegram.org/bot${token}/getChatMember?chat_id=${encodeURIComponent(CHANNEL)}&user_id=${telegramId.toString()}`;
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok)
            throw new Error(`Telegram API HTTP ${response.status}`);
        const data = (await response.json());
        if (!data.ok || !data.result)
            throw new Error("Telegram membership check failed");
        const { status, is_member } = data.result;
        return (status === "creator" ||
            status === "administrator" ||
            status === "member" ||
            (status === "restricted" && is_member === true));
    }
    finally {
        clearTimeout(timeout);
    }
}
const defs = [
    { code: "d_visits", title: "Зайди в гру 3 рази", group: "daily", metric: "visits", target: 3, coins: 100 },
    { code: "d_taps", title: "Зроби тапи", group: "daily", metric: "taps", target: 100, coins: 150, scaled: true },
    { code: "d_feeds", title: "Погодуй тварин 3 рази", group: "daily", metric: "feeds", target: 3, coins: 200 },
    { code: "d_collect", title: "Продай продукцію 3 рази", group: "daily", metric: "sells", target: 3, xp: 150 },
    { code: "d_resources", title: "Продай ресурси", group: "daily", metric: "resources", target: 100, coins: 100, scaled: true },
    { code: "d_points", title: "Зароби Points", group: "daily", metric: "points", target: 100, xp: 150, scaled: true },
    { code: "d_heal", title: "Вилікуй одну тварину", group: "daily", metric: "heals", target: 1, coins: 200 },
    { code: "d_five", title: "Виконай 5 щоденних завдань", group: "daily", metric: "daily_claims", target: 5, diamonds: 2 },
    { code: "w_days", title: "Зайди в гру 7 різних днів", group: "weekly", metric: "login_days", target: 7, diamonds: 5 },
    { code: "w_taps", title: "Зроби тапи за тиждень", group: "weekly", metric: "taps", target: 2000, coins: 1000, scaled: true },
    { code: "w_collect", title: "Продай продукцію 30 разів", group: "weekly", metric: "sells", target: 30, xp: 500 },
    { code: "w_resources", title: "Продай ресурси за тиждень", group: "weekly", metric: "resources", target: 2000, diamonds: 3, scaled: true },
    { code: "w_points", title: "Зароби Points за тиждень", group: "weekly", metric: "points", target: 1000, xp: 500, scaled: true },
    { code: "w_feeds", title: "Погодуй тварин 20 разів", group: "weekly", metric: "feeds", target: 20, coins: 1000 },
    { code: "w_dailies", title: "Виконай 25 щоденних завдань", group: "weekly", metric: "daily_claims", target: 25, diamonds: 5 }
];
function targetFor(q, level) { if (!q.scaled)
    return q.target; const mult = level <= 5 ? 1 : level <= 10 ? 2.5 : level <= 15 ? 5 : level <= 20 ? 7.5 : 10; return Math.ceil(q.target * mult); }
function rewardText(q) { return q.coins ? `${q.coins} монет` : q.diamonds ? `${q.diamonds} 💎` : `${q.xp} XP`; }
async function snapshot(userId, level) {
    const d = "d:" + (0, questMetrics_1.dayKey)(), w = (0, questMetrics_1.weekKey)();
    const [counters, claims] = await Promise.all([prisma_1.prisma.questCounter.findMany({ where: { userId, period: { in: [d, w] } } }), prisma_1.prisma.questPeriodClaim.findMany({ where: { userId, period: { in: [d, w] } } })]);
    const value = (period, metric) => metric === "login_days" ? counters.filter(c => c.period === period && c.metric.startsWith("login_day:")).length : metric === "daily_claims" ? period === d ? claims.filter(c => c.period === d && c.code.startsWith("d_") && c.code !== "d_five").length : (counters.find(c => c.period === w && c.metric === "daily_claims")?.value ?? 0) : (counters.find(c => c.period === period && c.metric === metric)?.value ?? 0);
    return defs.map(q => { const period = q.group === "daily" ? d : w; const progress = value(period, q.metric); const target = targetFor(q, level); return { code: q.code, title: q.title, group: q.group, reward: rewardText(q), progress, target, done: progress >= target, claimed: claims.some(c => c.period === period && c.code === q.code) }; });
}
router.get("/", async (req, res) => {
    try {
        const user = await prisma_1.prisma.user.findUnique({ where: { telegramId: BigInt(req.telegramUser.id) }, include: { achievementClaims: true } });
        if (!user)
            return res.status(404).json({ error: "User not found" });
        await (0, questMetrics_1.recordQuestVisit)(user.id);
        const quests = await snapshot(user.id, user.level);
        quests.push({ code: "telegram_channel", title: "Підпишись на Telegram-канал", group: "special", reward: "10 💎", progress: 0, target: 1, done: false, claimed: user.achievementClaims.some(c => c.code === "telegram_channel" && c.claimed) });
        return res.json({ ok: true, quests });
    }
    catch (e) {
        console.error("QUESTS ERROR", e);
        return res.status(500).json({ error: "Server error" });
    }
});
router.post("/claim", async (req, res) => {
    try {
        const telegramId = BigInt(req.telegramUser.id);
        const code = String(req.body?.code ?? "");
        const user = await prisma_1.prisma.user.findUnique({ where: { telegramId } });
        if (!user)
            return res.status(404).json({ error: "User not found" });
        if (code === "telegram_channel") {
            let subscribed;
            try {
                subscribed = await isChannelMember(telegramId);
            }
            catch (err) {
                console.error("TELEGRAM MEMBERSHIP ERROR:", err);
                return res
                    .status(503)
                    .json({ error: "Не вдалося перевірити підписку. Спробуй пізніше." });
            }
            if (!subscribed)
                return res.status(400).json({ error: "Спочатку підпишись на канал." });
            try {
                await prisma_1.prisma.$transaction(async (tx) => {
                    await tx.achievementClaim.create({
                        data: {
                            userId: user.id,
                            code,
                            claimed: true,
                            claimedAt: new Date(),
                        },
                    });
                    await tx.user.update({
                        where: { id: user.id },
                        data: { diamonds: { increment: 10 } },
                    });
                });
            }
            catch (err) {
                if (err?.code === "P2002")
                    return res.status(409).json({ error: "Нагороду вже отримано." });
                throw err;
            }
            return res.json({
                ok: true,
                reward: "10 💎",
                rewardCoins: 0,
                rewardDiamonds: 10,
            });
        }
        const q = defs.find(x => x.code === code);
        if (!q)
            return res.status(400).json({ error: "Невідоме завдання" });
        const quest = (await snapshot(user.id, user.level)).find(x => x.code === code);
        if (quest.claimed)
            return res.status(409).json({ error: "Нагороду вже отримано" });
        if (!quest.done)
            return res.status(400).json({ error: "Завдання ще не виконано" });
        const period = q.group === "daily" ? "d:" + (0, questMetrics_1.dayKey)() : (0, questMetrics_1.weekKey)();
        try {
            await prisma_1.prisma.$transaction(async (tx) => {
                await tx.questPeriodClaim.create({ data: { userId: user.id, period, code } });
                const current = await tx.user.findUniqueOrThrow({ where: { id: user.id } });
                let level = current.level, xp = current.xp + (q.xp ?? 0), levelCoins = 0, levelDiamonds = 0;
                while (xp >= 100 + level * 50) {
                    xp -= 100 + level * 50;
                    level++;
                    levelCoins += level * 100;
                    if (level % 5 === 0)
                        levelDiamonds += 2;
                }
                await tx.user.update({ where: { id: user.id }, data: { coins: { increment: (q.coins ?? 0) + levelCoins }, diamonds: { increment: (q.diamonds ?? 0) + levelDiamonds }, xp, level } });
            });
        }
        catch (e) {
            if (e?.code === "P2002")
                return res.status(409).json({ error: "Нагороду вже отримано" });
            throw e;
        }
        if (q.group === "daily") {
            // Weekly daily-claim count is maintained independently of the daily period.
            await prisma_1.prisma.questCounter.upsert({ where: { userId_period_metric: { userId: user.id, period: (0, questMetrics_1.weekKey)(), metric: "daily_claims" } }, create: { userId: user.id, period: (0, questMetrics_1.weekKey)(), metric: "daily_claims", value: 1 }, update: { value: { increment: 1 } } });
        }
        return res.json({ ok: true, reward: rewardText(q), rewardCoins: q.coins ?? 0, rewardDiamonds: q.diamonds ?? 0, rewardXp: q.xp ?? 0 });
    }
    catch (e) {
        console.error("QUEST CLAIM ERROR", e);
        return res.status(500).json({ error: "Server error" });
    }
});
exports.default = router;
