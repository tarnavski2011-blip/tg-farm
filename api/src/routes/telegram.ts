import { Router } from "express";

const router = Router();

router.post("/", async (req, res) => {
  try {
    process.stdout.write("TELEGRAM UPDATE:\n");
    process.stdout.write(JSON.stringify(req.body) + "\n");

    const message = req.body?.message;
    const text = message?.text;
    const chatId = message?.chat?.id;

    if (text === "/start" && chatId) {
      const token = process.env.TELEGRAM_BOT_TOKEN;

      if (!token) {
        process.stdout.write("ERROR: TELEGRAM_BOT_TOKEN missing\n");
        return res.sendStatus(200);
      }

      const tgRes = await fetch(
        `https://api.telegram.org/bot${token}/sendMessage`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            chat_id: chatId,
            text: "🚜 Welcome to My Farm Clicker!",
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
