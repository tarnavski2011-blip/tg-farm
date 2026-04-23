import axios from "axios";

const BOT_TOKEN = process.env.BOT_TOKEN;

if (!BOT_TOKEN) {
  throw new Error("BOT_TOKEN not set");
}

const TG_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

export function parsePayload(
  payload: string,
): { userId: number; paymentId: number } | null {
  try {
    const parts = payload.split(":");

    if (parts.length !== 3) return null;
    if (parts[0] !== "stars") return null;

    const userId = Number(parts[1]);
    const paymentId = Number(parts[2]);

    if (!Number.isFinite(userId) || !Number.isFinite(paymentId)) {
      return null;
    }

    return { userId, paymentId };
  } catch {
    return null;
  }
}

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

  if (!res.data?.ok || !res.data?.result) {
    throw new Error("Telegram createInvoiceLink failed");
  }

  return res.data.result as string;
}
