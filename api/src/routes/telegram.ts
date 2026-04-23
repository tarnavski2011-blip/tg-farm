import { Router } from "express";
import { prisma } from "../prisma";
import { handleTelegramPaymentUpdate } from "../bot/telegramPaymentHandlers";

const router = Router();

router.post("/", async (req, res) => {
  try {
    const handledPayment = await handleTelegramPaymentUpdate(req.body);
    if (handledPayment?.handled) {
      return res.sendStatus(200);
    }

    const message = req.body?.message;
    const text = String(message?.text ?? "");
    const chatId = message?.chat?.id;
    const fromId = message?.from?.id;

    if (!chatId) return res.sendStatus(200);

    if (text.startsWith("/start")) {
      const token = process.env.BOT_TOKEN;
      if (!token) return res.sendStatus(200);

      const payload = text.replace("/start", "").trim();

      let refCode = "";
      if (payload.startsWith("ref_")) {
        refCode = payload.replace("ref_", "").trim();
      } else if (payload.length > 0) {
        refCode = payload;
      }

      let newUser = null;

      if (fromId) {
        const telegramId = BigInt(fromId);

        newUser = await prisma.user.upsert({
          where: { telegramId },
          update: {},
          create: { telegramId },
          select: { id: true, telegramId: true },
        });

        if (refCode && refCode !== String(fromId)) {
          const refUser = await prisma.user.findUnique({
            where: { telegramId: BigInt(refCode) },
            include: { referrals: true },
          });

          if (refUser) {
            const already = await prisma.referral.findFirst({
              where: { referredId: newUser.id },
            });

            if (!already) {
              const rewardYou = 100;
              const rewardRefCoins = 200;
              const rewardRefDiamonds = 10;
              const rewardRefPoints = 5;

              await prisma.$transaction([
                prisma.referral.create({
                  data: {
                    referrerId: refUser.id,
                    referredId: newUser.id,
                  } as any,
                }),

                prisma.user.update({
                  where: { id: newUser.id },
                  data: {
                    coins: { increment: rewardYou },
                  },
                }),

                prisma.user.update({
                  where: { id: refUser.id },
                  data: {
                    coins: { increment: rewardRefCoins },
                    diamonds: { increment: rewardRefDiamonds },
                    points: { increment: rewardRefPoints },
                  },
                }),
              ]);

              const totalRefs = refUser.referrals.length + 1;

              let bonus = 0;
              let bonusDiamonds = 0;

              if (totalRefs === 1) bonus = 50;
              if (totalRefs === 3) bonus = 200;
              if (totalRefs === 5) bonus = 500;
              if (totalRefs === 10) {
                bonus = 1000;
                bonusDiamonds = 50;
              }

              if (bonus > 0 || bonusDiamonds > 0) {
                await prisma.user.update({
                  where: { id: refUser.id },
                  data: {
                    coins: { increment: bonus },
                    diamonds: { increment: bonusDiamonds },
                  },
                });
              }
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
