"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ECONOMY = void 0;
exports.upgradePrice = upgradePrice;
exports.ECONOMY = {
    animals: {
        CHICKEN: { buyPrice: 50, cycleSec: 30, upgradeBase: 100 },
        SHEEP: { buyPrice: 150, cycleSec: 60, upgradeBase: 220 },
        COW: { buyPrice: 500, cycleSec: 120, upgradeBase: 600 },
    },
    sell: { egg: 4, wool: 10, milk: 22 },
    feed: { priceCoins: 500, durationMinutes: 60 },
    wheel: {
        costDiamonds: 5,
        cooldownMs: 60 * 60 * 1000,
        rewards: [
            { type: "coins", amount: 500, weight: 35, label: "500 coins" },
            { type: "coins", amount: 2000, weight: 15, label: "2000 coins" },
            { type: "diamonds", amount: 5, weight: 10, label: "5 diamonds" },
            { type: "points", amount: 20, weight: 18, label: "20 points" },
            { type: "chicken", amount: 1, weight: 12, label: "Free chicken" },
            { type: "boost", minutes: 60, weight: 10, label: "x2 boost 1h" },
        ],
    },
    quests: {
        coinRewardSmall: 200,
        coinRewardMed: 250,
        coinRewardBig: 300,
        diamondRewardSmall: 1,
        diamondRewardMed: 2,
        xpSmall: 15,
        xpMed: 20,
    },
    dailyLogin: [
        { day: 1, coins: 50, diamonds: 0, freeWheelSpin: false },
        { day: 2, coins: 100, diamonds: 0, freeWheelSpin: false },
        { day: 3, coins: 200, diamonds: 0, freeWheelSpin: false },
        { day: 4, coins: 0, diamonds: 1, freeWheelSpin: false },
        { day: 5, coins: 400, diamonds: 0, freeWheelSpin: false },
        { day: 6, coins: 0, diamonds: 2, freeWheelSpin: false },
        { day: 7, coins: 0, diamonds: 0, freeWheelSpin: true },
    ],
    shop: {
        FEED_PACK: { priceCoins: 1000, minutes: 60 },
        BOOST_X2_1H: { priceDiamonds: 25, minutes: 60 },
        AUTO_COLLECT_1H: { priceDiamonds: 40, minutes: 60 },
        VIP_1D: { priceDiamonds: 100, days: 1 },
        DIAMONDS_25: { priceCoins: 5000, diamonds: 25 },
    },
};
function upgradePrice(type, level) {
    const base = exports.ECONOMY.animals[type].upgradeBase;
    return Math.floor(base * Math.pow(1.35, Math.max(0, level - 1)));
}
