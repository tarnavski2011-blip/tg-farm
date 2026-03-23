import crypto from "crypto";
import { Request, Response, NextFunction } from "express";

export const telegramAuth = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const initData = req.headers["x-telegram-init-data"] as string | undefined;

    if (!initData) {
      return res.status(401).json({ error: "No initData" });
    }

    const botToken = process.env.TELEGRAM_BOT_TOKEN;

    if (!botToken) {
      return res.status(500).json({ error: "TELEGRAM_BOT_TOKEN missing" });
    }

    const urlParams = new URLSearchParams(initData);
    const hash = urlParams.get("hash");

    if (!hash) {
      return res.status(401).json({ error: "No hash" });
    }

    urlParams.delete("hash");

    const dataCheckString = [...urlParams.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join("\n");

    const secretKey = crypto
      .createHmac("sha256", "WebAppData")
      .update(botToken)
      .digest();

    const calculatedHash = crypto
      .createHmac("sha256", secretKey)
      .update(dataCheckString)
      .digest("hex");

    if (calculatedHash !== hash) {
      return res.status(401).json({ error: "Unauthorized (bad initData)" });
    }

    const authDate = Number(urlParams.get("auth_date"));
    if (!authDate) {
      return res.status(401).json({ error: "Bad auth_date" });
    }

    const now = Math.floor(Date.now() / 1000);
    const maxAgeSeconds = 60 * 60;

    if (now - authDate > maxAgeSeconds) {
      return res.status(401).json({ error: "initData expired" });
    }

    const userRaw = urlParams.get("user");
    const user = userRaw ? JSON.parse(userRaw) : null;

    (req as any).telegramUser = user;
    (req as any).telegramInitData = initData;

    next();
  } catch (error) {
    return res.status(401).json({ error: "Auth error" });
  }
};
