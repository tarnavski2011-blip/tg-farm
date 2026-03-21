export declare function nowMs(): number;
export declare function isActiveUntil(until: Date | null | undefined, t: number): boolean;
export declare function warehouseCapacity(level: number): number;
export declare function labMultiplier(level: number): number;
export declare function getOrCreateUser(telegramId: bigint): Promise<{
    id: number;
    telegramId: bigint;
    coins: number;
    diamonds: number;
    points: number;
    level: number;
    xp: number;
    feedUntil: Date | null;
    feedActivatedAt: Date | null;
    lastTapAt: Date | null;
    boostUntil: Date | null;
    vipUntil: Date | null;
    autoCollectUntil: Date | null;
    lastDailyAt: Date | null;
    dailyStreak: number;
    warehouseLevel: number;
    labLevel: number;
    createdAt: Date;
    lastSeenAt: Date;
    labMultiplier: number;
    lastWheelSpinAt: Date | null;
}>;
export declare function getOrCreateStorage(userId: number): Promise<{
    id: number;
    eggs: number;
    wool: number;
    milk: number;
    capacity: number;
    updatedAt: Date;
    userId: number;
}>;
//# sourceMappingURL=_helpers.d.ts.map