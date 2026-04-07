import { Router } from "express";

const router = Router();

router.post("/", async (req, res) => {
  try {
    process.stdout.write("TELEGRAM UPDATE:\n");
    process.stdout.write(JSON.stringify(req.body) + "\n");

    const message = req.body?.message;
    const text = String(message?.text ?? "");
    const chatId = message?.chat?.id;

    if (!chatId) {
      return res.sendStatus(200);
    }

    if (text.startsWith("/start")) {
      const token = process.env.TELEGRAM_BOT_TOKEN;

      if (!token) {
        process.stdout.write("ERROR: TELEGRAM_BOT_TOKEN missing\n");
        return res.sendStatus(200);
      }

      const startPayload = text.replace("/start", "").trim();

      let refCode = "";

      if (startPayload.startsWith("ref_")) {
        refCode = startPayload.replace("ref_", "").trim();
      } else if (startPayload.length > 0) {
        refCode = startPayload;
      }

      const webAppUrl = refCode
        ? `https://tg-farm-web.onrender.com/?ref=${encodeURIComponent(refCode)}`
        : "https://tg-farm-web.onrender.com";

      process.stdout.write("REF CODE:\n");
      process.stdout.write(refCode + "\n");
      process.stdout.write("WEB APP URL:\n");
      process.stdout.write(webAppUrl + "\n");

      const replyText = refCode
        ? "🚜 Ласкаво просимо в My Farm Clicker!\n\nТебе запросив друг. Натисни кнопку нижче, щоб відкрити гру 👇"
        : "🚜 Ласкаво просимо в My Farm Clicker!\n\nНатисни кнопку нижче, щоб відкрити гру 👇";

      const tgRes = await fetch(
        `https://api.telegram.org/bot${token}/sendMessage`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            chat_id: chatId,
            text: replyText,
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text: "🎮 Play",
                    web_app: {
                      url: webAppUrl,
                    },
                  },
                ],
              ],
            },
          }),
        },
      );

      const tgJson = await tgRes.text();
      process.stdout.write("SEND MESSAGE RESULT:\n");
      process.stdout.write(tgJson + "\n");
    }

    return res.sendStatus(200);
  } catch (error) {
    process.stdout.write("TELEGRAM ERROR:\n");
    process.stdout.write(String(error) + "\n");
    return res.sendStatus(200);
  }
});

router.get("/", (_req, res) => {
  res.send("telegram webhook ok 12345");
});

export default router;
