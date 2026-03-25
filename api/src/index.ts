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

const port = Number(process.env.PORT ?? 3000);

app.listen(port, () => {
  console.log(`API running on http://localhost:${port}`);
});
