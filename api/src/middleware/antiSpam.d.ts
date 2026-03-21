import type { Response, NextFunction } from "express";
import type { TgAuthedRequest } from "./telegramAuth";
export declare function antiSpamPerUser(windowMs: number, maxHits: number): (req: TgAuthedRequest, res: Response, next: NextFunction) => void | Response<any, Record<string, any>>;
//# sourceMappingURL=antiSpam.d.ts.map