"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
require("dotenv/config");
const telegramAuth_1 = require("./middleware/telegramAuth");
const state_1 = __importDefault(require("./routes/state"));
const collect_1 = __importDefault(require("./routes/collect"));
const buyAnimal_1 = __importDefault(require("./routes/buyAnimal"));
const sell_1 = __importDefault(require("./routes/sell"));
const telegram_1 = __importDefault(require("./routes/telegram"));
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.get("/", (_req, res) => {
    res.send("tg-farm-api is running");
});
app.use("/telegram", telegram_1.default);
// auth only for game api
app.use("/api", telegramAuth_1.telegramAuth);
app.use("/api/state", state_1.default);
app.use("/api/collect", collect_1.default);
app.use("/api/buy-animal", buyAnimal_1.default);
app.use("/api/sell", sell_1.default);
const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => {
    console.log(`API running on http://localhost:${port}`);
});
