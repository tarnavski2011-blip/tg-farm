"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dayKey = dayKey;
exports.weekKey = weekKey;
exports.recordQuestMetric = recordQuestMetric;
exports.recordQuestVisit = recordQuestVisit;
const prisma_1 = require("../prisma");
function dayKey(d = new Date()) { return d.toISOString().slice(0, 10); }
function weekKey(d = new Date()) { const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())); const day = (x.getUTCDay() + 6) % 7; x.setUTCDate(x.getUTCDate() - day); return "w:" + dayKey(x); }
async function recordQuestMetric(userId, metric, amount = 1) {
    if (!Number.isFinite(amount) || amount <= 0)
        return;
    const value = Math.floor(amount);
    await prisma_1.prisma.$transaction(["d:" + dayKey(), weekKey(), "all"].map(period => prisma_1.prisma.questCounter.upsert({ where: { userId_period_metric: { userId, period, metric } }, create: { userId, period, metric, value }, update: { value: { increment: value } } })));
}
async function recordQuestVisit(userId) {
    // Count at most one visit per 60-minute interval; simultaneous requests are idempotent.
    const now = new Date();
    const slot = `visit:${dayKey(now)}:${Math.floor((now.getUTCHours() * 60 + now.getUTCMinutes()) / 60)}`;
    try {
        await prisma_1.prisma.questCounter.create({ data: { userId, period: slot, metric: "visit_slot", value: 1 } });
        await recordQuestMetric(userId, "visits", 1);
    }
    catch (e) {
        if (e?.code !== "P2002")
            throw e;
    }
    const day = "d:" + dayKey(now);
    const week = weekKey(now);
    try {
        await prisma_1.prisma.questCounter.create({ data: { userId, period: week, metric: "login_day:" + dayKey(now), value: 1 } });
    }
    catch (e) {
        if (e?.code !== "P2002")
            throw e;
    }
}
