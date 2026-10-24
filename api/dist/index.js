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
const telegramAuth_1 = require("./middleware/telegramAuth");
const state_1 = __importDefault(require("./routes/state"));
const levels_1 = __importDefault(require("./routes/levels"));
const nickname_1 = __importDefault(require("./routes/nickname"));
const collect_1 = __importDefault(require("./routes/collect"));
const buyAnimal_1 = __importDefault(require("./routes/buyAnimal"));
const sell_1 = __importDefault(require("./routes/sell"));
const telegram_1 = __importDefault(require("./routes/telegram"));
const boost_1 = __importDefault(require("./routes/boost"));
const lab_1 = __importDefault(require("./routes/lab"));
const daily_1 = __importDefault(require("./routes/daily"));
const quests_1 = __importDefault(require("./routes/quests"));
const wheel_1 = __importDefault(require("./routes/wheel"));
const combo_1 = __importDefault(require("./routes/combo"));
const adminCombo_1 = __importDefault(require("./routes/adminCombo"));
const shop_1 = __importDefault(require("./routes/shop"));
const wallet_1 = __importDefault(require("./routes/wallet"));
const walletConnect_1 = __importDefault(require("./routes/walletConnect"));
const referrals_1 = __importDefault(require("./routes/referrals"));
const tap_1 = __importDefault(require("./routes/tap"));
const breed_1 = __importDefault(require("./routes/breed"));
const upgrade_1 = __importDefault(require("./routes/upgrade"));
const payments_1 = __importDefault(require("./routes/payments"));
const testPayment_1 = __importDefault(require("./routes/testPayment"));
const paymentLogs_1 = __importDefault(require("./routes/paymentLogs"));
const adminPayments_1 = __importDefault(require("./routes/adminPayments"));
const adminDashboard_1 = __importStar(require("./routes/adminDashboard"));
const leaderboard_1 = __importDefault(require("./routes/leaderboard"));
const adminLeaderboardRewards_1 = __importDefault(require("./routes/adminLeaderboardRewards"));
const adminWallet_1 = __importDefault(require("./routes/adminWallet"));
const walletWithdraw_1 = __importDefault(require("./routes/walletWithdraw"));
const adminWithdrawals_1 = __importDefault(require("./routes/adminWithdrawals"));
const heal_1 = __importDefault(require("./routes/heal"));
const unlockSlot_1 = __importDefault(require("./routes/unlockSlot"));
const upgradeAnimal_1 = __importDefault(require("./routes/upgradeAnimal"));
const tonDepositWatcher_1 = require("./services/tonDepositWatcher");
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: false, limit: "4kb" }));
app.get("/", (_req, res) => {
    res.send("tg-farm-api is running");
});
// Telegram webhook
app.use("/telegram", telegram_1.default);
// адмінка без Telegram auth
app.use("/admin", adminDashboard_1.default);
app.use("/admin", adminCombo_1.default);
app.use("/admin/payments", adminDashboard_1.requireAdminSession);
app.use("/admin", adminPayments_1.default);
// payment logs
app.use("/api/payment-logs", paymentLogs_1.default);
// public leaderboard без auth
app.use("/api/leaderboard", leaderboard_1.default);
// auth only for game api
app.use("/api", telegramAuth_1.telegramAuth);
// game routes
app.use("/api/state", state_1.default);
app.use("/api/levels", levels_1.default);
app.use("/api/nickname", nickname_1.default);
app.use("/api/collect", collect_1.default);
app.use("/api/buy-animal", buyAnimal_1.default);
app.use("/api/sell", sell_1.default);
app.use("/api/boost", boost_1.default);
app.use("/api/lab", lab_1.default);
app.use("/api/daily", daily_1.default);
app.use("/api/quests", quests_1.default);
app.use("/api/wheel", wheel_1.default);
app.use("/api/combo", combo_1.default);
app.use("/api/shop", shop_1.default);
app.use("/api/wallet", wallet_1.default);
app.use("/api/wallet", walletConnect_1.default);
app.use("/api/referrals", referrals_1.default);
app.use("/api/tap", tap_1.default);
app.use("/api/breed", breed_1.default);
app.use("/api/upgrade", upgrade_1.default);
app.use("/api/payments", payments_1.default);
app.use("/admin/leaderboard-rewards", adminLeaderboardRewards_1.default);
app.use("/admin", adminWallet_1.default);
app.use("/api/wallet/request-withdraw", walletWithdraw_1.default);
app.use("/admin", adminWithdrawals_1.default);
app.use("/api/heal", heal_1.default);
app.use("/api/unlock-slot", unlockSlot_1.default);
app.use("/api/upgrade-animal", upgradeAnimal_1.default);
// test routes
app.use("/test-payment", testPayment_1.default);
// запуск TON watcher
(0, tonDepositWatcher_1.startTonDepositWatcher)();
const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => {
    console.log(`API running on http://localhost:${port}`);
});
