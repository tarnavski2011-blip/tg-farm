"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PREMIUM_PRODUCTS = void 0;
exports.getPremiumProduct = getPremiumProduct;
exports.PREMIUM_PRODUCTS = {
    DIAMONDS_50: {
        code: "DIAMONDS_50",
        title: "50 Diamonds",
        description: "Small pack of diamonds",
        starsAmount: 25,
        grant: { diamonds: 50 },
    },
    DIAMONDS_120: {
        code: "DIAMONDS_120",
        title: "120 Diamonds",
        description: "Medium pack of diamonds",
        starsAmount: 55,
        grant: { diamonds: 120 },
    },
    DIAMONDS_300: {
        code: "DIAMONDS_300",
        title: "300 Diamonds",
        description: "Large pack of diamonds",
        starsAmount: 120,
        grant: { diamonds: 300 },
    },
    VIP_7D: {
        code: "VIP_7D",
        title: "VIP 7 Days",
        description: "VIP for 7 days",
        starsAmount: 90,
        grant: { vipDays: 7 },
    },
    STARTER_PACK: {
        code: "STARTER_PACK",
        title: "Starter Pack",
        description: "80 diamonds + boost + feed",
        starsAmount: 60,
        grant: { diamonds: 80, boostMinutes: 120, feedMinutes: 120 },
    },
};
function getPremiumProduct(code) {
    return exports.PREMIUM_PRODUCTS[code] ?? null;
}
//# sourceMappingURL=premiumProducts.js.map