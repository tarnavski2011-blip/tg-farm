
export async function getReferralLink() {
  const res = await fetch("/api/referral/link", {
    headers: {
      "x-telegram-init-data": window.Telegram?.WebApp?.initData ?? ""
    }
  });
  return res.json();
}

export async function activateReferral(referrerId) {
  const res = await fetch("/api/referral/activate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-telegram-init-data": window.Telegram?.WebApp?.initData ?? ""
    },
    body: JSON.stringify({ referrerId })
  });
  return res.json();
}
