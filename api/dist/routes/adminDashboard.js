"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAdminSession = requireAdminSession;
const animalHp_1 = require("../lib/animalHp");
const express_1 = require("express");
const crypto_1 = __importDefault(require("crypto"));
const prisma_1 = require("../prisma");
const router = (0, express_1.Router)();
const COOKIE = "farm_admin_session";
const TTL = 8 * 60 * 60;
const esc = (v) => String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
const fmt = (v) => new Intl.NumberFormat("uk-UA", { maximumFractionDigits: 3 }).format(v);
const date = (v) => v.toISOString().slice(0, 16).replace("T", " ") + " UTC";
function secret() {
    return process.env.ADMIN_SECRET || "";
}
function signature(exp) {
    return crypto_1.default.createHmac("sha256", secret()).update(exp).digest("hex");
}
function authorized(req) {
    if (!secret())
        return false;
    const match = (req.headers.cookie || "")
        .split(";")
        .map((x) => x.trim())
        .find((x) => x.startsWith(COOKIE + "="));
    if (!match)
        return false;
    const value = match.slice(COOKIE.length + 1);
    const [exp, sig] = value.split(".");
    if (!exp ||
        !sig ||
        !/^\d+$/.test(exp) ||
        Number(exp) < Math.floor(Date.now() / 1000))
        return false;
    const expected = signature(exp);
    return (sig.length === expected.length &&
        crypto_1.default.timingSafeEqual(Buffer.from(sig), Buffer.from(expected)));
}
function requireAdminSession(req, res, next) {
    if (authorized(req))
        return next();
    res
        .status(401)
        .send(page("Доступ заборонено", `<section class="panel"><h2>Потрібен вхід адміністратора</h2><a href="/admin/dashboard">Перейти до входу</a></section>`));
}
function page(title, content) {
    return `<!doctype html><html lang="uk"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer"><meta http-equiv="Cache-Control" content="no-store"><title>${esc(title)} · My Farm Clicker</title><style>
 :root{color-scheme:dark}*{box-sizing:border-box}body{margin:0;background:#0b1220;color:#e5edf9;font:15px system-ui,Arial,sans-serif}main{max-width:1220px;margin:auto;padding:22px 15px 55px}a{color:#93c5fd;text-decoration:none}header{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:22px}h1{font-size:24px;margin:0}h2{font-size:17px;margin:0 0 16px}.muted{color:#a7b5c9;font-size:13px}.grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin:18px 0}.tile,.panel{background:#172338;border:1px solid #2a3b56;border-radius:16px;padding:17px}.tile strong{display:block;font-size:25px;margin:8px 0 2px;overflow-wrap:anywhere}.tile span{font-size:12px;color:#a7b5c9}.panel{margin:14px 0;overflow:auto}.tablewrap{overflow-x:auto}table{border-collapse:collapse;width:100%;min-width:640px}th,td{text-align:left;padding:11px 9px;border-bottom:1px solid #2a3b56;font-size:13px;white-space:nowrap}th{color:#9db5d8}input,button{padding:12px;border-radius:10px;border:1px solid #3d5578;background:#0c182a;color:white;font:inherit}button{background:#2563eb;border:0;cursor:pointer;font-weight:700}.row{display:flex;gap:9px;align-items:center;flex-wrap:wrap}.row input{flex:1;min-width:180px}.nav{display:flex;gap:14px;flex-wrap:wrap}.warning{color:#fcd34d}.error{color:#fca5a5}.small{font-size:12px}@media(max-width:780px){.grid{grid-template-columns:repeat(2,minmax(0,1fr))}.tile strong{font-size:21px}h1{font-size:21px}}@media(max-width:390px){.grid{gap:8px}.tile{padding:12px}} </style></head><body><main>${content}</main></body></html>`;
}
router.get("/dashboard", async (req, res) => {
    res.set("Cache-Control", "no-store");
    if (!authorized(req))
        return res.send(page("Вхід", `<header><h1>🚜 My Farm Clicker · Admin</h1></header><section class="panel" style="max-width:440px"><h2>Вхід адміністратора</h2><form method="post" action="/admin/dashboard/login"><div class="row"><input type="password" name="secret" placeholder="ADMIN_SECRET" required autocomplete="current-password"><button>Увійти</button></div></form><p class="muted">Секрет має бути встановлений у Render → API → Environment.</p></section>`));
    try {
        const now = new Date();
        const d1 = new Date(now.getTime() - 86400000);
        const d7 = new Date(now.getTime() - 7 * 86400000);
        const q = String(req.query.q || "")
            .trim()
            .slice(0, 80);
        const numericId = /^\d{1,18}$/.test(q) ? BigInt(q) : null;
        const requestedPage = Number(req.query.page || 1);
        const playerPage = Number.isSafeInteger(requestedPage) && requestedPage > 0
            ? Math.min(requestedPage, 100000)
            : 1;
        const pageSize = 30;
        const where = q
            ? {
                OR: [
                    ...(numericId ? [{ telegramId: numericId }] : []),
                    { nickname: { contains: q, mode: "insensitive" } },
                ],
            }
            : {};
        const [users, new7, active24, active7, balances, storage, animals, pending, pendingSum, paid, deposits, purchases, matchedUsers, recentUsers, withdrawals, recentDeposits, recentPurchases,] = await Promise.all([
            prisma_1.prisma.user.count(),
            prisma_1.prisma.user.count({ where: { createdAt: { gte: d7 } } }),
            prisma_1.prisma.user.count({ where: { lastSeenAt: { gte: d1 } } }),
            prisma_1.prisma.user.count({ where: { lastSeenAt: { gte: d7 } } }),
            prisma_1.prisma.user.aggregate({
                _sum: { coins: true, diamonds: true, points: true, tonBalance: true },
            }),
            prisma_1.prisma.storage.aggregate({
                _sum: { pendingPoints: true, eggs: true, wool: true, milk: true },
            }),
            prisma_1.prisma.animal.count(),
            prisma_1.prisma.withdrawalRequest.count({ where: { status: "pending" } }),
            prisma_1.prisma.withdrawalRequest.aggregate({
                where: { status: "pending" },
                _sum: { pointsAmount: true, tonAmount: true },
            }),
            prisma_1.prisma.withdrawalRequest.aggregate({
                where: { status: "approved" },
                _sum: { tonAmount: true },
            }),
            prisma_1.prisma.tonDeposit.aggregate({
                _sum: { amount: true },
                _count: { _all: true },
            }),
            prisma_1.prisma.payment.aggregate({
                where: { status: "paid" },
                _count: { _all: true },
            }),
            prisma_1.prisma.user.count({ where }),
            prisma_1.prisma.user.findMany({
                where,
                orderBy: [{ createdAt: "desc" }, { id: "desc" }],
                skip: (playerPage - 1) * pageSize,
                take: pageSize,
                select: {
                    telegramId: true,
                    nickname: true,
                    level: true,
                    coins: true,
                    points: true,
                    diamonds: true,
                    createdAt: true,
                    lastSeenAt: true,
                    _count: { select: { animals: true } },
                },
            }),
            prisma_1.prisma.withdrawalRequest.findMany({
                orderBy: { createdAt: "desc" },
                take: 15,
                select: {
                    id: true,
                    status: true,
                    pointsAmount: true,
                    tonAmount: true,
                    createdAt: true,
                    user: { select: { telegramId: true, nickname: true } },
                },
            }),
            prisma_1.prisma.tonDeposit.findMany({
                orderBy: { createdAt: "desc" },
                take: 10,
                select: {
                    amount: true,
                    createdAt: true,
                    user: { select: { telegramId: true, nickname: true } },
                },
            }),
            prisma_1.prisma.payment.findMany({
                orderBy: { createdAt: "desc" },
                take: 10,
                select: {
                    id: true,
                    amount: true,
                    currency: true,
                    status: true,
                    productCode: true,
                    createdAt: true,
                    user: { select: { nickname: true, telegramId: true } },
                },
            }),
        ]);
        const pages = Math.max(1, Math.ceil(matchedUsers / pageSize));
        const playerUrl = (pageNumber) => `/admin/dashboard?${q ? `q=${encodeURIComponent(q)}&` : ""}page=${pageNumber}#players`;
        const pagination = `<div class="row" style="justify-content:space-between;margin-top:14px"><span class="muted">Знайдено: ${fmt(matchedUsers)} · Сторінка ${playerPage} з ${pages}</span><div class="row">${playerPage > 1 ? `<a href="${playerUrl(playerPage - 1)}">← Назад</a>` : ""}${playerPage < pages ? `<a href="${playerUrl(playerPage + 1)}">Далі →</a>` : ""}</div></div>`;
        const tile = (label, value, note = "") => `<div class="tile"><span>${esc(label)}</span><strong>${esc(value)}</strong><span>${esc(note)}</span></div>`;
        const userName = (u) => esc(u.nickname || u.telegramId.toString());
        const nav = `<nav class="nav"><a href="/admin/combo">🧩 Комбо дня</a><a href="#players">Гравці</a><a href="#economy">Економіка</a><a href="#withdrawals">Виведення</a><a href="#deposits">Поповнення</a><a href="#purchases">Stars</a></nav>`;
        const html = `<header><div><h1>🚜 My Farm Clicker · Admin V1</h1><div class="muted">Статистика на ${esc(date(now))}</div></div><form method="post" action="/admin/dashboard/logout"><button>Вийти</button></form></header>${nav}
  <div class="grid">${tile("Всього гравців", fmt(users))}${tile("Нові за 7 днів", fmt(new7))}${tile("Активні за 24 год", fmt(active24), "За lastSeenAt")}${tile("Активні за 7 днів", fmt(active7), "За lastSeenAt")}${tile("Тварин у грі", fmt(animals))}${tile("Заявки в очікуванні", fmt(pending))}${tile("Поповнень TON", fmt(deposits._count._all))}${tile("Успішних Stars-покупок", fmt(purchases._count._all))}</div>
  <section class="panel" id="economy"><h2>💰 Економіка</h2><div class="grid">${tile("Points на балансах", fmt(balances._sum.points || 0))}${tile("Points на складах", fmt(storage._sum.pendingPoints || 0))}${tile("Points у заявках", fmt(pendingSum._sum.pointsAmount || 0))}${tile("Сума заявок (поле tonAmount)", fmt(pendingSum._sum.tonAmount || 0))}${tile("Coins", fmt(balances._sum.coins || 0))}${tile("Diamonds", fmt(balances._sum.diamonds || 0))}${tile("TON поповнено", fmt(deposits._sum.amount || 0))}${tile("Сума схвалених заявок", fmt(paid._sum.tonAmount || 0))}</div><p class="muted warning">⚠️ Поле tonAmount у базі не доводить, що виплату GRAM виконано. «Схвалено» не означає «виплачено». Резерв гаманця та реальний борг не розраховуються без перевіреного курсу й історії транзакцій.</p></section>
  <section class="panel" id="players"><h2>👥 Гравці</h2><form class="row" method="get" action="/admin/dashboard"><input name="q" placeholder="Нікнейм або точний Telegram ID" value="${esc(q)}"><button>Знайти</button><a href="/admin/dashboard">Очистити</a></form><div class="tablewrap"><table><thead><tr><th>Гравець</th><th>Telegram ID</th><th>Рівень</th><th>Coins</th><th>Points</th><th>Diamonds</th><th>Тварини</th><th>Остання активність</th></tr></thead><tbody>${recentUsers.map((u) => `<tr><td><a href="/admin/dashboard/player/${encodeURIComponent(u.telegramId.toString())}">${userName(u)} ↗</a></td><td>${esc(u.telegramId.toString())}</td><td>${u.level}</td><td>${fmt(u.coins)}</td><td>${fmt(u.points)}</td><td>${fmt(u.diamonds)}</td><td>${u._count.animals}</td><td>${date(u.lastSeenAt)}</td></tr>`).join("") || '<tr><td colspan="8">Немає результатів</td></tr>'}</tbody></table></div>${pagination}</section>
  <section class="panel" id="withdrawals"><h2>💸 Останні заявки</h2><div class="tablewrap"><table><tr><th>ID</th><th>Гравець</th><th>Points</th><th>tonAmount</th><th>Статус</th><th>Дата</th></tr>${withdrawals.map((w) => `<tr><td>${w.id}</td><td>${userName(w.user)}</td><td>${fmt(w.pointsAmount)}</td><td>${fmt(w.tonAmount)}</td><td>${esc(w.status)}</td><td>${date(w.createdAt)}</td></tr>`).join("")}</table></div></section>
  <section class="panel" id="deposits"><h2>💎 Останні TON-поповнення</h2><div class="tablewrap"><table><tr><th>Гравець</th><th>TON</th><th>Дата</th></tr>${recentDeposits.map((d) => `<tr><td>${userName(d.user)}</td><td>${fmt(d.amount)}</td><td>${date(d.createdAt)}</td></tr>`).join("")}</table></div></section>
  <section class="panel" id="purchases"><h2>⭐ Останні покупки Stars</h2><div class="tablewrap"><table><tr><th>ID</th><th>Гравець</th><th>Продукт</th><th>Сума</th><th>Валюта</th><th>Статус</th></tr>${recentPurchases.map((p) => `<tr><td>${p.id}</td><td>${userName(p.user)}</td><td>${esc(p.productCode)}</td><td>${fmt(p.amount)}</td><td>${esc(p.currency)}</td><td>${esc(p.status)}</td></tr>`).join("")}</table></div></section><p class="muted">V1 · тільки перегляд · Дані з PostgreSQL</p>`;
        return res.send(page("Статистика", html));
    }
    catch (e) {
        console.error("ADMIN DASHBOARD:", e);
        return res
            .status(500)
            .send(page("Помилка", `<section class="panel"><h2>Не вдалося завантажити статистику</h2><p>Перевір логи API на Render.</p></section>`));
    }
});
router.get("/dashboard/player/:telegramId", async (req, res) => {
    res.set("Cache-Control", "no-store");
    if (!authorized(req))
        return res.redirect(303, "/admin/dashboard");
    const raw = String(req.params.telegramId || "");
    if (!/^\d{1,18}$/.test(raw))
        return res
            .status(400)
            .send(page("Помилка", '<section class="panel">Невірний Telegram ID</section>'));
    try {
        const user = await prisma_1.prisma.user.findUnique({
            where: { telegramId: BigInt(raw) },
            select: {
                id: true,
                telegramId: true,
                nickname: true,
                createdAt: true,
                lastSeenAt: true,
                level: true,
                xp: true,
                coins: true,
                points: true,
                diamonds: true,
                tonBalance: true,
                warehouseLevel: true,
                labLevel: true,
                chickenFeed: true,
                sheepFeed: true,
                cowFeed: true,
                vipUntil: true,
                boostUntil: true,
                animals: {
                    orderBy: [{ type: "asc" }, { level: "desc" }],
                    select: {
                        id: true,
                        type: true,
                        level: true,
                        hp: true,
                        hpUpdatedAt: true,
                        bornAt: true,
                        rarity: true,
                        breedBonus: true,
                        slotIndex: true,
                        createdAt: true,
                    },
                },
                storage: {
                    select: {
                        eggs: true,
                        wool: true,
                        milk: true,
                        capacity: true,
                        pendingPoints: true,
                        updatedAt: true,
                    },
                },
                referrals: { select: { id: true } },
                payments: {
                    orderBy: { createdAt: "desc" },
                    take: 30,
                    select: {
                        id: true,
                        productCode: true,
                        amount: true,
                        currency: true,
                        status: true,
                        createdAt: true,
                        paidAt: true,
                    },
                },
                tonDeposits: {
                    orderBy: { createdAt: "desc" },
                    take: 30,
                    select: { id: true, amount: true, createdAt: true },
                },
                withdrawals: {
                    orderBy: { createdAt: "desc" },
                    take: 30,
                    select: {
                        id: true,
                        pointsAmount: true,
                        tonAmount: true,
                        status: true,
                        createdAt: true,
                    },
                },
            },
        });
        if (!user)
            return res
                .status(404)
                .send(page("Не знайдено", '<section class="panel">Гравця не знайдено. <a href="/admin/dashboard#players">Назад до списку</a></section>'));
        const tile = (label, value) => `<div class="tile"><span>${esc(label)}</span><strong>${esc(value)}</strong></div>`;
        const tr = (cells) => `<tr>${cells.map((v) => `<td>${esc(v)}</td>`).join("")}</tr>`;
        const table = (heads, rows, empty = "Немає записів") => `<div class="tablewrap"><table><thead><tr>${heads.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${rows.join("") || `<tr><td colspan="${heads.length}">${esc(empty)}</td></tr>`}</tbody></table></div>`;
        // Match the HP currently displayed by the player state endpoint.
        const displayedHp = (a) => (0, animalHp_1.getCurrentHp)(a);
        const s = user.storage;
        const name = esc(user.nickname || user.telegramId.toString());
        const html = `<header><div><h1>👤 ${name}</h1><div class="muted">Telegram ID: ${esc(user.telegramId.toString())} · ID у базі: ${user.id}</div></div><a href="/admin/dashboard#players">← До списку гравців</a></header>
  <div class="grid">${tile("Рівень", user.level)}${tile("XP", fmt(user.xp))}${tile("Coins", fmt(user.coins))}${tile("Points", fmt(user.points))}${tile("Diamonds", fmt(user.diamonds))}${tile("TON баланс у грі", fmt(user.tonBalance))}${tile("Тварин", user.animals.length)}${tile("Рефералів", user.referrals.length)}</div>
  <section class="panel"><h2>👤 Профіль та розвиток</h2><p>Зареєстрований: ${date(user.createdAt)}<br>Остання активність: ${date(user.lastSeenAt)}<br>Рівень складу: ${user.warehouseLevel} · Лабораторія: ${user.labLevel}<br>VIP до: ${user.vipUntil ? date(user.vipUntil) : "Немає"} · Буст до: ${user.boostUntil ? date(user.boostUntil) : "Немає"}</p></section>
  <section class="panel"><h2>🐔 Тварини (${user.animals.length})</h2>${table(["ID", "Тип", "Рівень", "HP", "Рідкість", "Бонус", "Слот", "Дата"], user.animals.map((a) => tr([
            a.id,
            a.type,
            a.level,
            `${displayedHp(a)}%`,
            a.rarity,
            a.breedBonus,
            a.slotIndex,
            date(a.createdAt),
        ])))}</section>
  <section class="panel"><h2>📦 Склад</h2><div class="grid">${tile("Points на складі", fmt(s?.pendingPoints || 0))}${tile("Яйця", fmt(s?.eggs || 0))}${tile("Вовна", fmt(s?.wool || 0))}${tile("Молоко", fmt(s?.milk || 0))}${tile("Місткість", fmt(s?.capacity || 0))}${tile("Корм курей", fmt(user.chickenFeed))}${tile("Корм овець", fmt(user.sheepFeed))}${tile("Корм корів", fmt(user.cowFeed))}</div></section>
  <section class="panel"><h2>💸 Заявки на виведення (останні 30)</h2>${table(["ID", "Points", "tonAmount (поле БД)", "Статус", "Дата"], user.withdrawals.map((w) => tr([
            w.id,
            fmt(w.pointsAmount),
            fmt(w.tonAmount),
            w.status,
            date(w.createdAt),
        ])))}</section>
  <section class="panel"><h2>💎 TON-поповнення (останні 30)</h2>${table(["ID", "TON", "Дата"], user.tonDeposits.map((d) => tr([d.id, fmt(d.amount), date(d.createdAt)])))}</section>
  <section class="panel"><h2>⭐ Stars-покупки (останні 30)</h2>${table(["ID", "Продукт", "Сума", "Валюта", "Статус", "Створено", "Оплачено"], user.payments.map((p) => tr([
            p.id,
            p.productCode,
            fmt(p.amount),
            p.currency,
            p.status,
            date(p.createdAt),
            p.paidAt ? date(p.paidAt) : "—",
        ])))}</section>
  <p class="muted">Admin V1.2 · Тільки перегляд. Pending Stars не є підтвердженою оплатою. Approved-заявка не підтверджує фактичний переказ GRAM.</p>`;
        return res.send(page("Профіль гравця", html));
    }
    catch (e) {
        console.error("ADMIN PLAYER:", e);
        return res
            .status(500)
            .send(page("Помилка", '<section class="panel">Не вдалося завантажити профіль. Перевір логи Render.</section>'));
    }
});
router.post("/dashboard/login", (req, res) => {
    const supplied = String(req.body?.secret || "");
    const key = secret();
    if (!key ||
        supplied.length !== key.length ||
        !crypto_1.default.timingSafeEqual(Buffer.from(supplied), Buffer.from(key)))
        return res
            .status(401)
            .send(page("Помилка входу", '<section class="panel"><h2>Невірний ключ</h2><a href="/admin/dashboard">Спробувати ще раз</a></section>'));
    const exp = String(Math.floor(Date.now() / 1000) + TTL);
    res.cookie(COOKIE, `${exp}.${signature(exp)}`, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: TTL * 1000,
        path: "/admin",
    });
    return res.redirect(303, "/admin/dashboard");
});
router.post("/dashboard/logout", (_req, res) => {
    res.clearCookie(COOKIE, { path: "/admin" });
    res.redirect(303, "/admin/dashboard");
});
exports.default = router;
