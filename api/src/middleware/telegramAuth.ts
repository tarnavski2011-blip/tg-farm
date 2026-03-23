import crypto from "crypto";
import { Request, Response, NextFunction } from "express";

export const telegramAuth = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const initData = req.headers["x-telegram-init-data"] as string;

    if (!initData) {
      return res.status(401).json({ error: "No initData" });
    }

    const botToken = process.env.BOT_TOKEN;

    if (!botToken) {
      return res.status(500).json({ error: "BOT_TOKEN missing" });
    }

    const urlParams = new URLSearchParams(initData);
    const hash = urlParams.get("hash");

    urlParams.delete("hash");

    const dataCheckString = [...urlParams.entries()]
      .map(([key, value]) => `${key}=${value}`)
      .sort()
      .join("\n");

    const secretKey = crypto.createHash("sha256").update(botToken).digest();

    const hmac = crypto
      .createHmac("sha256", secretKey)
      .update(dataCheckString)
      .digest("hex");

    if (hmac !== hash) {
      return res.status(401).json({ error: "Unauthorized (bad initData)" });
    }

    // витягуємо user
    const user = JSON.parse(urlParams.get("user") || "{}");
    (req as any).telegramUser = user;

    next();
  } catch (e) {
    return res.status(401).json({ error: "Auth error" });
  }
};
