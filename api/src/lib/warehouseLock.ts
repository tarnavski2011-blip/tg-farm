import { Client } from "pg";

// PostgreSQL session advisory lock serializes warehouse production and sales
// across API processes. The lock is always released with the connection.
export async function acquireWarehouseLock(telegramId: bigint): Promise<() => Promise<void>> {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    // Separate namespace from other advisory locks by using a two-int key.
    // Telegram ids fit in signed 64-bit; use the same key for state and sell.
    await client.query("SELECT pg_advisory_lock($1::bigint)", [telegramId.toString()]);
  } catch (error) {
    await client.end().catch(() => {});
    throw error;
  }
  return async () => {
    try {
      await client.query("SELECT pg_advisory_unlock($1::bigint)", [telegramId.toString()]);
    } finally {
      await client.end();
    }
  };
}
