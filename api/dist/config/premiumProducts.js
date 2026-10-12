"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PREMIUM_PRODUCTS = void 0;
exports.getPremiumProduct = getPremiumProduct;
exports.PREMIUM_PRODUCTS = {
    diamonds_small: {
        code: "diamonds_small",
        title: "Малий пакет",
        description: "50 діамантів",
        starsAmount: 60,
        diamonds: 50,
    },
    diamonds_medium: {
        code: "diamonds_medium",
        title: "Середній пакет",
        description: "130 діамантів",
        starsAmount: 120,
        diamonds: 130,
    },
    diamonds_large: {
        code: "diamonds_large",
        title: "Великий пакет",
        description: "350 діамантів",
        starsAmount: 300,
        diamonds: 350,
    },
};
function getPremiumProduct(code) {
    return exports.PREMIUM_PRODUCTS[code] ?? null;
}
