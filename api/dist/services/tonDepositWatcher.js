"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startTonDepositWatcher = startTonDepositWatcher;
const axios_1 = __importDefault(require("axios"));
const prisma_1 = require("../prisma");
const TON_WALLET = "UQAGmtMLvMcU_qN9vF58RbAIAy319pn9ubphF1el8N61uXwD";
async function startTonDepositWatcher() {
    console.log("TON Deposit Watcher started");
    setInterval(async () => {
        try {
            const apiKey = process.env.TON_API_KEY;
            if (!apiKey) {
                console.error("TON_API_KEY missing");
                return;
            }
            const response = await axios_1.default.get(`https://toncenter.com/api/v2/getTransactions?address=${TON_WALLET}&limit=20`, {
                headers: {
                    "X-API-Key": apiKey,
                },
            });
            const txs = response.data.result ?? [];
            for (const tx of txs) {
                const txHash = tx.transaction_id?.hash;
                if (!txHash)
                    continue;
                const exists = await prisma_1.prisma.tonDeposit.findUnique({
                    where: { txHash },
                });
                if (exists)
                    continue;
                const comment = tx.in_msg?.message || tx.in_msg?.comment || "";
                if (!comment.startsWith("USER_"))
                    continue;
                const telegramId = BigInt(comment.replace("USER_", ""));
                const user = await prisma_1.prisma.user.findUnique({
                    where: { telegramId },
                });
                if (!user)
                    continue;
                const amount = Number(tx.in_msg?.value || 0) / 1000000000;
                await prisma_1.prisma.tonDeposit.create({
                    data: {
                        txHash,
                        userId: user.id,
                        amount,
                        comment,
                    },
                });
                await prisma_1.prisma.user.update({
                    where: { id: user.id },
                    data: {
                        tonBalance: {
                            increment: amount,
                        },
                    },
                });
                console.log(`[TON] Deposit credited ${amount} TON to user ${telegramId}`);
            }
        }
        catch (error) {
            console.error("[TON WATCHER ERROR]", error);
        }
    }, 60000);
}
