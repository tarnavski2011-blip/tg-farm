import { Router } from "express";
import { handleTelegramPaymentUpdate } from "../bot/telegramPaymentHandlers";

const router = Router();

router.post("/", async (req, res) => {
  try {
    const update = req.body;
    await handleTelegramPaymentUpdate(update);
    res.sendStatus(200);
  } catch (e) {
    console.error("Telegram webhook error:", e);
    res.sendStatus(200);
  }
});

router.get("/", (_req, res) => {
  res.send("telegram webhook ok");
});

export default router;
