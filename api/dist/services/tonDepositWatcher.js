"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.startTonDepositWatcher = startTonDepositWatcher;
const prisma_1 = require("../prisma");
async function startTonDepositWatcher() {
    console.log("TON Deposit Watcher started");
    setInterval(async () => {
        try {
            const count = await prisma_1.prisma.tonDeposit.count();
            console.log(`[TON WATCHER] Working. Deposits in DB: ${count}`);
        }
        catch (error) {
            console.error("[TON WATCHER ERROR]", error);
        }
    }, 60000);
}
