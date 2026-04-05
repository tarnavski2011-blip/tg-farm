// =======================
// TELEGRAM INIT
// =======================
const tg = window.Telegram?.WebApp;
if (tg) {
  tg.ready();
  tg.expand();
}

// =======================
// API URL
// =======================
const API = "https://tg-farm-api.onrender.com/api";

// =======================
// USER ID
// =======================
const userId =
  tg?.initDataUnsafe?.user?.id ||
  new URLSearchParams(window.location.search).get("user_id") ||
  "123";

// =======================
// REFERRAL CODE (ГОЛОВНЕ)
// =======================
const urlParams = new URLSearchParams(window.location.search);
const refCode = urlParams.get("ref");

if (refCode) {
  localStorage.setItem("ref_code", refCode);
}

// =======================
// APPLY REFERRAL (ОДИН РАЗ)
// =======================
async function applyReferral() {
  const savedRef = localStorage.getItem("ref_code");
  const applied = localStorage.getItem("ref_applied");

  if (!savedRef || applied) return;

  try {
    await fetch(`${API}/referrals/apply`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        userId,
        refCode: savedRef,
      }),
    });

    localStorage.setItem("ref_applied", "1");
    console.log("Referral applied:", savedRef);
  } catch (e) {
    console.log("Referral error", e);
  }
}

// =======================
// STATE LOAD
// =======================
async function loadState() {
  const res = await fetch(`${API}/state?userId=${userId}`);
  const data = await res.json();

  document.getElementById("coins").innerText = data.coins;
  document.getElementById("diamonds").innerText = data.diamonds;
  document.getElementById("points").innerText = data.points;
  document.getElementById("xp").innerText = data.xp;
}

// =======================
// TAP
// =======================
async function tap() {
  await fetch(`${API}/tap`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ userId }),
  });

  loadState();
}

document.getElementById("tapBtn")?.addEventListener("click", tap);

// =======================
// DAILY LOGIN
// =======================
async function dailyLogin() {
  const res = await fetch(`${API}/daily-login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ userId }),
  });

  const data = await res.json();
  alert(`День ${data.day} отримано! +${data.reward} coins`);

  loadState();
}

// =======================
// WHEEL
// =======================
async function spinWheel() {
  const res = await fetch(`${API}/wheel`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ userId }),
  });

  const data = await res.json();

  alert(`Ти виграв: ${data.reward} coins 🎉`);
  loadState();
}

// =======================
// BUY DIAMONDS (UI only)
// =======================
function buyDiamonds(amount) {
  alert(`Покупка ${amount} diamonds (поки тільки UI)`);
}

// =======================
// SHARE REFERRAL
// =======================
function shareReferral() {
  const link = `https://t.me/my_farm_clicker_bot?start=ref_${userId}`;

  if (tg) {
    tg.openTelegramLink(
      `https://t.me/share/url?url=${encodeURIComponent(link)}`,
    );
  } else {
    navigator.clipboard.writeText(link);
    alert("Скопійовано!");
  }
}

// =======================
// INIT
// =======================
async function init() {
  await applyReferral();
  await loadState();
}

init();
