import { Router } from "express";
import { prisma } from "../prisma";

const router = Router();

function isAdmin(secret?: string) {
  return !!process.env.ADMIN_SECRET && secret === process.env.ADMIN_SECRET;
}

router.get("/withdrawals", async (req, res) => {
  const secret = String(req.query.secret ?? "");

  if (!isAdmin(secret)) {
    return res.status(401).send("Unauthorized");
  }

  const withdrawals = await prisma.withdrawalRequest.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      user: {
        select: {
          telegramId: true,
        },
      },
    },
  });

  res.send(`
    <!doctype html>
    <html lang="uk">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Withdrawals</title>
        <style>
          body{font-family:Arial;background:#0f172a;color:white;padding:16px;margin:0}
          .card{background:#1e293b;padding:14px;border-radius:16px;margin-bottom:12px}
          .row{display:flex;justify-content:space-between;gap:10px;margin:8px 0;font-size:14px}
          button{width:100%;padding:12px;border:0;border-radius:12px;background:#2563eb;color:white;font-weight:800;margin-top:8px}
          .ok{color:#22c55e;font-weight:800}
          .bad{color:#f87171;font-weight:800}
          .pending{color:#facc15;font-weight:800}
          code{word-break:break-all}
        </style>
      </head>
      <body>
        <h2>💸 Withdrawals</h2>

        ${withdrawals
          .map(
            (w) => `
              <div class="card">
                <div class="row"><span>ID</span><b>${w.id}</b></div>
                <div class="row"><span>User</span><b>${w.user.telegramId.toString()}</b></div>
                <div class="row"><span>Points</span><b>${w.pointsAmount}</b></div>
                <div class="row"><span>TON</span><b>${w.tonAmount}</b></div>
                <div class="row"><span>Status</span><b class="${w.status}">${w.status}</b></div>
                <div>Address:</div>
                <code>${w.tonAddress}</code>

                ${
                  w.status === "pending"
                    ? `
                      <button onclick="setStatus(${w.id}, 'approved')">Approve</button>
                      <button style="background:#dc2626" onclick="setStatus(${w.id}, 'rejected')">Reject</button>
                    `
                    : ""
                }
              </div>
            `,
          )
          .join("")}

        <script>
          async function setStatus(id, status) {
            const res = await fetch("/admin/withdrawals/" + id + "/status", {
              method: "POST",
              headers: {"Content-Type":"application/json"},
              body: JSON.stringify({
                secret: "${secret}",
                status
              })
            });

            const data = await res.json();
            alert(JSON.stringify(data, null, 2));
            location.reload();
          }
        </script>
      </body>
    </html>
  `);
});

router.post("/withdrawals/:id/status", async (req, res) => {
  try {
    const secret = req.body.secret;
    const status = String(req.body.status ?? "");
    const id = Number(req.params.id);

    if (!isAdmin(secret)) {
      return res.status(401).json({ ok: false, error: "Unauthorized" });
    }

    if (!["approved", "rejected"].includes(status)) {
      return res.status(400).json({ ok: false, error: "Invalid status" });
    }

    const updated = await prisma.withdrawalRequest.update({
      where: { id },
      data: { status },
    });

    return res.json({
      ok: true,
      id: updated.id,
      status: updated.status,
    });
  } catch (e) {
    console.error("ADMIN WITHDRAWALS ERROR:", e);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
});

export default router;
