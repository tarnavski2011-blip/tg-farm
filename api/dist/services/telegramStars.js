"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.parsePayload = parsePayload;
exports.answerPreCheckoutQuery = answerPreCheckoutQuery;
exports.createStarsInvoiceLink = createStarsInvoiceLink;
const axios_1 = __importDefault(require("axios"));
const BOT_TOKEN = process.env.BOT_TOKEN;
if (!BOT_TOKEN) {
    throw new Error("BOT_TOKEN not set");
}
const TG_API = `https://api.telegram.org/bot${BOT_TOKEN}`;
function parsePayload(payload) {
    try {
        const parts = payload.split(":");
        if (parts.length !== 3)
            return null;
        if (parts[0] !== "stars")
            return null;
        const userId = Number(parts[1]);
        const paymentId = Number(parts[2]);
        if (!Number.isFinite(userId) || !Number.isFinite(paymentId)) {
            return null;
        }
        return { userId, paymentId };
    }
    catch {
        return null;
    }
}
async function answerPreCheckoutQuery(id, ok, errorMessage) {
    await axios_1.default.post(`${TG_API}/answerPreCheckoutQuery`, {
        pre_checkout_query_id: id,
        ok,
        error_message: errorMessage,
    });
}
async function createStarsInvoiceLink(params) {
    const res = await axios_1.default.post(`${TG_API}/createInvoiceLink`, {
        title: params.title,
        description: params.description,
        payload: params.payload,
        provider_token: "",
        currency: "XTR",
        prices: [
            {
                label: params.title,
                amount: params.starsAmount,
            },
        ],
    });
    if (!res.data?.ok || !res.data?.result) {
        throw new Error("Telegram createInvoiceLink failed");
    }
    return res.data.result;
}
