import type { Request, Response, NextFunction } from "express";
import crypto from "crypto";

function parseInitData(initData: string): Record<string, string> {
  const params = new URLSearchParams(initData);
  const obj: Record<string, string> = {};
  for (const [k, v] of params.entries()) obj[k] = v;
  return obj;
}

function buildDataCheckString(data: Record<string, string>): string {
  return Object.keys(data)
    .filter((k) => k !== "hash")
    .sort()
    .map((k) => `${k}=${data[k]}`)
    .join("\n");
}

function sha256(data: string | Buffer) {
  return crypto.createHash("sha256").update(data).digest();
}

function hmacSha256(key: Buffer, data: string) {
  return crypto.createHmac("sha256", key).update(data).digest("hex");
}

export function verifyTelegramInitData(
  initData: string,
  botToken: string,
): { userId: string } | null {
  if (!initData) return null;

  const data = parseInitData(initData);
  const receivedHash = data.hash;
  if (!receivedHash) return null;

  const dataCheckString = buildDataCheckString(data);

  // secretKey = HMAC_SHA256("WebAppData", botToken)
  const secretKey = crypto
    .createHmac("sha256", "WebAppData")
    .update(botToken)
    .digest();

  const computedHash = hmacSha256(secretKey, dataCheckString);

  if (computedHash !== receivedHash) return null;

  const userStr = data.user;
  if (!userStr) return null;

  try {
    const user = JSON.parse(userStr);
    const id = user?.id;
    if (!id) return null;
    return { userId: String(id) };
  } catch {
    return null;
  }
}

export type TgAuthedRequest = Request & { tgUserId?: string };

export function telegramAuth(
  req: TgAuthedRequest,
  res: Response,
  next: NextFunction,
) {
  const botToken = process.env.BOT_TOKEN ?? "";
  if (!botToken) {
    return res.status(500).json({ error: "BOT_TOKEN is not set" });
  }

  const initData = String(req.headers["x-telegram-init-data"] ?? "");

  // тимчасові логи для перевірки
  console.log("initData length =", initData.length);
  console.log("initData head =", initData.slice(0, 80));

  const verified = verifyTelegramInitData(initData, botToken);

  if (!verified) {
    return res.status(401).json({ error: "Unauthorized (bad initData)" });
  }

  req.tgUserId = verified.userId;
  next();
}
