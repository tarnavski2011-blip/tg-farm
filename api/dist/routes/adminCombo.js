"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../prisma");
const adminDashboard_1 = require("./adminDashboard");
const combo_1 = require("./combo");
const router = (0, express_1.Router)();
router.use(adminDashboard_1.requireAdminSession);
const esc = (s) => String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
const label = (id) => {
    const x = combo_1.COMBO_ITEMS.find((x) => x.id === id);
    return x ? `${x.emoji} ${x.name}` : id;
};
const today = () => (0, combo_1.comboDay)();
router.get("/combo", async (_req, res) => {
    try {
        const start = today();
        const days = Array.from({ length: 30 }, (_, i) => {
            const d = new Date(start + "T12:00:00Z");
            d.setUTCDate(d.getUTCDate() + i);
            return d.toISOString().slice(0, 10);
        });
        const records = await Promise.all(days.map(async (day) => {
            const items = await (0, combo_1.comboForDay)(day);
            const count = (await prisma_1.prisma.$queryRawUnsafe('SELECT COUNT(*)::int AS "count" FROM "DailyComboAttempt" WHERE "day" = $1 AND "won" = true', day));
            return { day, items, count: count[0]?.count || 0 };
        }));
        const rows = records
            .map(({ day, items, count }) => `<tr><td>${day}</td><td>${items.map(label).map(esc).join(" → ")}</td><td>${count}</td><td><form method="post" action="/admin/combo/set" style="display:flex;gap:6px;flex-wrap:wrap"><input type="hidden" name="day" value="${day}">${[0, 1, 2].map((n) => `<select name="item${n}">${combo_1.COMBO_ITEMS.map((x) => `<option value="${x.id}" ${items[n] === x.id ? "selected" : ""}>${esc(label(x.id))}</option>`).join("")}</select>`).join("")}<button>Зберегти</button></form><form method="post" action="/admin/combo/reset"><input type="hidden" name="day" value="${day}"><button>Авто</button></form></td></tr>`)
            .join("");
        res.set("Cache-Control", "no-store");
        res.send(`<!doctype html><html lang="uk"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Комбо дня · Admin</title><style>body{font:15px system-ui;background:#0b1220;color:#e5edf9;margin:20px}a{color:#93c5fd}table{border-collapse:collapse;width:100%}td,th{border-bottom:1px solid #334155;padding:10px;text-align:left}input,select,button{padding:8px;background:#1e293b;color:white;border:1px solid #475569;border-radius:7px}form{display:inline-flex;gap:6px;margin:3px} .wrap{overflow-x:auto}</style><h1>🧩 Комбо дня · Адмін</h1><p><a href="/admin/dashboard">← До панелі</a> · Час: Europe/Prague · 500 Points · 3 спроби</p><p>Комбінації автоматичні, однакові для всіх. Редагування сьогоднішнього комбо після перших спроб може бути несправедливим до гравців.</p><div class="wrap"><table><thead><tr><th>Дата</th><th>Комбо</th><th>Переможців</th><th>Змінити</th></tr></thead><tbody>${rows}</tbody></table></div></html>`);
    }
    catch (e) {
        console.error("ADMIN COMBO", e);
        res.status(500).send("Помилка комбо. Перевір міграцію бази даних.");
    }
});
router.post("/combo/set", async (req, res) => {
    const day = String(req.body?.day || "");
    const items = [req.body?.item0, req.body?.item1, req.body?.item2];
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || day < today() || !(0, combo_1.validCombo)(items))
        return res.status(400).send("Невірна дата або предмети");
    try {
        await prisma_1.prisma.$executeRawUnsafe('INSERT INTO "DailyCombo" ("day","items") VALUES ($1,ARRAY(SELECT jsonb_array_elements_text($2::jsonb))) ON CONFLICT ("day") DO UPDATE SET "items" = EXCLUDED."items"', day, JSON.stringify(items));
        return res.redirect(303, "/admin/combo");
    }
    catch (e) {
        console.error(e);
        return res.status(500).send("Не вдалося зберегти");
    }
});
router.post("/combo/reset", async (req, res) => {
    const day = String(req.body?.day || "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || day < today())
        return res.status(400).send("Невірна дата");
    await prisma_1.prisma.$executeRawUnsafe('DELETE FROM "DailyCombo" WHERE "day" = $1', day);
    res.redirect(303, "/admin/combo");
});
exports.default = router;
