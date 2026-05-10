"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const prisma_1 = require("../prisma");
const router = express_1.default.Router();
// 🔥 БЕЗ telegramAuth (для перегляду в браузері)
router.get("/", async (req, res) => {
    try {
        const logs = await prisma_1.prisma.payment.findMany({
            orderBy: { createdAt: "desc" },
            take: 50,
        });
        res.json(logs);
    }
    catch (e) {
        res.status(500).json({ error: "failed to load logs" });
    }
});
exports.default = router;
