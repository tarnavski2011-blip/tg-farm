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
import walletRouter from "./routes/wallet";
import referralsRouter from "./routes/referrals";
import tapRouter from "./routes/tap";
import breedRouter from "./routes/breed";
import upgradeRouter from "./routes/upgrade";
// import shopStarsRouter from "./routes/shopStars";
import paymentsRouter from "./routes/payments";
import testPaymentRouter from "./routes/testPayment";
import paymentLogsRouter from "./routes/paymentLogs";
import adminPaymentsRouter from "./routes/adminPayments";
import leaderboardRouter from "./routes/leaderboard";
import adminLeaderboardRewardsRouter from "./routes/adminLeaderboardRewards";
import adminWalletRouter from "./routes/adminWallet";
import walletWithdrawRouter from "./routes/walletWithdraw";
import adminWithdrawalsRouter from "./routes/adminWithdrawals";
import healRouter from "./routes/heal";
import unlockSlotRouter from "./routes/unlockSlot";

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (_req, res) => {
  res.send("tg-farm-api is running");
});

// Telegram webhook
app.use("/telegram", telegramRouter);

// адмінка без Telegram auth
app.use("/admin", adminPaymentsRouter);

// payment logs
app.use("/api/payment-logs", paymentLogsRouter);

// public leaderboard без auth
app.use("/api/leaderboard", leaderboardRouter);

// auth only for game api
app.use("/api", telegramAuth);

// game routes
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
app.use("/api/wallet", walletRouter);
app.use("/api/referrals", referralsRouter);
app.use("/api/tap", tapRouter);
app.use("/api/breed", breedRouter);
app.use("/api/upgrade", upgradeRouter);
// app.use("/api/stars", shopStarsRouter);
app.use("/api/payments", paymentsRouter);
app.use("/admin/leaderboard-rewards", adminLeaderboardRewardsRouter);
app.use("/admin", adminWalletRouter);
app.use("/api/wallet/request-withdraw", walletWithdrawRouter);
app.use("/admin", adminWithdrawalsRouter);
app.use("/api/heal", healRouter);
app.use("/api/unlock-slot", unlockSlotRouter);

// test routes
app.use("/test-payment", testPaymentRouter);

const port = Number(process.env.PORT ?? 3000);

app.listen(port, () => {
  console.log(`API running on http://localhost:${port}`);
});
