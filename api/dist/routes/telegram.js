"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const axios_1 = __importDefault(require("axios"));
const prisma_1 = require("../prisma");
const paymentGrant_1 = require("../services/paymentGrant");
const router = express_1.default.Router();
const BOT_TOKEN = process.env.BOT_TOKEN;
const TG_API = `https://api.telegram.org/bot${BOT_TOKEN}`;
const WEBAPP_URL = process.env.WEBAPP_URL || "https://tg-farm-web.onrender.com";
const NEW_USER_REF_BONUS_COINS = 1000;
const NEW_USER_REF_BONUS_DIAMONDS = 10;
const REFERRER_BONUS_COINS = 500;
const REFERRER_BONUS_POINTS = 5000;
const REFERRER_BONUS_DIAMONDS = 5;
router.post("/", async (req, res) => {
    const update = req.body;
    try {
        if (update.pre_checkout_query) {
            await axios_1.default.post(`${TG_API}/answerPreCheckoutQuery`, {
                pre_checkout_query_id: update.pre_checkout_query.id,
                ok: true,
            });
        }
        if (update.message?.successful_payment) {
            const paymentId = Number(update.message.successful_payment.invoice_payload);
            await (0, paymentGrant_1.grantPremiumPurchase)(paymentId);
        }
        if (update.message?.text?.startsWith("/start")) {
            const telegramId = BigInt(update.message.from.id);
            const chatId = update.message.chat.id;
            const refCode = update.message.text.split(" ")[1]?.trim();
            const user = await prisma_1.prisma.user.upsert({
                where: { telegramId },
                update: {},
                create: { telegramId },
            });
            if (refCode?.startsWith("ref_")) {
                const rawRefId = refCode.replace("ref_", "");
                if (/^\d+$/.test(rawRefId)) {
                    const refTelegramId = BigInt(rawRefId);
                    if (refTelegramId !== telegramId && !user.referredById) {
                        const referrer = await prisma_1.prisma.user.findUnique({
                            where: { telegramId: refTelegramId },
                        });
                        if (referrer) {
                            const existingReferral = await prisma_1.prisma.referral.findUnique({
                                where: { referredId: user.id },
                            });
                            if (!existingReferral) {
                                await prisma_1.prisma.$transaction([
                                    prisma_1.prisma.user.update({
                                        where: { id: user.id },
                                        data: {
                                            coins: { increment: NEW_USER_REF_BONUS_COINS },
                                            diamonds: { increment: NEW_USER_REF_BONUS_DIAMONDS },
                                            referredById: referrer.id,
                                        },
                                    }),
                                    prisma_1.prisma.user.update({
                                        where: { id: referrer.id },
                                        data: {
                                            coins: { increment: REFERRER_BONUS_COINS },
                                            points: { increment: REFERRER_BONUS_POINTS },
                                            diamonds: { increment: REFERRER_BONUS_DIAMONDS },
                                        },
                                    }),
                                    prisma_1.prisma.referral.create({
                                        data: {
                                            referrerId: referrer.id,
                                            referredId: user.id,
                                        },
                                    }),
                                ]);
                                console.log(`✅ Referral applied: ${user.id} -> ${referrer.id}`);
                            }
                        }
                    }
                }
            }
            await axios_1.default.post(`${TG_API}/sendMessage`, {
                chat_id: chatId,
                text: "🚜 Ласкаво просимо в My Farm Clicker!\n\nНатисни кнопку нижче, щоб відкрити гру 👇",
                reply_markup: {
                    inline_keyboard: [
                        [
                            {
                                text: "🎮 PLAY",
                                web_app: { url: WEBAPP_URL },
                            },
                        ],
                    ],
                },
            });
        }
        return res.sendStatus(200);
    }
    catch (err) {
        console.error("Telegram webhook error:", err.response?.data || err.message);
        return res.sendStatus(500);
    }
});
exports.default = router;
