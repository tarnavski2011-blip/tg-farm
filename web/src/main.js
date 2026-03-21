import "./style.css";

const app = document.querySelector("#app");
const tg = window.Telegram?.WebApp;

tg?.ready?.();
tg?.expand?.();

const API = "/api";
const TELEGRAM_ID = String(
  window.Telegram?.WebApp?.initDataUnsafe?.user?.id ?? "",
);
const BOT_NAME = "my_farm_clicker_bot";

let uiState = {
  modal: null,
};

const pendingActions = new Set();

function withActionLock(key, fn) {
  if (pendingActions.has(key)) return;
  pendingActions.add(key);

  Promise.resolve()
    .then(fn)
    .finally(() => {
      pendingActions.delete(key);
    });
}

function tgHeaders() {
  return {
    "Content-Type": "application/json",
    "x-telegram-init-data": window.Telegram?.WebApp?.initData ?? "",
  };
}

function showToast(msg) {
  const el = document.getElementById("toast");
  if (!el) return;
  el.textContent = msg;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 1800);
}

function fmtSeconds(sec) {
  const s = Math.max(0, Number(sec || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;

  if (h > 0) return `${h}г ${m}хв ${ss}с`;
  if (m > 0) return `${m}хв ${ss}с`;
  return `${ss}с`;
}

function pct(v, total) {
  const t = Math.max(1, Number(total || 1));
  return Math.max(0, Math.min(100, Math.round((Number(v || 0) / t) * 100)));
}

function xpNeed(level) {
  return 100 + level * 50;
}

function statCard(icon, label, value) {
  return `
    <div class="stat-card">
      <div class="stat-icon">${icon}</div>
      <div class="stat-body">
        <div class="stat-label">${label}</div>
        <div class="stat-value">${value}</div>
      </div>
    </div>
  `;
}

function animalCard(
  emoji,
  title,
  desc,
  owned,
  buyPrice,
  upgradePrice,
  idBuy,
  idUpgrade,
  cls,
) {
  return `
    <div class="animal-card ${cls}">
      <div class="animal-head">
        <div class="animal-icon">${emoji}</div>
        <div>
          <div class="animal-title">${title}</div>
          <div class="animal-desc">${desc}</div>
        </div>
      </div>
      <div class="animal-owned">Кількість: <b>${owned}</b></div>
      <button id="${idBuy}" class="animal-btn">Купити (${buyPrice})</button>
      <button id="${idUpgrade}" class="animal-btn secondary-btn">Upgrade (${upgradePrice})</button>
    </div>
  `;
}

function resourceCard(icon, title, value, ready) {
  return `
    <div class="resource-card">
      <div class="resource-top">
        <div class="resource-icon">${icon}</div>
        <div>
          <div class="resource-title">${title}</div>
          <div class="resource-ready">Готово: ${ready}</div>
        </div>
      </div>
      <div class="resource-value">${value}</div>
    </div>
  `;
}

function achievementCard(a) {
  const progress = Math.min(a.progress ?? 0, a.target ?? 1);
  const percent = pct(progress, a.target);
  const rewardText =
    `${a.rewardCoins ? `💰 ${a.rewardCoins}` : ""}` +
    `${a.rewardCoins && a.rewardDiamonds ? " · " : ""}` +
    `${a.rewardDiamonds ? `💎 ${a.rewardDiamonds}` : ""}`;

  return `
    <div class="ach-card ${a.claimed ? "ach-claimed" : a.completed ? "ach-ready" : ""}">
      <div class="ach-top">
        <div>
          <div class="ach-title">${a.title}</div>
          <div class="ach-desc">${a.description}</div>
        </div>
        <div class="ach-reward">${rewardText || "Нагорода"}</div>
      </div>
      <div class="ach-progress-head">
        <span>${progress} / ${a.target}</span>
        <span>${percent}%</span>
      </div>
      <div class="ach-track">
        <div class="ach-fill" style="width:${percent}%"></div>
      </div>
      <div class="ach-bottom">
        <div class="ach-status">${a.claimed ? "Забрано" : a.completed ? "Готово" : "В процесі"}</div>
        ${
          a.claimed
            ? `<button class="ach-btn disabled-btn" disabled>Отримано</button>`
            : a.completed
              ? `<button class="ach-btn" data-ach-claim="${a.code}">Claim reward</button>`
              : `<button class="ach-btn disabled-btn" disabled>Ще не готово</button>`
        }
      </div>
    </div>
  `;
}

function questCard(q) {
  const progress = Math.min(q.progress ?? 0, q.target ?? 1);
  const percent = pct(progress, q.target);
  const rewardText =
    `${q.rewardCoins ? `💰 ${q.rewardCoins}` : ""}` +
    `${q.rewardCoins && q.rewardDiamonds ? " · " : ""}` +
    `${q.rewardDiamonds ? `💎 ${q.rewardDiamonds}` : ""}` +
    `${(q.rewardCoins || q.rewardDiamonds) && q.rewardXp ? " · " : ""}` +
    `${q.rewardXp ? `⭐ ${q.rewardXp} XP` : ""}`;

  return `
    <div class="ach-card ${q.claimed ? "ach-claimed" : q.completed ? "ach-ready" : ""}">
      <div class="ach-top">
        <div>
          <div class="ach-title">${q.title}</div>
          <div class="ach-desc">${q.description}</div>
        </div>
        <div class="ach-reward">${rewardText || "Нагорода"}</div>
      </div>
      <div class="ach-progress-head">
        <span>${progress} / ${q.target}</span>
        <span>${percent}%</span>
      </div>
      <div class="ach-track">
        <div class="ach-fill" style="width:${percent}%"></div>
      </div>
      <div class="ach-bottom">
        <div class="ach-status">${q.claimed ? "Забрано" : q.completed ? "Готово" : "В процесі"}</div>
        ${
          q.claimed
            ? `<button class="ach-btn disabled-btn" disabled>Отримано</button>`
            : q.completed
              ? `<button class="ach-btn" data-quest-claim="${q.code}">Claim quest</button>`
              : `<button class="ach-btn disabled-btn" disabled>Ще не готово</button>`
        }
      </div>
    </div>
  `;
}

function referralCard(r) {
  const tgId = String(r.telegramId ?? "");
  const shortId = tgId ? `ID ${tgId.slice(-6)}` : "User";
  return `
    <div class="lb-row">
      <div class="lb-rank">👤</div>
      <div class="lb-user">
        <div class="lb-name">${shortId}</div>
        <div class="lb-level">${r.coins ?? 0} coins</div>
      </div>
    </div>
  `;
}

function shopItemCard(item) {
  const price =
    item.priceCoins != null
      ? `💰 ${item.priceCoins}`
      : `💎 ${item.priceDiamonds}`;
  return `
    <div class="ach-card">
      <div class="ach-top">
        <div>
          <div class="ach-title">${item.title}</div>
          <div class="ach-desc">Купити в магазині</div>
        </div>
        <div class="ach-reward">${price}</div>
      </div>
      <div class="ach-bottom">
        <div class="ach-status">Shop item</div>
        <button class="ach-btn" data-shop-buy="${item.code}">Buy</button>
      </div>
    </div>
  `;
}

function wheelCard(wheelState) {
  const rewards = (wheelState?.rewards ?? []).map((r) =>
    typeof r === "string" ? r : r.label,
  );
  const cooldown = wheelState?.cooldownSec ?? wheelState?.cooldown ?? 0;
  const disabled = cooldown > 0;
  const buttonText = disabled
    ? `Cooldown ${fmtSeconds(cooldown)}`
    : `Spin (${wheelState?.costDiamonds ?? 3}💎)`;

  return `
    <div class="wheel-box">
      <div class="wheel-title">Lucky Wheel</div>
      <div class="wheel-sub">Крути колесо за diamonds</div>
      <div class="wheel-casino-wrap">
        <div class="wheel-pointer-top">▼</div>
        <div id="casinoWheel" class="casino-wheel">
          ${rewards
            .map(
              (label, i) => `
                <div class="wheel-segment seg-${i}">
                  <span>${label}</span>
                </div>
              `,
            )
            .join("")}
          <div class="wheel-center">🎰</div>
        </div>
      </div>
      <button id="spinWheelBtn" class="primary-btn ${disabled ? "" : "green"}" ${disabled ? "disabled" : ""}>
        ${buttonText}
      </button>
    </div>
  `;
}

function productionSection(state) {
  const animals = state.animals ?? {};
  const ready = state.ready ?? {};

  const row = (emoji, title, owned, rate, unit) => `
    <div class="prod-row">
      <div class="prod-left">
        <div class="prod-icon">${emoji}</div>
        <div>
          <div class="prod-title">${title}</div>
          <div class="prod-owned">x${owned}</div>
        </div>
      </div>
      <div class="prod-right">+${rate} ${unit}/min</div>
    </div>
  `;

  return `
    <section class="panel">
      <div class="panel-title">🌾 Farm Production</div>
      <div class="prod-grid">
        ${row("🐔", "Chicken", animals.chicken ?? 0, ready.eggsReady ?? 0, "eggs")}
        ${row("🐑", "Sheep", animals.sheep ?? 0, ready.woolReady ?? 0, "wool")}
        ${row("🐄", "Cow", animals.cow ?? 0, ready.milkReady ?? 0, "milk")}
      </div>
    </section>
  `;
}

function boostersSection(boostersData) {
  const item = (icon, title, active, leftSec) => `
    <div class="boost-row ${active ? "boost-active" : ""}">
      <div class="boost-left">
        <div class="boost-icon">${icon}</div>
        <div>
          <div class="boost-title">${title}</div>
          <div class="boost-status">${active ? "Активний" : "Неактивний"}</div>
        </div>
      </div>
      <div class="boost-right">${active ? fmtSeconds(leftSec ?? 0) : "—"}</div>
    </div>
  `;

  return `
    <section class="panel">
      <div class="panel-title">🚀 Boosters</div>
      <div class="boost-grid">
        ${item("⚡", "x2 Coins", boostersData?.boost?.active, boostersData?.boost?.leftSec)}
        ${item("🤖", "Auto Collect", boostersData?.autoCollect?.active, boostersData?.autoCollect?.leftSec)}
        ${item("👑", "VIP", boostersData?.vip?.active, boostersData?.vip?.leftSec)}
        ${item("🌽", "Feed Active", boostersData?.feed?.active, boostersData?.feed?.leftSec)}
      </div>
    </section>
  `;
}

function leaderboardSection(items, myTelegramId) {
  const rows = (items || [])
    .slice(0, 10)
    .map((u, i) => {
      const idStr = String(u.telegramId ?? "");
      const isMe = myTelegramId && idStr === myTelegramId;
      const medal =
        i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`;
      const shortId = idStr ? `ID ${idStr.slice(-5)}` : "Player";
      return `
        <div class="lb-row ${isMe ? "lb-me" : ""}">
          <div class="lb-rank">${medal}</div>
          <div class="lb-user">
            <div class="lb-name">${isMe ? "Ти" : shortId}</div>
            <div class="lb-level">Рівень ${u.level ?? 1}</div>
          </div>
          <div class="lb-coins">${u.coins ?? 0} 💰</div>
        </div>
      `;
    })
    .join("");

  return `
    <section class="panel">
      <div class="panel-title">🏆 Топ гравців</div>
      <div class="leaderboard">
        ${rows || `<div class="lb-empty">Поки що немає даних</div>`}
      </div>
    </section>
  `;
}

function xpSection(level, xp) {
  const need = xpNeed(level);
  const percent = pct(xp, need);
  return `
    <section class="panel">
      <div class="panel-title">⭐ Рівень гравця</div>
      <div class="xp-header">
        <div class="xp-level-badge">LVL ${level}</div>
        <div class="xp-meta">
          <div class="xp-title">Прогрес рівня</div>
          <div class="xp-sub">${xp} / ${need} XP</div>
        </div>
      </div>
      <div class="xp-track">
        <div class="xp-fill" style="width:${percent}%"></div>
      </div>
    </section>
  `;
}

function renderModal(
  state,
  achievements = [],
  referralsData = null,
  wheelState = null,
  questsData = { items: [] },
  shopData = { items: [] },
  premiumProductsData = { items: [] },
) {
  const animals = state.animals ?? {};
  const storage = state.storage ?? {};
  const ready = state.ready ?? {};

  if (!uiState.modal) return "";

  let title = "";
  let body = "";

  if (uiState.modal === "animals") {
    title = "🐾 Тварини";
    body = `
      <div class="modal-grid">
        ${animalCard("🐔", "Курка", "Дає яйця", animals.chicken ?? 0, 50, 100, "buyChicken", "upgradeChicken", "green-card")}
        ${animalCard("🐑", "Вівця", "Дає шерсть", animals.sheep ?? 0, 120, 200, "buySheep", "upgradeSheep", "blue-card")}
        ${animalCard("🐮", "Корова", "Дає молоко", animals.cow ?? 0, 500, 400, "buyCow", "upgradeCow", "orange-card")}
      </div>
    `;
  }

  if (uiState.modal === "storage") {
    title = "📦 Склад";
    body = `
      <div class="modal-grid">
        ${resourceCard("🥚", "Яйця", storage.eggs ?? 0, ready.eggsReady ?? 0)}
        ${resourceCard("🧶", "Шерсть", storage.wool ?? 0, ready.woolReady ?? 0)}
        ${resourceCard("🥛", "Молоко", storage.milk ?? 0, ready.milkReady ?? 0)}
      </div>
      <div class="warehouse">
        <div class="warehouse-head">
          <span>Заповнення складу</span>
          <span>${storage.total ?? 0} / ${storage.capacity ?? 0}</span>
        </div>
        <div class="warehouse-track">
          <div class="warehouse-fill" style="width:${pct(storage.total ?? 0, storage.capacity ?? 0)}%"></div>
        </div>
      </div>
      <div class="panel-actions">
        <button id="collectBtn" class="secondary-btn">📥 Зібрати в склад</button>
        <button id="sellBtn" class="secondary-btn">📦 Продати все</button>
      </div>
    `;
  }

  if (uiState.modal === "achievements") {
    title = "🏆 Achievements";
    body = `<div class="ach-grid">${achievements.map(achievementCard).join("")}</div>`;
  }

  if (uiState.modal === "quests") {
    title = "📜 Quests";
    body = `<div class="ach-grid">${(questsData?.items ?? []).map(questCard).join("")}</div>`;
  }

  if (uiState.modal === "referrals") {
    const myLink = `https://t.me/${BOT_NAME}?start=${TELEGRAM_ID}`;
    const list = referralsData?.referrals ?? [];
    const total = referralsData?.total ?? 0;
    title = "👥 Referrals";
    body = `
      <div class="panel">
        <div class="panel-title">Твоє реферальне посилання</div>
        <div class="ref-box">
          <input id="refLinkInput" class="ref-input" value="${myLink}" readonly />
          <button id="copyRefBtn" class="secondary-btn">Copy</button>
        </div>
        <div class="panel-sub">Запрошено друзів: ${total}</div>
      </div>
      <div class="ach-grid">
        ${list.length ? list.map(referralCard).join("") : `<div class="lb-empty">Ще немає рефералів</div>`}
      </div>
    `;
  }

  if (uiState.modal === "wheel") {
    title = "🎰 Lucky Wheel";
    body = wheelCard(wheelState);
  }

  if (uiState.modal === "shop") {
    title = "🛒 Shop";
    body = `
    <div class="panel">
      <div class="panel-title">Баланс</div>
      <div class="panel-sub">💰 ${state.coins ?? 0} · 💎 ${state.diamonds ?? 0}</div>
    </div>

    <div class="ach-grid">
      ${(shopData?.items ?? []).map(shopItemCard).join("")}
    </div>

    <div class="panel">
      <div class="panel-title">⭐ Premium Shop</div>
      <div class="ach-grid">
        ${(premiumProductsData?.items ?? [])
          .map(
            (item) => `
          <div class="ach-card">
            <div class="ach-top">
              <div>
                <div class="ach-title">${item.title}</div>
                <div class="ach-desc">${item.description}</div>
              </div>
              <div class="ach-reward">⭐ ${item.starsAmount}</div>
            </div>
            <div class="ach-bottom">
              <div class="ach-status">Telegram Stars</div>
              <button class="ach-btn" data-stars-buy="${item.code}">Buy with Stars</button>
            </div>
          </div>
        `,
          )
          .join("")}
      </div>
    </div>
  `;
  }
  return `
    <div class="modal-backdrop" id="modalBackdrop">
      <div class="modal-window">
        <div class="modal-header">
          <div class="modal-title">${title}</div>
          <button class="modal-close" id="modalClose">✕</button>
        </div>
        <div class="modal-body">
          ${body}
        </div>
      </div>
    </div>
  `;
}

function render(
  state,
  levelData = { level: 1, xp: 0 },
  leaderboard = [],
  achievements = [],
  referralsData = null,
  wheelState = null,
  questsData = { items: [] },
  shopData = { items: [] },
  premiumProductsData = { items: [] },
  dailyLoginData = {
    streak: 0,
    claimedToday: false,
    nextDay: 1,
    reward: null,
    rewards: [],
    canClaim: true,
  },
  boostersData = {
    boost: { active: false, leftSec: 0 },
    autoCollect: { active: false, leftSec: 0 },
    vip: { active: false, leftSec: 0 },
    feed: { active: false, leftSec: 0 },
  },
) {
  const feed = state.feed ?? {};
  const canClaimDaily = dailyLoginData.canClaim ?? !dailyLoginData.claimedToday;

  app.innerHTML = `
    <div class="screen">
      <section class="hero">
        <div class="hero-left">
          <div class="hero-logo">🚜</div>
          <div>
            <div class="hero-title">Farm Game</div>
            <div class="hero-sub">Ферма в Telegram Mini App</div>
          </div>
        </div>
        <div class="hero-bell">🏆</div>
      </section>

      <section class="top-stats">
        ${statCard("🪙", "Coins", state.coins ?? 0)}
        ${statCard("💎", "Diamonds", state.diamonds ?? 0)}
        ${statCard("⭐", "Points", state.points ?? 0)}
      </section>

      ${xpSection(levelData.level ?? 1, levelData.xp ?? 0)}
      ${productionSection(state)}
      ${boostersSection(boostersData)}

      <section class="panel">
        <div class="panel-title">📂 Меню гри</div>
        <div class="menu-grid">
          <button id="tapBtn" class="menu-btn green-btn">⚡ Tap</button>
          <button id="feedTopBtn" class="menu-btn orange">🌽 Купити корм</button>
          <button id="openAnimalsBtn" class="menu-btn">🐾 Тварини</button>
          <button id="openStorageBtn" class="menu-btn">📦 Склад</button>
          <button id="openAchievementsBtn" class="menu-btn">🏆 Achievements</button>
          <button id="openQuestsBtn" class="menu-btn">📜 Quests</button>
          <button id="openReferralsBtn" class="menu-btn">👥 Referrals</button>
          <button id="openWheelBtn" class="menu-btn">🎰 Lucky Wheel</button>
          <button id="openShopBtn" class="menu-btn">🛒 Shop</button>
          <button id="dailyLoginTopBtn" class="menu-btn">🎁 Daily Login</button>
        </div>
      </section>

      <section class="panel">
        <div class="panel-title">🌽 Корм</div>
        <div class="feed-grid">
          <div class="feed-meta">
            <div>Статус: <b>${feed.active ? "Увімкнений" : "Вимкнений"}</b></div>
            <div>Залишилось: <b>${fmtSeconds(feed.leftSec)}</b></div>
            <div>До старту виробництва: <b>${fmtSeconds(feed.waitSec)}</b></div>
          </div>
          <div class="panel-actions right">
            <button id="feedBtn" class="primary-btn orange">🌽 Купити корм (500)</button>
          </div>
        </div>
      </section>

      ${leaderboardSection(leaderboard, TELEGRAM_ID)}

      <section class="panel">
        <div class="panel-title">🎁 Daily Login</div>
        <div class="daily-box">
          <div class="daily-circle">${dailyLoginData.nextDay ?? 1}</div>
          <div class="daily-text">
            <div class="daily-title">Day ${dailyLoginData.nextDay ?? 1}</div>
            <div class="daily-sub">
              Reward:
              ${dailyLoginData.reward?.coins ? `💰 ${dailyLoginData.reward.coins}` : ""}
              ${dailyLoginData.reward?.diamonds ? ` 💎 ${dailyLoginData.reward.diamonds}` : ""}
              ${dailyLoginData.reward?.freeWheelSpin ? ` 🎰 Free wheel spin` : ""}
            </div>
          </div>
          <button id="dailyLoginBtn" class="secondary-btn" ${canClaimDaily ? "" : "disabled"}>
            ${canClaimDaily ? "Claim login" : "Забрано"}
          </button>
        </div>
      </section>

      ${renderModal(state, achievements, referralsData, wheelState, questsData, shopData, premiumProductsData)}

      <div class="toast" id="toast"></div>
    </div>
  `;
}

async function apiGet(url) {
  const res = await fetch(url, {
    headers: {
      "x-telegram-init-data": window.Telegram?.WebApp?.initData ?? "",
    },
  });
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok, json };
}

async function apiPost(url, body = {}) {
  const res = await fetch(url, {
    method: "POST",
    headers: tgHeaders(),
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok, json };
}

function showOfflinePopup(minutes, added) {
  const old = document.getElementById("offlinePopup");
  if (old) old.remove();

  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const timeText = h > 0 ? `${h}г ${m}хв` : `${m}хв`;

  const html = `
    <div class="modal-backdrop" id="offlinePopup">
      <div class="modal-window offline-popup">
        <div class="modal-header">
          <div class="modal-title">💰 Welcome back</div>
          <button class="modal-close" id="offlineCloseBtn">✕</button>
        </div>
        <div class="offline-box">
          <div class="offline-time">Офлайн: <b>${timeText}</b></div>
          <div class="offline-rewards">
            <div class="offline-reward">🥚 +${added.eggs ?? 0}</div>
            <div class="offline-reward">🧶 +${added.wool ?? 0}</div>
            <div class="offline-reward">🥛 +${added.milk ?? 0}</div>
          </div>
          <button id="offlineOkBtn" class="primary-btn green">Забрати</button>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML("beforeend", html);
  document.getElementById("offlineCloseBtn")?.addEventListener("click", () => {
    document.getElementById("offlinePopup")?.remove();
  });
  document.getElementById("offlineOkBtn")?.addEventListener("click", () => {
    document.getElementById("offlinePopup")?.remove();
  });
}

function showTutorialPopup() {
  const alreadySeen = localStorage.getItem("farm_tutorial_seen");
  if (alreadySeen === "1") return;

  const html = `
    <div class="modal-backdrop" id="tutorialPopup">
      <div class="modal-window tutorial-popup">
        <div class="modal-header">
          <div class="modal-title">👨‍🌾 Welcome to Farm Game</div>
        </div>
        <div class="tutorial-box">
          <div class="tutorial-step">1️⃣ Tap, щоб заробити перші coins</div>
          <div class="tutorial-step">2️⃣ Купи курку у вкладці Animals</div>
          <div class="tutorial-step">3️⃣ Купи корм, щоб тварини працювали</div>
          <div class="tutorial-step">4️⃣ Збери ресурси і продай їх</div>
          <button id="tutorialStartBtn" class="primary-btn green">Почати</button>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML("beforeend", html);
  document.getElementById("tutorialStartBtn")?.addEventListener("click", () => {
    localStorage.setItem("farm_tutorial_seen", "1");
    document.getElementById("tutorialPopup")?.remove();
  });
}

function normalizeWheelState(json) {
  return {
    costDiamonds: json?.costDiamonds ?? 3,
    cooldownSec: json?.cooldownSec ?? json?.cooldown ?? 0,
    rewards: Array.isArray(json?.rewards)
      ? json.rewards.map((r) => (typeof r === "string" ? { label: r } : r))
      : [],
  };
}

async function loadState() {
  const stateRes = await apiGet(`${API}/state`);
  if (!stateRes.ok) return showToast(stateRes.json?.error || "State error");

  let levelData = { level: 1, xp: 0 };
  if (TELEGRAM_ID) {
    const levelRes = await apiGet(
      `${API}/level?telegramId=${encodeURIComponent(TELEGRAM_ID)}`,
    );
    if (levelRes.ok) levelData = levelRes.json;
  }

  let leaderboard = [];
  const lbRes = await apiGet(`${API}/leaderboard`);
  if (lbRes.ok && Array.isArray(lbRes.json)) leaderboard = lbRes.json;

  let achievements = [];
  const achRes = await apiGet(`${API}/achievements`);
  if (achRes.ok && Array.isArray(achRes.json?.items))
    achievements = achRes.json.items;

  let questsData = { items: [] };
  const questRes = await apiGet(`${API}/quests`);
  if (questRes.ok) questsData = questRes.json;

  let referralsData = { total: 0, referrals: [] };
  const refRes = await apiGet(`${API}/referral/my`);
  if (refRes.ok) referralsData = refRes.json;

  let wheelState = { costDiamonds: 3, cooldownSec: 0, rewards: [] };
  const wheelRes = await apiGet(`${API}/wheel/state`);
  if (wheelRes.ok) wheelState = normalizeWheelState(wheelRes.json);

  let shopData = { items: [] };
  const shopRes = await apiGet(`${API}/shop`);
  if (shopRes.ok) shopData = shopRes.json;

  let premiumProductsData = { items: [] };
  const premiumProductsRes = await apiGet(`${API}/payments/products`);
  if (premiumProductsRes.ok) premiumProductsData = premiumProductsRes.json;

  let dailyLoginData = {
    streak: 0,
    claimedToday: false,
    nextDay: 1,
    reward: null,
    rewards: [],
    canClaim: true,
  };
  const dailyLoginRes = await apiGet(`${API}/daily-login/status`);
  if (dailyLoginRes.ok)
    dailyLoginData = { ...dailyLoginData, ...dailyLoginRes.json };

  let boostersData = {
    boost: { active: false, leftSec: 0 },
    autoCollect: { active: false, leftSec: 0 },
    vip: { active: false, leftSec: 0 },
    feed: { active: false, leftSec: 0 },
  };
  const boostersRes = await apiGet(`${API}/boosters/status`);
  if (boostersRes.ok) boostersData = boostersRes.json;

  render(
    stateRes.json,
    levelData,
    leaderboard,
    achievements,
    referralsData,
    wheelState,
    questsData,
    shopData,
    premiumProductsData,
    dailyLoginData,
    boostersData,
  );

  const off = stateRes.json?.offline;
  if (off && off.minutes > 0) {
    const added = off.added ?? {};
    const total = (added.eggs ?? 0) + (added.wool ?? 0) + (added.milk ?? 0);
    if (total > 0) showOfflinePopup(off.minutes, added);
  }

  bindHandlers();
  showTutorialPopup();
}

function openModal(type) {
  uiState.modal = type;
  loadState();
}

function closeModal() {
  uiState.modal = null;
  loadState();
}

function animateCasinoWheelToReward(rewardLabel, rewards) {
  return new Promise((resolve) => {
    const wheel = document.getElementById("casinoWheel");
    if (!wheel) return resolve();

    const labels = rewards.map((r) => (typeof r === "string" ? r : r.label));
    let index = labels.findIndex((x) => x === rewardLabel);
    if (index < 0) index = 0;

    const segmentAngle = 360 / Math.max(1, labels.length);
    const targetAngle = 360 - index * segmentAngle - segmentAngle / 2;
    const spins = 5;
    const finalDeg = spins * 360 + targetAngle;

    wheel.style.transition = "transform 4s cubic-bezier(0.12, 0.8, 0.18, 1)";
    wheel.style.transform = `rotate(${finalDeg}deg)`;

    setTimeout(() => resolve(), 4000);
  });
}

function bindHandlers() {
  document
    .getElementById("tapBtn")
    ?.addEventListener("click", () => withActionLock("tap", tap));
  document
    .getElementById("feedBtn")
    ?.addEventListener("click", () => withActionLock("feed", feed));
  document
    .getElementById("feedTopBtn")
    ?.addEventListener("click", () => withActionLock("feedTop", feed));

  document
    .getElementById("openAnimalsBtn")
    ?.addEventListener("click", () => openModal("animals"));
  document
    .getElementById("openStorageBtn")
    ?.addEventListener("click", () => openModal("storage"));
  document
    .getElementById("openAchievementsBtn")
    ?.addEventListener("click", () => openModal("achievements"));
  document
    .getElementById("openQuestsBtn")
    ?.addEventListener("click", () => openModal("quests"));
  document
    .getElementById("openReferralsBtn")
    ?.addEventListener("click", () => openModal("referrals"));
  document
    .getElementById("openWheelBtn")
    ?.addEventListener("click", () => openModal("wheel"));
  document
    .getElementById("openShopBtn")
    ?.addEventListener("click", () => openModal("shop"));
  document
    .getElementById("dailyLoginBtn")
    ?.addEventListener("click", () =>
      withActionLock("dailyLogin", claimDailyLogin),
    );
  document
    .getElementById("dailyLoginTopBtn")
    ?.addEventListener("click", () =>
      withActionLock("dailyLoginTop", claimDailyLogin),
    );

  document.getElementById("modalClose")?.addEventListener("click", closeModal);
  document.getElementById("modalBackdrop")?.addEventListener("click", (e) => {
    if (e.target?.id === "modalBackdrop") closeModal();
  });

  document
    .getElementById("buyChicken")
    ?.addEventListener("click", () =>
      withActionLock("buyChicken", () => buy("CHICKEN")),
    );
  document
    .getElementById("buySheep")
    ?.addEventListener("click", () =>
      withActionLock("buySheep", () => buy("SHEEP")),
    );
  document
    .getElementById("buyCow")
    ?.addEventListener("click", () =>
      withActionLock("buyCow", () => buy("COW")),
    );

  document
    .getElementById("upgradeChicken")
    ?.addEventListener("click", () =>
      withActionLock("upgradeChicken", () => upgrade("CHICKEN")),
    );
  document
    .getElementById("upgradeSheep")
    ?.addEventListener("click", () =>
      withActionLock("upgradeSheep", () => upgrade("SHEEP")),
    );
  document
    .getElementById("upgradeCow")
    ?.addEventListener("click", () =>
      withActionLock("upgradeCow", () => upgrade("COW")),
    );

  document
    .getElementById("collectBtn")
    ?.addEventListener("click", () => withActionLock("collect", collect));
  document
    .getElementById("sellBtn")
    ?.addEventListener("click", () => withActionLock("sellAll", sellAll));

  document.getElementById("copyRefBtn")?.addEventListener("click", async () => {
    const input = document.getElementById("refLinkInput");
    const value = input?.value ?? "";
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      showToast("Link copied");
    } catch {
      showToast("Copy error");
    }
  });

  document
    .getElementById("spinWheelBtn")
    ?.addEventListener("click", () => withActionLock("wheel", spinWheel));

  document.querySelectorAll("[data-shop-buy]").forEach((btn) => {
    btn.addEventListener("click", () =>
      withActionLock(`shop:${btn.getAttribute("data-shop-buy")}`, () =>
        buyShopItem(btn.getAttribute("data-shop-buy")),
      ),
    );
  });

  document.querySelectorAll("[data-stars-buy]").forEach((btn) => {
    btn.addEventListener("click", () =>
      withActionLock(`stars:${btn.getAttribute("data-stars-buy")}`, () =>
        buyWithStars(btn.getAttribute("data-stars-buy")),
      ),
    );
  });

  document.querySelectorAll("[data-quest-claim]").forEach((btn) => {
    btn.addEventListener("click", () =>
      withActionLock(`quest:${btn.getAttribute("data-quest-claim")}`, () =>
        claimQuest(btn.getAttribute("data-quest-claim")),
      ),
    );
  });

  document.querySelectorAll("[data-ach-claim]").forEach((btn) => {
    btn.addEventListener("click", () =>
      withActionLock(`ach:${btn.getAttribute("data-ach-claim")}`, () =>
        claimAchievement(btn.getAttribute("data-ach-claim")),
      ),
    );
  });
}

async function tap() {
  const { ok, json } = await apiPost(`${API}/tap`, { telegramId: TELEGRAM_ID });
  if (!ok) return showToast(json?.error || "Tap error");
  showToast(`+${json.coinsAdded ?? json.coins ?? 1} coin`);
  loadState();
}

async function feed() {
  const { ok, json } = await apiPost(`${API}/feed`, {
    telegramId: TELEGRAM_ID,
  });
  if (!ok) return showToast(json?.error || "Feed error");
  showToast("🌽 Корм куплено");
  loadState();
}

async function buy(type) {
  const { ok, json } = await apiPost(`${API}/animals/buy`, {
    type,
    telegramId: TELEGRAM_ID,
  });
  if (!ok) return showToast(json?.error || "Buy error");

  const names = { CHICKEN: "Курка", SHEEP: "Вівця", COW: "Корова" };
  showToast(`Куплено: ${names[type]}`);
  loadState();
}

async function upgrade(type) {
  const { ok, json } = await apiPost(`${API}/animal-upgrade`, {
    type,
    telegramId: TELEGRAM_ID,
  });
  if (!ok) return showToast(json?.error || "Upgrade error");
  showToast(`Upgrade! Level ${json.level}`);
  loadState();
}

async function collect() {
  const { ok, json } = await apiPost(`${API}/collect/claim`, {
    telegramId: TELEGRAM_ID,
  });
  if (!ok) return showToast(json?.error || "Collect error");
  const a = json?.added ?? json ?? {};
  showToast(`+🥚${a.eggs ?? 0} +🧶${a.wool ?? 0} +🥛${a.milk ?? 0}`);
  loadState();
}

async function sellAll() {
  const { ok, json } = await apiPost(`${API}/sell/all`, {
    telegramId: TELEGRAM_ID,
  });
  if (!ok) return showToast(json?.error || "Sell error");
  showToast(`💰 +${json.earned ?? 0}`);
  loadState();
}

async function claimAchievement(code) {
  const { ok, json } = await apiPost(`${API}/achievements/claim`, {
    code,
    telegramId: TELEGRAM_ID,
  });
  if (!ok) return showToast(json?.error || "Claim error");
  showToast(
    `🎉 Нагорода: +${json.rewardCoins ?? 0} coins, +${json.rewardDiamonds ?? 0} diamonds`,
  );
  loadState();
}

async function claimQuest(code) {
  const { ok, json } = await apiPost(`${API}/quests/claim`, {
    code,
    telegramId: TELEGRAM_ID,
  });
  if (!ok) return showToast(json?.error || "Quest error");
  showToast(
    `📜 +${json.rewardCoins ?? 0} coins +${json.rewardDiamonds ?? 0} diamonds +${json.rewardXp ?? 0} XP`,
  );
  loadState();
}

async function spinWheel() {
  const spinBtn = document.getElementById("spinWheelBtn");
  if (spinBtn) spinBtn.disabled = true;

  const wheelStateRes = await apiGet(`${API}/wheel/state`);
  const rewards = wheelStateRes.ok
    ? normalizeWheelState(wheelStateRes.json).rewards
    : [];

  const res = await apiPost(`${API}/wheel/spin`, { telegramId: TELEGRAM_ID });
  if (!res.ok) {
    showToast(res.json?.error || "Wheel error");
    if (spinBtn) spinBtn.disabled = false;
    return;
  }

  const reward = res.json.reward;
  await animateCasinoWheelToReward(reward, rewards);
  showToast(`🎰 ${reward}`);
  loadState();
}

async function buyShopItem(code) {
  const { ok, json } = await apiPost(`${API}/shop/buy`, {
    code,
    telegramId: TELEGRAM_ID,
  });
  if (!ok) return showToast(json?.error || "Shop error");
  showToast(`🛒 Куплено: ${json.title}`);
  loadState();
}

async function claimDailyLogin() {
  const variants = [
    `${API}/daily-login/claim-login`,
    `${API}/daily-login/claim`,
    `${API}/daily/claim`,
  ];

  for (const url of variants) {
    const { ok, json } = await apiPost(url, { telegramId: TELEGRAM_ID });
    if (!ok) continue;

    const reward = json.reward ?? {};
    const day = json.day ?? json.streak ?? 1;
    const rewardText =
      `${reward.coins ? `💰 ${reward.coins}` : ""}` +
      `${reward.coins && reward.diamonds ? " " : ""}` +
      `${reward.diamonds ? `💎 ${reward.diamonds}` : ""}` +
      `${(reward.coins || reward.diamonds) && reward.freeWheelSpin ? " " : ""}` +
      `${reward.freeWheelSpin ? "🎰 free spin" : ""}`;

    showToast(`🎁 Day ${day}: ${rewardText}`);
    loadState();
    return;
  }

  showToast("Daily login error");
}

async function buyWithStars(productCode) {
  const { ok, json } = await apiPost(`${API}/payments/create-invoice`, {
    productCode,
    telegramId: TELEGRAM_ID,
  });

  if (!ok) {
    showToast(json?.error || "Invoice error");
    return;
  }

  const link = json.invoiceLink;
  if (!link) {
    showToast("No invoice link");
    return;
  }

  if (window.Telegram?.WebApp?.openInvoice) {
    window.Telegram.WebApp.openInvoice(link, (status) => {
      if (status === "paid") {
        showToast("⭐ Payment success");
        setTimeout(loadState, 1200);
      } else if (status === "cancelled") {
        showToast("Payment cancelled");
      } else {
        showToast(status || "Invoice closed");
      }
    });
    return;
  }

  window.open(link, "_blank");
}

loadState();
