import { Router } from "express";
import { prisma } from "../prisma";

const router = Router();

router.get("/wallet", (_req, res) => {
  res.send(`
<!doctype html>
<html lang="uk">
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Admin Wallet</title>
  <style>
    body{font-family:Arial;background:#0f172a;color:white;padding:20px;margin:0}
    .card{max-width:420px;margin:auto;background:#1e293b;padding:18px;border-radius:18px}
    input,button{width:100%;box-sizing:border-box;padding:14px;margin-top:10px;border:0;border-radius:12px;font-size:16px}
    input{background:#334155;color:white}
    button{background:#2563eb;color:white;font-weight:800}
    pre{background:#020617;padding:12px;border-radius:12px;white-space:pre-wrap}
  </style>
</head>
<body>
  <div class="card">
    <h2>👛 Admin TON Wallet</h2>
    <input id="secret" placeholder="Admin secret" />
    <input id="telegramId" placeholder="Telegram ID" />
    <input id="amount" type="number" step="0.01" placeholder="TON amount" />
    <button onclick="addTon()">Додати TON</button>
    <pre id="result"></pre>
  </div>

  <script>
    async function addTon() {
      const res = await fetch("/admin/wallet/add-ton", {
        method: "POST",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify({
          secret: document.getElementById("secret").value,
          telegramId: document.getElementById("telegramId").value,
          amount: Number(document.getElementById("amount").value)
        })
      });

      const data = await res.json();
      document.getElementById("result").textContent = JSON.stringify(data, null, 2);
    }
  </script>
</body>
</html>
  `);
});

router.post("/wallet/add-ton", async (req, res) => {
  try {
    const secret = req.body.secret;
    const telegramId = req.body.telegramId;
    const amount = Number(req.body.amount);

    if (!process.env.ADMIN_SECRET || secret !== process.env.ADMIN_SECRET) {
      return res.status(401).json({
        ok: false,
        error: "Unauthorized",
      });
    }

    if (!telegramId || !amount || amount <= 0) {
      return res.status(400).json({
        ok: false,
        error: "Invalid telegramId or amount",
      });
    }

    const updated = await prisma.user.update({
      where: {
        telegramId: BigInt(telegramId),
      },
      data: {
        tonBalance: {
          increment: amount,
        },
      },
      select: {
        telegramId: true,
        tonBalance: true,
      },
    });

    return res.json({
      ok: true,
      telegramId: updated.telegramId.toString(),
      addedTon: amount,
      tonBalance: updated.tonBalance,
    });
  } catch (e) {
    console.error("ADMIN WALLET ERROR:", e);

    return res.status(500).json({
      ok: false,
      error: "Server error",
    });
  }
});

export default router;
