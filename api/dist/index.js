"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
require("dotenv/config");
const prisma_1 = require("./prisma");
const telegramAuth_1 = require("./middleware/telegramAuth");
const state_1 = __importDefault(require("./routes/state"));
const tap_1 = __importDefault(require("./routes/tap"));
const feed_1 = __importDefault(require("./routes/feed"));
const animals_1 = __importDefault(require("./routes/animals"));
const collect_1 = __importStar(require("./routes/collect"));
const storage_1 = __importDefault(require("./routes/storage"));
const sell_1 = __importDefault(require("./routes/sell"));
const upgrade_1 = __importDefault(require("./routes/upgrade"));
const daily_1 = __importDefault(require("./routes/daily"));
const boost_1 = __importDefault(require("./routes/boost"));
const autocollect_1 = __importDefault(require("./routes/autocollect"));
const xp_1 = __importDefault(require("./routes/xp"));
const level_1 = __importDefault(require("./routes/level"));
const leaderboard_1 = __importDefault(require("./routes/leaderboard"));
const achievements_1 = __importDefault(require("./routes/achievements"));
const referral_1 = __importDefault(require("./routes/referral"));
const animalUpgrade_1 = __importDefault(require("./routes/animalUpgrade"));
const wheel_1 = __importDefault(require("./routes/wheel"));
const quests_1 = __importDefault(require("./routes/quests"));
const shop_1 = __importDefault(require("./routes/shop"));
const dailyLogin_1 = __importDefault(require("./routes/dailyLogin"));
const boosters_1 = __importDefault(require("./routes/boosters"));
const payments_1 = __importDefault(require("./routes/payments"));
const telegram_1 = __importDefault(require("./routes/telegram"));
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
app.use(express_1.default.json());
// Telegram webhook
app.use("/telegram", telegram_1.default);
// Telegram auth для всіх /api/*
app.use("/api", telegramAuth_1.telegramAuth);
// routes
app.use("/api/state", state_1.default);
app.use("/api/tap", tap_1.default);
app.use("/api/feed", feed_1.default);
app.use("/api/animals", animals_1.default);
app.use("/api/collect", collect_1.default);
app.use("/api/storage", storage_1.default);
app.use("/api/sell", sell_1.default);
app.use("/api/upgrade", upgrade_1.default);
app.use("/api/daily", daily_1.default);
app.use("/api/boost", boost_1.default);
app.use("/api/autocollect", autocollect_1.default);
app.use("/api/xp", xp_1.default);
app.use("/api/level", level_1.default);
app.use("/api/leaderboard", leaderboard_1.default);
app.use("/api/achievements", achievements_1.default);
app.use("/api/referral", referral_1.default);
app.use("/api/animal-upgrade", animalUpgrade_1.default);
app.use("/api/wheel", wheel_1.default);
app.use("/api/quests", quests_1.default);
app.use("/api/shop", shop_1.default);
app.use("/api/daily-login", dailyLogin_1.default);
app.use("/api/boosters", boosters_1.default);
app.use("/api/payments", payments_1.default);
const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => {
    console.log(`API running on http://localhost:${port}`);
});
// Автозбір раз на 10 сек для тих, у кого активний autoCollect
const AUTO_COLLECT_INTERVAL_MS = 10000;
setInterval(async () => {
    try {
        const now = new Date();
        const users = await prisma_1.prisma.user.findMany({
            where: { autoCollectUntil: { gt: now } },
            select: { id: true },
        });
        for (const u of users) {
            try {
                await (0, collect_1.collectToStorageByUserId)(u.id);
            }
            catch {
                // ignore user-level errors
            }
        }
    }
    catch {
        // ignore interval-level errors
    }
}, AUTO_COLLECT_INTERVAL_MS);
