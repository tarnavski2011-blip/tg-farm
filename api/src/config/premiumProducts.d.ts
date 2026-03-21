export type PremiumProductCode = "DIAMONDS_50" | "DIAMONDS_120" | "DIAMONDS_300" | "VIP_7D" | "STARTER_PACK";
export type PremiumProduct = {
    code: PremiumProductCode;
    title: string;
    description: string;
    starsAmount: number;
    grant: {
        diamonds?: number;
        vipDays?: number;
        boostMinutes?: number;
        feedMinutes?: number;
    };
};
export declare const PREMIUM_PRODUCTS: Record<PremiumProductCode, PremiumProduct>;
export declare function getPremiumProduct(code: string): PremiumProduct;
//# sourceMappingURL=premiumProducts.d.ts.map