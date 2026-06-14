import { prisma } from "../prisma";

export async function startTonDepositWatcher() {
  console.log("TON Deposit Watcher started");

  setInterval(async () => {
    try {
      const count = await prisma.tonDeposit.count();

      console.log(`[TON WATCHER] Working. Deposits in DB: ${count}`);
    } catch (error) {
      console.error("[TON WATCHER ERROR]", error);
    }
  }, 60000);
}
