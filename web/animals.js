export function openAnimals() {
  const screen = document.getElementById("animalsScreen");
  if (screen) screen.classList.remove("hidden");
}

export function closeAnimals() {
  const screen = document.getElementById("animalsScreen");
  if (screen) screen.classList.add("hidden");
}

export async function buyAnimal(type) {
  try {
    const tg = window.Telegram?.WebApp;
    const telegramId = tg?.initDataUnsafe?.user?.id ?? 123;

    const res = await fetch("/api/animals/buy", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        telegramId,
        type,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      alert(data.error || "Error buying animal");
      return;
    }

    loadAnimals();
  } catch (err) {
    console.error(err);
  }
}

export async function loadAnimals() {
  try {
    const tg = window.Telegram?.WebApp;
    const telegramId = tg?.initDataUnsafe?.user?.id ?? 123;

    const res = await fetch(`/api/state?telegramId=${telegramId}`);
    const data = await res.json();

    document.getElementById("chickenCount").innerText =
      (data.animals?.chicken ?? 0) + " owned";

    document.getElementById("sheepCount").innerText =
      (data.animals?.sheep ?? 0) + " owned";

    document.getElementById("cowCount").innerText =
      (data.animals?.cow ?? 0) + " owned";
  } catch (err) {
    console.error(err);
  }
}
