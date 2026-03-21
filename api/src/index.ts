import express from "express";
import cors from "cors";
import "dotenv/config";

import { prisma } from "./prisma";
import { telegramAuth } from "./middleware/telegramAuth";

import stateRouter from "./routes/state";
import tapRouter from "./routes/tap";
import feedRouter from "./routes/feed";
import animalsRouter from "./routes/animals";
import collectRouter, { collectToStorageByUserId } from "./routes/collect";
import storageRouter from "./routes/storage";
import sellRouter from "./routes/sell";
import upgradeRouter from "./routes/upgrade";
import dailyRouter from "./routes/daily";
import boostRouter from "./routes/boost";
import autoCollectRouter from "./routes/autocollect";
import xpRouter from "./routes/xp";
import levelRouter from "./routes/level";
import leaderboardRouter from "./routes/leaderboard";
import achievementsRouter from "./routes/achievements";
import referralRouter from "./routes/referral";
import animalUpgradeRouter from "./routes/animalUpgrade";
import wheelRouter from "./routes/wheel";
import questsRouter from "./routes/quests";
import shopRouter from "./routes/shop";
import dailyLoginRouter from "./routes/dailyLogin";
import boostersRouter from "./routes/boosters";
import paymentsRouter from "./routes/payments";
import telegramRouter from "./routes/telegram";

const app = express();

app.use(cors());
app.use(express.json());

// ✅ Telegram auth для всіх /api/*
app.use("/api", telegramAuth);

// routes
app.use("/api/state", stateRouter);
app.use("/api/tap", tapRouter);
app.use("/api/feed", feedRouter);
app.use("/api/animals", animalsRouter);
app.use("/api/collect", collectRouter);
app.use("/api/storage", storageRouter);
app.use("/api/sell", sellRouter);
app.use("/api/upgrade", upgradeRouter);
app.use("/api/daily", dailyRouter);
app.use("/api/boost", boostRouter);
app.use("/api/autocollect", autoCollectRouter);
app.use("/api/xp", xpRouter);
app.use("/api/level", levelRouter);
app.use("/api/leaderboard", leaderboardRouter);
app.use("/api/achievements", achievementsRouter);
app.use("/api/referral", referralRouter);
app.use("/api/animal-upgrade", animalUpgradeRouter);
app.use("/api/wheel", wheelRouter);
app.use("/api/quests", questsRouter);
app.use("/api/shop", shopRouter);
app.use("/api/daily-login", dailyLoginRouter);
app.use("/api/boosters", boostersRouter);
app.use("/api/payments", paymentsRouter);
app.use("/telegram", telegramRouter);

const port = Number(process.env.PORT ?? 3000);

app.listen(port, () => {
  console.log(`API running on http://localhost:${port}`);
});

// ✅ Автозбір раз на 10 сек для тих, у кого активний autoCollect
const AUTO_COLLECT_INTERVAL_MS = 10_000;

setInterval(async () => {
  try {
    const now = new Date();

    const users = await prisma.user.findMany({
      where: { autoCollectUntil: { gt: now } },
      select: { id: true },
    });

    for (const u of users) {
      try {
        await collectToStorageByUserId(u.id);
      } catch {
        // ігноруємо помилки одного юзера
      }
    }
  } catch {
    // ігноруємо разову помилку
  }
}, AUTO_COLLECT_INTERVAL_MS);
