import { Router } from "express";
import { prisma } from "../prisma";

const router = Router();

router.post("/", async (req, res) => {
  try {
    const message = req.body?.message;
    const text = String(message?.text ?? "");
    const chatId = message?.chat?.id;
    const fromId = message?.from?.id;

    if (!chatId) return res.sendStatus(200);

    if (text.startsWith("/start")) {
      const token = process.env.TELEGRAM_BOT_TOKEN;
      if (!token) return res.sendStatus(200);

      const payload = text.replace("/start", "").trim();

      let refCode = "";
      if (payload.startsWith("ref_")) {
        refCode = payload.replace("ref_", "").trim();
      } else if (payload.length > 0) {
        refCode = payload;
      }

      // 1) створити/знайти юзера, який відкрив бота
      let newUser = null as null | { id: number; telegramId: bigint };

      if (fromId) {
        const telegramId = BigInt(fromId);

        newUser = await prisma.user.upsert({
          where: { telegramId },
          update: {},
          create: { telegramId },
          select: { id: true, telegramId: true },
        });

        // 2) якщо є ref-код — застосувати його прямо тут
        if (refCode && refCode !== String(fromId)) {
          const refUser = await prisma.user.findUnique({
            where: { telegramId: BigInt(refCode) },
            select: { id: true, telegramId: true },
          });

          if (refUser) {
            const already = await prisma.referral.findFirst({
              where: { referredId: newUser.id },
              select: { id: true },
            });

            if (!already) {
              await prisma.$transaction([
                prisma.referral.create({
                  data: {
                    referrerId: refUser.id,
                    referredId: newUser.id,
                  } as any,
                }),
                prisma.user.update({
                  where: { id: refUser.id },
                  data: {
                    coins: { increment: 200 },
                  },
                }),
                prisma.user.update({
                  where: { id: newUser.id },
                  data: {
                    coins: { increment: 100 },
                  },
                }),
              ]);
            }
          }
        }
      }

      const webAppUrl = "https://tg-farm-web.onrender.com";

      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          chat_id: chatId,
          text: "🚜 Відкрий гру:",
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
      });
    }

    return res.sendStatus(200);
  } catch (e) {
    console.error("TELEGRAM ERROR:", e);
    return res.sendStatus(200);
  }
});

router.get("/", (_req, res) => {
  res.send("telegram webhook ok 12345");
});

export default router;