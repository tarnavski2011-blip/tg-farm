import type { Response, NextFunction } from "express";
import type { TgAuthedRequest } from "./telegramAuth";

const locks = new Map<string, number>();

export function requestLockByUser(lockMs: number) {
  return (req: TgAuthedRequest, res: Response, next: NextFunction) => {
    const userId = String(req.tgUserId ?? req.ip ?? "anon");
    const bodyKey = JSON.stringify(req.body ?? {});
    const key = `${userId}:${req.method}:${req.path}:${bodyKey}`;
    const now = Date.now();

    const expiresAt = locks.get(key) ?? 0;

    if (expiresAt > now) {
      return res.status(429).json({
        error: "Duplicate request blocked",
      });
    }

    locks.set(key, now + lockMs);

    next();
  };
}
