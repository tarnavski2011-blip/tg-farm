import axios from "axios";
import { prisma } from "../prisma";

const TON_WALLET = "UQAGmtMLvMcU_qN9vF58RbAIAy319pn9ubphF1el8N61uXwD";
const POLL_INTERVAL_MS = 60_000;
let watcherStarted = false;
let pollRunning = false;

function getComment(message: unknown): string | null {
  if (typeof message !== "string") return null;
  const text = message.trim();
  // toncenter v2 normally provides decoded text in in_msg.message.
  // Do not blindly base64-decode it: plain text such as USER_123 is corrupted.
  return /^USER_[0-9]+$/.test(text) ? text : null;
}

async function checkDeposits(): Promise<void> {
  if (pollRunning) return;
  pollRunning = true;
  try {
    const apiKey = process.env.TON_API_KEY;
    if (!apiKey) {
      console.error("[TON] TON_API_KEY missing");
      return;
    }
    const response = await axios.get("https://toncenter.com/api/v2/getTransactions", {
      params: { address: TON_WALLET, limit: 100, archival: true },
      headers: { "X-API-Key": apiKey },
      timeout: 15000,
    });
    if (response.data?.ok !== true || !Array.isArray(response.data?.result)) {
      throw new Error("Unexpected toncenter response");
    }
    for (const tx of response.data.result) {
      const hash = tx?.transaction_id?.hash;
      const msg = tx?.in_msg;
      if (typeof hash !== "string" || !msg) continue;
      // Ignore outbound/system messages and transactions without an ordinary inbound transfer.
      if (msg.source == null || msg.source === "") continue;
      const comment = getComment(msg.message) ?? getComment(msg.comment);
      if (!comment) continue;
      const telegramId = BigInt(comment.slice(5));
      const amountNano = BigInt(String(msg.value ?? "0"));
      if (amountNano <= 0n) continue;
      const amount = Number(amountNano) / 1_000_000_000;
      if (!Number.isFinite(amount) || amount <= 0) continue;

      const user = await prisma.user.findUnique({ where: { telegramId }, select: { id: true } });
      if (!user) continue;
      // Both changes must commit together. A duplicate transaction rolls back both.
      try {
        await prisma.$transaction(async (db) => {
          await db.tonDeposit.create({
            data: { txHash: hash, userId: user.id, amount, comment },
          });
          await db.user.update({
            where: { id: user.id },
            data: { tonBalance: { increment: amount } },
          });
        });
        console.log(`[TON] Credited ${amount} TON to user ${telegramId.toString()}`);
      } catch (error: any) {
        if (error?.code === "P2002") continue;
        throw error;
      }
    }
  } catch (error) {
    console.error("[TON] Watcher check failed:", error);
  } finally {
    pollRunning = false;
  }
}

export function startTonDepositWatcher(): void {
  if (watcherStarted) return;
  watcherStarted = true;
  console.log("[TON] Deposit watcher started");
  void checkDeposits();
  setInterval(() => void checkDeposits(), POLL_INTERVAL_MS);
}
