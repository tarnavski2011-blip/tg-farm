import type { Request, Response, NextFunction } from "express";
export declare function verifyTelegramInitData(initData: string, botToken: string): {
    userId: string;
} | null;
export type TgAuthedRequest = Request & {
    tgUserId?: string;
};
export declare function telegramAuth(req: TgAuthedRequest, res: Response, next: NextFunction): Response<any, Record<string, any>> | undefined;
//# sourceMappingURL=telegramAuth.d.ts.map