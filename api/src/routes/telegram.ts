import express from "express";
import axios from "axios";
import { prisma } from "../prisma";
import { grantPremiumPurchase } from "../services/paymentGrant";

const router = express.Router();

const BOT_TOKEN = process.env.BOT_TOKEN!;
const TG_API = `https://api.telegram.org/bot${BOT_TOKEN}`;
const WEBAPP_URL = process.env.WEBAPP_URL || "https://tg-farm-web.onrender.com";

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
      const paymentId = Number(payload);

      if (!paymentId) {
        throw new Error("Invalid payment payload");
      }

      await grantPremiumPurchase(paymentId);
      console.log("✅ Payment granted:", paymentId);
    }

    if (update.message?.text?.startsWith("/start")) {
      const telegramId = BigInt(update.message.from.id);
      const chatId = update.message.chat.id;

      const parts = update.message.text.split(" ");
      const refCode = parts[1]?.trim();

      if (refCode?.startsWith("ref_")) {
        const refTelegramId = BigInt(refCode.replace("ref_", ""));

        if (refTelegramId !== telegramId) {
          const user = await prisma.user.findUnique({
            where: { telegramId },
          });

          const referrer = await prisma.user.findUnique({
            where: { telegramId: refTelegramId },
          });

          if (user && referrer && !user.referredById) {
            const existingReferral = await prisma.referral.findUnique({
              where: { referredId: user.id },
            });

            if (!existingReferral) {
              await prisma.$transaction([
                prisma.user.update({
                  where: { id: user.id },
                  data: {
                    coins: { increment: 100 },
                    referredById: referrer.id,
                  },
                }),
                prisma.user.update({
                  where: { id: referrer.id },
                  data: {
                    coins: { increment: 50 },
                    points: { increment: 25 },
                  },
                }),
                prisma.referral.create({
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

      try {
        await axios.post(`${TG_API}/sendMessage`, {
          chat_id: chatId,
          text: "🚜 Ласкаво просимо в My Farm Clicker!\n\nНатисни кнопку нижче, щоб відкрити гру 👇",
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: "🎮 PLAY",
                  web_app: {
                    url: WEBAPP_URL,
                  },
                },
              ],
            ],
          },
        });

        console.log("✅ Welcome message sent");
      } catch (e: any) {
        console.error("❌ SEND MESSAGE ERROR:", e.response?.data || e.message);
      }
    }

    return res.sendStatus(200);
  } catch (err) {
    console.error("Telegram webhook error:", err);
    return res.sendStatus(500);
  }
});

export default router;
