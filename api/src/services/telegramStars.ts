const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

function telegramApiUrl(method: string) {
  if (!BOT_TOKEN) {
    throw new Error("Missing TELEGRAM_BOT_TOKEN");
  }
  return `https://api.telegram.org/bot${BOT_TOKEN}/${method}`;
}

export async function createStarsInvoiceLink(args: {
  title: string;
  description: string;
  payload: string;
  starsAmount: number;
}) {
  const res = await fetch(telegramApiUrl("createInvoiceLink"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: args.title,
      description: args.description,
      payload: args.payload,
      currency: "XTR",
      prices: [{ label: args.title, amount: args.starsAmount }],
    }),
  });

  const json = await res.json();
  if (!json?.ok || !json?.result) {
    throw new Error(json?.description || "Failed to create invoice link");
  }

  return json.result as string;
}

export async function answerPreCheckoutQuery(
  preCheckoutQueryId: string,
  ok: boolean,
  errorMessage?: string,
) {
  const res = await fetch(telegramApiUrl("answerPreCheckoutQuery"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      pre_checkout_query_id: preCheckoutQueryId,
      ok,
      error_message: errorMessage,
    }),
  });

  const json = await res.json();
  if (!json?.ok) {
    throw new Error(json?.description || "Failed to answer pre_checkout_query");
  }
}

export function parsePayload(payload: string) {
  const parts = String(payload || "").split(":");
  if (parts.length !== 3 || parts[0] !== "stars") return null;
  return {
    userId: Number(parts[1]),
    paymentId: Number(parts[2]),
  };
}
