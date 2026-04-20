import axios from "axios";

const BOT_TOKEN = process.env.BOT_TOKEN;

if (!BOT_TOKEN) {
  throw new Error("BOT_TOKEN not set");
}

const TG_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

// =====================
// ПАКЕТИ
// =====================
export const STAR_PACKAGES = {
  small: {
    code: "small",
    title: "Малий пакет",
    description: "50 діамантів",
    diamonds: 50,
    stars: 20,
  },
  medium: {
    code: "medium",
    title: "Середній пакет",
    description: "120 діамантів",
    diamonds: 120,
    stars: 50,
  },
  large: {
    code: "large",
    title: "Великий пакет",
    description: "300 діамантів",
    diamonds: 300,
    stars: 100,
  },
} as const;

export type StarPackageCode = keyof typeof STAR_PACKAGES;

export function isStarPackageCode(code: string): code is StarPackageCode {
  return code in STAR_PACKAGES;
}

// =====================
// PAYLOAD
// =====================
export function makeInvoicePayload(paymentId: number) {
  return JSON.stringify({ paymentId });
}

export function parsePayload(payload: string): { paymentId: number } | null {
  try {
    const parsed = JSON.parse(payload);
    if (!parsed?.paymentId) return null;
    return { paymentId: Number(parsed.paymentId) };
  } catch {
    return null;
  }
}

// =====================
// TELEGRAM API
// =====================
export async function answerPreCheckoutQuery(
  id: string,
  ok: boolean,
  errorMessage?: string,
) {
  await axios.post(`${TG_API}/answerPreCheckoutQuery`, {
    pre_checkout_query_id: id,
    ok,
    error_message: errorMessage,
  });
}

export async function createStarsInvoiceLink(params: {
  title: string;
  description: string;
  payload: string;
  starsAmount: number;
}) {
  const res = await axios.post(`${TG_API}/createInvoiceLink`, {
    title: params.title,
    description: params.description,
    payload: params.payload,
    provider_token: "",
    currency: "XTR",
    prices: [
      {
        label: params.title,
        amount: params.starsAmount,
      },
    ],
  });

  if (!res.data?.ok) {
    throw new Error("Telegram invoice error");
  }

  return res.data.result as string;
}
