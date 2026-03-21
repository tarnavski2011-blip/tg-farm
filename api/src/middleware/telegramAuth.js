"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyTelegramInitData = verifyTelegramInitData;
exports.telegramAuth = telegramAuth;
const crypto_1 = __importDefault(require("crypto"));
function parseInitData(initData) {
    const params = new URLSearchParams(initData);
    const obj = {};
    for (const [k, v] of params.entries())
        obj[k] = v;
    return obj;
}
function buildDataCheckString(data) {
    return Object.keys(data)
        .filter((k) => k !== "hash")
        .sort()
        .map((k) => `${k}=${data[k]}`)
        .join("\n");
}
function sha256(data) {
    return crypto_1.default.createHash("sha256").update(data).digest();
}
function hmacSha256(key, data) {
    return crypto_1.default.createHmac("sha256", key).update(data).digest("hex");
}
function verifyTelegramInitData(initData, botToken) {
    if (!initData)
        return null;
    const data = parseInitData(initData);
    const receivedHash = data.hash;
    if (!receivedHash)
        return null;
    const dataCheckString = buildDataCheckString(data);
    // secretKey = HMAC_SHA256("WebAppData", botToken)
    const secretKey = crypto_1.default
        .createHmac("sha256", "WebAppData")
        .update(botToken)
        .digest();
    const computedHash = hmacSha256(secretKey, dataCheckString);
    if (computedHash !== receivedHash)
        return null;
    const userStr = data.user;
    if (!userStr)
        return null;
    try {
        const user = JSON.parse(userStr);
        const id = user?.id;
        if (!id)
            return null;
        return { userId: String(id) };
    }
    catch {
        return null;
    }
}
function telegramAuth(req, res, next) {
    const botToken = process.env.BOT_TOKEN ?? "";
    if (!botToken) {
        return res.status(500).json({ error: "BOT_TOKEN is not set" });
    }
    const initData = String(req.headers["x-telegram-init-data"] ?? "");
    // тимчасові логи для перевірки
    console.log("initData length =", initData.length);
    console.log("initData head =", initData.slice(0, 80));
    const verified = verifyTelegramInitData(initData, botToken);
    if (!verified) {
        return res.status(401).json({ error: "Unauthorized (bad initData)" });
    }
    req.tgUserId = verified.userId;
    next();
}
//# sourceMappingURL=telegramAuth.js.map