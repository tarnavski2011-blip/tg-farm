export declare const ECONOMY: {
    readonly animals: {
        readonly CHICKEN: {
            readonly buyPrice: 50;
            readonly cycleSec: 30;
            readonly upgradeBase: 100;
        };
        readonly SHEEP: {
            readonly buyPrice: 150;
            readonly cycleSec: 60;
            readonly upgradeBase: 220;
        };
        readonly COW: {
            readonly buyPrice: 500;
            readonly cycleSec: 120;
            readonly upgradeBase: 600;
        };
    };
    readonly sell: {
        readonly egg: 4;
        readonly wool: 10;
        readonly milk: 22;
    };
    readonly feed: {
        readonly priceCoins: 500;
        readonly durationMinutes: 60;
    };
    readonly wheel: {
        readonly costDiamonds: 5;
        readonly cooldownMs: number;
        readonly rewards: readonly [{
            readonly type: "coins";
            readonly amount: 500;
            readonly weight: 35;
            readonly label: "500 coins";
        }, {
            readonly type: "coins";
            readonly amount: 2000;
            readonly weight: 15;
            readonly label: "2000 coins";
        }, {
            readonly type: "diamonds";
            readonly amount: 5;
            readonly weight: 10;
            readonly label: "5 diamonds";
        }, {
            readonly type: "points";
            readonly amount: 20;
            readonly weight: 18;
            readonly label: "20 points";
        }, {
            readonly type: "chicken";
            readonly amount: 1;
            readonly weight: 12;
            readonly label: "Free chicken";
        }, {
            readonly type: "boost";
            readonly minutes: 60;
            readonly weight: 10;
            readonly label: "x2 boost 1h";
        }];
    };
    readonly quests: {
        readonly coinRewardSmall: 200;
        readonly coinRewardMed: 250;
        readonly coinRewardBig: 300;
        readonly diamondRewardSmall: 1;
        readonly diamondRewardMed: 2;
        readonly xpSmall: 15;
        readonly xpMed: 20;
    };
    readonly dailyLogin: readonly [{
        readonly day: 1;
        readonly coins: 50;
        readonly diamonds: 0;
        readonly freeWheelSpin: false;
    }, {
        readonly day: 2;
        readonly coins: 100;
        readonly diamonds: 0;
        readonly freeWheelSpin: false;
    }, {
        readonly day: 3;
        readonly coins: 200;
        readonly diamonds: 0;
        readonly freeWheelSpin: false;
    }, {
        readonly day: 4;
        readonly coins: 0;
        readonly diamonds: 1;
        readonly freeWheelSpin: false;
    }, {
        readonly day: 5;
        readonly coins: 400;
        readonly diamonds: 0;
        readonly freeWheelSpin: false;
    }, {
        readonly day: 6;
        readonly coins: 0;
        readonly diamonds: 2;
        readonly freeWheelSpin: false;
    }, {
        readonly day: 7;
        readonly coins: 0;
        readonly diamonds: 0;
        readonly freeWheelSpin: true;
    }];
    readonly shop: {
        readonly FEED_PACK: {
            readonly priceCoins: 1000;
            readonly minutes: 60;
        };
        readonly BOOST_X2_1H: {
            readonly priceDiamonds: 25;
            readonly minutes: 60;
        };
        readonly AUTO_COLLECT_1H: {
            readonly priceDiamonds: 40;
            readonly minutes: 60;
        };
        readonly VIP_1D: {
            readonly priceDiamonds: 100;
            readonly days: 1;
        };
        readonly DIAMONDS_25: {
            readonly priceCoins: 5000;
            readonly diamonds: 25;
        };
    };
};
export type AnimalType = keyof typeof ECONOMY.animals;
export declare function upgradePrice(type: AnimalType, level: number): number;
//# sourceMappingURL=economy.d.ts.map