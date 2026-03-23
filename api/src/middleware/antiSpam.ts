import type { Response, NextFunction } from "express";
import type { TgAuthedRequest } from "./telegramAuth";

type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

export function antiSpamPerUser(windowMs: number, maxHits: number) {
  return (req: TgAuthedRequest, res: Response, next: NextFunction) => {
    const userId = String(req.telegramUser!.id ?? req.ip ?? "anon");
    const key = `${userId}:${req.method}:${req.path}`;
    const now = Date.now();

    const current = buckets.get(key);

    if (!current || now > current.resetAt) {
      buckets.set(key, {
        count: 1,
        resetAt: now + windowMs,
      });
      return next();
    }

    current.count += 1;

    if (current.count > maxHits) {
      return res.status(429).json({
        error: "Too many requests",
      });
    }

    return next();
  };
}
