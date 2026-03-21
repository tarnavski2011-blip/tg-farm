export declare function createStarsInvoiceLink(args: {
    title: string;
    description: string;
    payload: string;
    starsAmount: number;
}): Promise<string>;
export declare function answerPreCheckoutQuery(preCheckoutQueryId: string, ok: boolean, errorMessage?: string): Promise<void>;
export declare function parsePayload(payload: string): {
    userId: number;
    paymentId: number;
} | null;
//# sourceMappingURL=telegramStars.d.ts.map