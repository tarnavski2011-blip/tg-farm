"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requestLockByUser = requestLockByUser;
const locks = new Map();
function requestLockByUser(lockMs) {
    return (req, res, next) => {
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
//# sourceMappingURL=requestLock.js.map