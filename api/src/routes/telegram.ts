import express from "express";
import axios from "axios";
import { prisma } from "../prisma";
import { grantPremiumPurchase } from "../services/paymentGrant";

const router = express.Router();

const BOT_TOKEN = process.env.BOT_TOKEN!;
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
      await axios.post(`${TG_API}/answerPreCheckoutQuery`, {
        pre_checkout_query_id: update.pre_checkout_query.id,
        ok: true,
      });
    }

    if (update.message?.successful_payment) {
      const payload = update.message.successful_payment.invoice_payload;

      const parts = String(payload).split(":");
      const paymentId = Number(parts[2]);

      if (!paymentId || Number.isNaN(paymentId)) {
        throw new Error("Invalid payment payload");
      }
      await grantPremiumPurchase(paymentId);
    }

    if (update.message?.text?.startsWith("/start")) {
      const telegramId = BigInt(update.message.from.id);
      const chatId = update.message.chat.id;
      const refCode = update.message.text.split(" ")[1]?.trim();

      const user = await prisma.user.upsert({
        where: { telegramId },
        update: {},
        create: { telegramId },
      });

      if (refCode?.startsWith("ref_")) {
        const rawRefId = refCode.replace("ref_", "");

        if (/^\d+$/.test(rawRefId)) {
          const refTelegramId = BigInt(rawRefId);

          if (refTelegramId !== telegramId && !user.referredById) {
            const referrer = await prisma.user.findUnique({
              where: { telegramId: refTelegramId },
            });

            if (referrer) {
              const existingReferral = await prisma.referral.findUnique({
                where: { referredId: user.id },
              });

              if (!existingReferral) {
                await prisma.$transaction([
                  prisma.user.update({
                    where: { id: user.id },
                    data: {
                      coins: { increment: NEW_USER_REF_BONUS_COINS },
                      diamonds: { increment: NEW_USER_REF_BONUS_DIAMONDS },
                      referredById: referrer.id,
                    },
                  }),
                  prisma.user.update({
                    where: { id: referrer.id },
                    data: {
                      coins: { increment: REFERRER_BONUS_COINS },
                      points: { increment: REFERRER_BONUS_POINTS },
                      diamonds: { increment: REFERRER_BONUS_DIAMONDS },
                    },
                  }),
                  prisma.referral.create({
                    data: {
                      referrerId: referrer.id,
                      referredId: user.id,
                    },
                  }),
                ]);

                console.log(
                  `✅ Referral applied: ${user.id} -> ${referrer.id}`,
                );
              }
            }
          }
        }
      }

      await axios.post(`${TG_API}/sendMessage`, {
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
  } catch (err: any) {
    console.error("Telegram webhook error:", err.response?.data || err.message);
    return res.sendStatus(500);
  }
});

export default router;
