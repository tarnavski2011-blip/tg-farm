"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.telegramAuth = void 0;
const crypto_1 = __importDefault(require("crypto"));
const telegramAuth = (req, res, next) => {
    try {
        const initData = req.headers["x-telegram-init-data"];
        if (!initData) {
            return res.status(401).json({ error: "No initData" });
        }
        const botToken = process.env.BOT_TOKEN;
        if (!botToken) {
            return res.status(500).json({ error: "BOT_TOKEN missing" });
        }
        const urlParams = new URLSearchParams(initData);
        const hash = urlParams.get("hash");
        urlParams.delete("hash");
        const dataCheckString = [...urlParams.entries()]
            .map(([key, value]) => `${key}=${value}`)
            .sort()
            .join("\n");
        const secretKey = crypto_1.default.createHash("sha256").update(botToken).digest();
        const hmac = crypto_1.default
            .createHmac("sha256", secretKey)
            .update(dataCheckString)
            .digest("hex");
        if (hmac !== hash) {
            return res.status(401).json({ error: "Unauthorized (bad initData)" });
        }
        // витягуємо user
        const user = JSON.parse(urlParams.get("user") || "{}");
        req.telegramUser = user;
        next();
    }
    catch (e) {
        return res.status(401).json({ error: "Auth error" });
    }
};
exports.telegramAuth = telegramAuth;
