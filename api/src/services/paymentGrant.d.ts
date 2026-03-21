export declare function grantPremiumPurchase(paymentId: number): Promise<{
    id: number;
    createdAt: Date;
    userId: number;
    amount: number;
    productCode: string;
    payload: string;
    currency: string;
    status: string;
    telegramPaymentChargeId: string | null;
    providerPaymentChargeId: string | null;
    metadataJson: string | null;
    paidAt: Date | null;
} | null>;
//# sourceMappingURL=paymentGrant.d.ts.map