export const PREMIUM_PRODUCTS = {
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
} as const;

export function getPremiumProduct(code: string) {
  return PREMIUM_PRODUCTS[code as keyof typeof PREMIUM_PRODUCTS] ?? null;
}
