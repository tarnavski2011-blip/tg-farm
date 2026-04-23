import express from "express";
import axios from "axios";
import { grantPayment } from "../services/paymentGrant";

const router = express.Router();

const BOT_TOKEN = process.env.BOT_TOKEN!;
const TG_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

router.post("/", async (req, res) => {
  const update = req.body;

  try {
    // ✅ ПІДТВЕРДЖЕННЯ ПЛАТЕЖУ
    if (update.pre_checkout_query) {
      await axios.post(`${TG_API}/answerPreCheckoutQuery`, {
        pre_checkout_query_id: update.pre_checkout_query.id,
        ok: true,
      });
    }

    // ✅ УСПІШНА ОПЛАТА
    if (update.message?.successful_payment) {
      const payload = update.message.successful_payment.invoice_payload;

      const userId = update.message.from.id; // 👈 ДОДАЙ ЦЕ
      const packageCode = payload;

      await grantPayment(userId, packageCode);

      console.log("✅ Payment granted:", userId, packageCode);
    }

    res.sendStatus(200);
  } catch (err) {
    console.error("Telegram webhook error:", err);
    res.sendStatus(500);
  }
});

export default router;
