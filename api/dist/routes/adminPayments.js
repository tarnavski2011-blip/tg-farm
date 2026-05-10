"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../prisma");
const router = (0, express_1.Router)();
function escapeHtml(value) {
    return String(value ?? "")
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;");
}
router.get("/payments", async (_req, res) => {
    const payments = await prisma_1.prisma.payment.findMany({
        orderBy: { createdAt: "desc" },
        take: 100,
        include: {
            user: {
                select: {
                    id: true,
                    telegramId: true,
                    coins: true,
                    diamonds: true,
                    points: true,
                },
            },
        },
    });
    const rows = payments
        .map((p) => {
        return `
        <tr>
          <td>${p.id}</td>
          <td>${escapeHtml(p.user.telegramId.toString())}</td>
          <td>${escapeHtml(p.productCode)}</td>
          <td>${p.amount}</td>
          <td>${escapeHtml(p.currency)}</td>
          <td class="${p.status === "paid" ? "paid" : "pending"}">${escapeHtml(p.status)}</td>
          <td>${p.user.diamonds}</td>
          <td>${new Date(p.createdAt).toLocaleString()}</td>
          <td>${p.paidAt ? new Date(p.paidAt).toLocaleString() : "-"}</td>
        </tr>
      `;
    })
        .join("");
    res.send(`
<!doctype html>
<html lang="uk">
<head>
  <meta charset="utf-8" />
  <title>My Farm Clicker Admin</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      background: #0b1220;
      color: #e5e7eb;
      padding: 24px;
    }
    h1 { margin-bottom: 8px; }
    .card {
      background: #111827;
      border: 1px solid #253047;
      border-radius: 16px;
      padding: 20px;
      margin-top: 20px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 16px;
    }
    th, td {
      padding: 12px;
      border-bottom: 1px solid #253047;
      text-align: left;
      font-size: 14px;
    }
    th {
      color: #93c5fd;
    }
    .paid {
      color: #22c55e;
      font-weight: bold;
    }
    .pending {
      color: #facc15;
      font-weight: bold;
    }
  </style>
</head>
<body>
  <h1>🚜 My Farm Clicker Admin</h1>
  <p>Лог покупок Stars / Diamonds</p>

  <div class="card">
    <h2>Останні покупки</h2>
    <table>
      <thead>
        <tr>
          <th>ID</th>
          <th>Telegram ID</th>
          <th>Product</th>
          <th>Diamonds</th>
          <th>Currency</th>
          <th>Status</th>
          <th>User diamonds</th>
          <th>Created</th>
          <th>Paid</th>
        </tr>
      </thead>
      <tbody>
        ${rows || `<tr><td colspan="9">Покупок ще немає</td></tr>`}
      </tbody>
    </table>
  </div>
</body>
</html>
  `);
});
exports.default = router;
