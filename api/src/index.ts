import express from "express";
import cors from "cors";
import "dotenv/config";

import { telegramAuth } from "./middleware/telegramAuth";

import stateRouter from "./routes/state";
import collectRouter from "./routes/collect";
import buyAnimalRouter from "./routes/buyAnimal";
import sellRouter from "./routes/sell";
import telegramRouter from "./routes/telegram";
import boostRouter from "./routes/boost";
import labRouter from "./routes/lab";
import dailyRouter from "./routes/daily";
import questsRouter from "./routes/quests";
import wheelRouter from "./routes/wheel";
import shopRouter from "./routes/shop";
import referralsRouter from "./routes/referrals";
import tapRouter from "./routes/tap";
import upgradeRouter from "./routes/upgrade";
// import shopStarsRouter from "./routes/shopStars";
import paymentsRouter from "./routes/payments";

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (_req, res) => {
  res.send("tg-farm-api is running");
});

app.use("/telegram", telegramRouter);

// auth only for game api
app.use("/api", telegramAuth);

app.use("/api/state", stateRouter);
app.use("/api/collect", collectRouter);
app.use("/api/buy-animal", buyAnimalRouter);
app.use("/api/sell", sellRouter);
app.use("/api/boost", boostRouter);
app.use("/api/lab", labRouter);
app.use("/api/daily", dailyRouter);
app.use("/api/quests", questsRouter);
app.use("/api/wheel", wheelRouter);
app.use("/api/shop", shopRouter);
app.use("/api/referrals", referralsRouter);
app.use("/api/tap", tapRouter);
app.use("/api/upgrade", upgradeRouter);
// app.use("/api/stars", shopStarsRouter);
app.use("/api/payments", paymentsRouter);

const port = Number(process.env.PORT ?? 3000);

app.listen(port, () => {
  console.log(`API running on http://localhost:${port}`);
});
