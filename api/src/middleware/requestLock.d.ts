import type { Response, NextFunction } from "express";
import type { TgAuthedRequest } from "./telegramAuth";
export declare function requestLockByUser(lockMs: number): (req: TgAuthedRequest, res: Response, next: NextFunction) => Response<any, Record<string, any>> | undefined;
//# sourceMappingURL=requestLock.d.ts.map