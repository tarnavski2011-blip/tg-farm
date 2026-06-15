import axios from "axios";
import { prisma } from "../prisma";

const TON_WALLET = "UQAGmtMLvMcU_qN9vF58RbAIAy319pn9ubphF1el8N61uXwD";

export async function startTonDepositWatcher() {
  console.log("TON Deposit Watcher started");

  setInterval(async () => {
    try {
      const apiKey = process.env.TON_API_KEY;

      console.log("API KEY:", apiKey);

      if (!apiKey) {
        console.error("TON_API_KEY missing");
        return;
      }

      const response = await axios.get(
        `https://toncenter.com/api/v2/getTransactions?address=${TON_WALLET}&limit=20`,
        {
          headers: {
            "X-API-Key": apiKey,
          },
        },
      );

      console.log("TON wallet:", TON_WALLET);
      console.log("Transactions:", response.data.result?.length);

      const txs = response.data.result ?? [];

      console.log(JSON.stringify(txs[0], null, 2));

      for (const tx of txs) {
        const txHash = tx.transaction_id?.hash;

        if (!txHash) continue;

        const exists = await prisma.tonDeposit.findUnique({
          where: { txHash },
        });

        if (exists) continue;

        const comment = tx.in_msg?.message || tx.in_msg?.comment || "";

        console.log("COMMENT:", comment);
        console.log("IN_MSG:", JSON.stringify(tx.in_msg, null, 2));

        console.log("COMMENT:", comment);

        if (!comment.startsWith("USER_")) continue;

        const telegramId = BigInt(comment.replace("USER_", ""));

        const user = await prisma.user.findUnique({
          where: { telegramId },
        });

        if (!user) continue;

        const amount = Number(tx.in_msg?.value || 0) / 1000000000;

        await prisma.tonDeposit.create({
          data: {
            txHash,
            userId: user.id,
            amount,
            comment,
          },
        });

        await prisma.user.update({
          where: { id: user.id },
          data: {
            tonBalance: {
              increment: amount,
            },
          },
        });

        console.log(
          `[TON] Deposit credited ${amount} TON to user ${telegramId}`,
        );
      }
    } catch (error) {
      console.error("[TON WATCHER ERROR]", error);
    }
  }, 60000);
}
