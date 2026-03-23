"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.antiSpamPerUser = antiSpamPerUser;
const buckets = new Map();
function antiSpamPerUser(windowMs, maxHits) {
    return (req, res, next) => {
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
//# sourceMappingURL=antiSpam.js.map