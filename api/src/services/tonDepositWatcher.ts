import axios from "axios";
import { prisma } from "../prisma";

const TON_WALLET = "UQAGmtMLvMcU_qN9vF58RbAIAy319pn9ubphF1el8N61uXwD";

export async function startTonDepositWatcher() {
  console.log("TON Deposit Watcher started");

  setInterval(async () => {
    try {
      const apiKey = process.env.TON_API_KEY;

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

        console.log("RAW COMMENT:", comment);

        let decodedComment = comment;

        try {
          decodedComment = Buffer.from(comment, "base64").toString("utf8");
        } catch (e) {}

        console.log("DECODED:", decodedComment);

        if (!decodedComment.startsWith("USER_")) continue;

        const telegramId = BigInt(decodedComment.replace("USER_", ""));

        const user = await prisma.user.findUnique({
          where: { telegramId },
        });

        if (!user) {
          console.log("USER NOT FOUND:", telegramId.toString());
          continue;
        }

        const amount = Number(tx.in_msg?.value || 0) / 1000000000;

        await prisma.tonDeposit.create({
          data: {
            txHash,
            userId: user.id,
            amount,
            comment: decodedComment,
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
