import { Router } from "express";

const router = Router();

router.use((req, _res, next) => {
  console.error("TELEGRAM HIT:", req.method, req.originalUrl);
  next();
});

router.post("/", (req, res) => {
  process.stdout.write("TELEGRAM UPDATE:\n");
  process.stdout.write(JSON.stringify(req.body) + "\n");

  res.status(200).json({ ok: true });
});

router.get("/", (_req, res) => {
  res.send("telegram webhook ok 12345");
});

export default router;

router.post("/", async (req, res) => {
  console.log("TELEGRAM UPDATE:", req.body);

  const message = req.body.message;

  if (message?.text === "/start") {
    const chatId = message.chat.id;

    await fetch(
      `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`,
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
  }

  res.sendStatus(200);
});
