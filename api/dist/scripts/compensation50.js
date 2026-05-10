"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
const BOT_TOKEN = process.env.BOT_TOKEN;
if (!BOT_TOKEN) {
    throw new Error("BOT_TOKEN не знайдено в .env");
}
async function sendTelegramMessage(chatId, text) {
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            chat_id: chatId,
            text,
            parse_mode: "HTML",
        }),
    });
    if (!res.ok) {
        const error = await res.text();
        console.log(`❌ Не вдалося надіслати ${chatId}:`, error);
    }
}
async function main() {
    const users = await prisma.user.findMany({
        select: {
            telegramId: true,
        },
    });
    console.log(`Знайдено користувачів: ${users.length}`);
    const message = `
🎁 <b>Компенсация начислена!</b>

Из-за технического обновления игры каждый игрок получил:

💎 <b>+50 алмазов</b>

Спасибо за понимание и поддержку ❤️

🚀 Заходи в My Farm Clicker и продолжай развивать ферму!
`;
    for (const user of users) {
        const chatId = user.telegramId.toString();
        try {
            await prisma.user.update({
                where: {
                    telegramId: user.telegramId,
                },
                data: {
                    diamonds: {
                        increment: 50,
                    },
                },
            });
            await sendTelegramMessage(chatId, message);
            console.log(`✅ Надіслано: ${chatId}`);
            await new Promise((resolve) => setTimeout(resolve, 50));
        }
        catch (error) {
            console.log(`❌ Помилка для ${chatId}:`, error);
        }
    }
    console.log("Готово ✅");
}
main()
    .catch((e) => {
    console.error(e);
})
    .finally(async () => {
    await prisma.$disconnect();
});
