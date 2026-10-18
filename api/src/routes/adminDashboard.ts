import { Router, Request, Response, NextFunction } from "express";
import crypto from "crypto";
import { prisma } from "../prisma";

const router = Router();
const COOKIE = "farm_admin_session";
const TTL = 8 * 60 * 60;
const esc = (v: unknown) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
const fmt = (v: number) => new Intl.NumberFormat("uk-UA", { maximumFractionDigits: 3 }).format(v);
const date = (v: Date) => v.toISOString().slice(0, 16).replace("T", " ") + " UTC";
function secret() { return process.env.ADMIN_SECRET || ""; }
function signature(exp: string) { return crypto.createHmac("sha256", secret()).update(exp).digest("hex"); }
function authorized(req: Request) {
  if (!secret()) return false;
  const match = (req.headers.cookie || "").split(";").map(x => x.trim()).find(x => x.startsWith(COOKIE + "="));
  if (!match) return false;
  const value = match.slice(COOKIE.length + 1);
  const [exp, sig] = value.split(".");
  if (!exp || !sig || !/^\d+$/.test(exp) || Number(exp) < Math.floor(Date.now()/1000)) return false;
  const expected = signature(exp);
  return sig.length === expected.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
}
export function requireAdminSession(req: Request, res: Response, next: NextFunction) {
  if (authorized(req)) return next();
  res.status(401).send(page("Доступ заборонено", `<section class="panel"><h2>Потрібен вхід адміністратора</h2><a href="/admin/dashboard">Перейти до входу</a></section>`));
}
function page(title: string, content: string) {
 return `<!doctype html><html lang="uk"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer"><meta http-equiv="Cache-Control" content="no-store"><title>${esc(title)} · My Farm Clicker</title><style>
 :root{color-scheme:dark}*{box-sizing:border-box}body{margin:0;background:#0b1220;color:#e5edf9;font:15px system-ui,Arial,sans-serif}main{max-width:1220px;margin:auto;padding:22px 15px 55px}a{color:#93c5fd;text-decoration:none}header{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:22px}h1{font-size:24px;margin:0}h2{font-size:17px;margin:0 0 16px}.muted{color:#a7b5c9;font-size:13px}.grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin:18px 0}.tile,.panel{background:#172338;border:1px solid #2a3b56;border-radius:16px;padding:17px}.tile strong{display:block;font-size:25px;margin:8px 0 2px;overflow-wrap:anywhere}.tile span{font-size:12px;color:#a7b5c9}.panel{margin:14px 0;overflow:auto}.tablewrap{overflow-x:auto}table{border-collapse:collapse;width:100%;min-width:640px}th,td{text-align:left;padding:11px 9px;border-bottom:1px solid #2a3b56;font-size:13px;white-space:nowrap}th{color:#9db5d8}input,button{padding:12px;border-radius:10px;border:1px solid #3d5578;background:#0c182a;color:white;font:inherit}button{background:#2563eb;border:0;cursor:pointer;font-weight:700}.row{display:flex;gap:9px;align-items:center;flex-wrap:wrap}.row input{flex:1;min-width:180px}.nav{display:flex;gap:14px;flex-wrap:wrap}.warning{color:#fcd34d}.error{color:#fca5a5}.small{font-size:12px}@media(max-width:780px){.grid{grid-template-columns:repeat(2,minmax(0,1fr))}.tile strong{font-size:21px}h1{font-size:21px}}@media(max-width:390px){.grid{gap:8px}.tile{padding:12px}} </style></head><body><main>${content}</main></body></html>`;
}
router.get("/dashboard", async (req,res) => {
 res.set("Cache-Control", "no-store");
 if (!authorized(req)) return res.send(page("Вхід", `<header><h1>🚜 My Farm Clicker · Admin</h1></header><section class="panel" style="max-width:440px"><h2>Вхід адміністратора</h2><form method="post" action="/admin/dashboard/login"><div class="row"><input type="password" name="secret" placeholder="ADMIN_SECRET" required autocomplete="current-password"><button>Увійти</button></div></form><p class="muted">Секрет має бути встановлений у Render → API → Environment.</p></section>`));
 try {
  const now = new Date(); const d1 = new Date(now.getTime()-86400000); const d7 = new Date(now.getTime()-7*86400000);
  const q = String(req.query.q || "").trim().slice(0,80);
  const numericId = /^\d{1,18}$/.test(q) ? BigInt(q) : null;
  const requestedPage = Number(req.query.page || 1);
  const playerPage = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? Math.min(requestedPage, 100000) : 1;
  const pageSize = 30;
  const where = q ? { OR: [...(numericId ? [{ telegramId: numericId }] : []), { nickname: { contains: q, mode: "insensitive" as const } }] } : {};
  const [users, new7, active24, active7, balances, storage, animals, pending, pendingSum, paid, deposits, purchases, matchedUsers, recentUsers, withdrawals, recentDeposits, recentPurchases] = await Promise.all([
    prisma.user.count(), prisma.user.count({where:{createdAt:{gte:d7}}}), prisma.user.count({where:{lastSeenAt:{gte:d1}}}), prisma.user.count({where:{lastSeenAt:{gte:d7}}}),
    prisma.user.aggregate({_sum:{coins:true,diamonds:true,points:true,tonBalance:true}}),
    prisma.storage.aggregate({_sum:{pendingPoints:true,eggs:true,wool:true,milk:true}}), prisma.animal.count(),
    prisma.withdrawalRequest.count({where:{status:"pending"}}), prisma.withdrawalRequest.aggregate({where:{status:"pending"},_sum:{pointsAmount:true,tonAmount:true}}),
    prisma.withdrawalRequest.aggregate({where:{status:"approved"},_sum:{tonAmount:true}}),
    prisma.tonDeposit.aggregate({_sum:{amount:true},_count:{_all:true}}),
    prisma.payment.aggregate({where:{status:"paid"},_count:{_all:true}}),
    prisma.user.count({where}),
    prisma.user.findMany({where,orderBy:[{createdAt:"desc"},{id:"desc"}],skip:(playerPage-1)*pageSize,take:pageSize,select:{telegramId:true,nickname:true,level:true,coins:true,points:true,diamonds:true,createdAt:true,lastSeenAt:true,_count:{select:{animals:true}}}}),
    prisma.withdrawalRequest.findMany({orderBy:{createdAt:"desc"},take:15,select:{id:true,status:true,pointsAmount:true,tonAmount:true,createdAt:true,user:{select:{telegramId:true,nickname:true}}}}),
    prisma.tonDeposit.findMany({orderBy:{createdAt:"desc"},take:10,select:{amount:true,createdAt:true,user:{select:{telegramId:true,nickname:true}}}}),
    prisma.payment.findMany({orderBy:{createdAt:"desc"},take:10,select:{id:true,amount:true,currency:true,status:true,productCode:true,createdAt:true,user:{select:{nickname:true,telegramId:true}}}})
  ]);
  const pages = Math.max(1, Math.ceil(matchedUsers / pageSize));
  const playerUrl = (pageNumber:number) => `/admin/dashboard?${q ? `q=${encodeURIComponent(q)}&` : ""}page=${pageNumber}#players`;
  const pagination = `<div class="row" style="justify-content:space-between;margin-top:14px"><span class="muted">Знайдено: ${fmt(matchedUsers)} · Сторінка ${playerPage} з ${pages}</span><div class="row">${playerPage>1 ? `<a href="${playerUrl(playerPage-1)}">← Назад</a>` : ""}${playerPage<pages ? `<a href="${playerUrl(playerPage+1)}">Далі →</a>` : ""}</div></div>`;
  const tile=(label:string,value:unknown,note="")=>`<div class="tile"><span>${esc(label)}</span><strong>${esc(value)}</strong><span>${esc(note)}</span></div>`;
  const userName=(u:{nickname:string|null,telegramId:bigint})=>esc(u.nickname||u.telegramId.toString());
  const nav=`<nav class="nav"><a href="#players">Гравці</a><a href="#economy">Економіка</a><a href="#withdrawals">Виведення</a><a href="#deposits">Поповнення</a><a href="#purchases">Stars</a></nav>`;
  const html=`<header><div><h1>🚜 My Farm Clicker · Admin V1</h1><div class="muted">Статистика на ${esc(date(now))}</div></div><form method="post" action="/admin/dashboard/logout"><button>Вийти</button></form></header>${nav}
  <div class="grid">${tile("Всього гравців",fmt(users))}${tile("Нові за 7 днів",fmt(new7))}${tile("Активні за 24 год",fmt(active24),"За lastSeenAt")}${tile("Активні за 7 днів",fmt(active7),"За lastSeenAt")}${tile("Тварин у грі",fmt(animals))}${tile("Заявки в очікуванні",fmt(pending))}${tile("Поповнень TON",fmt(deposits._count._all))}${tile("Успішних Stars-покупок",fmt(purchases._count._all))}</div>
  <section class="panel" id="economy"><h2>💰 Економіка</h2><div class="grid">${tile("Points на балансах",fmt(balances._sum.points||0))}${tile("Points на складах",fmt(storage._sum.pendingPoints||0))}${tile("Points у заявках",fmt(pendingSum._sum.pointsAmount||0))}${tile("Сума заявок (поле tonAmount)",fmt(pendingSum._sum.tonAmount||0))}${tile("Coins",fmt(balances._sum.coins||0))}${tile("Diamonds",fmt(balances._sum.diamonds||0))}${tile("TON поповнено",fmt(deposits._sum.amount||0))}${tile("Сума схвалених заявок",fmt(paid._sum.tonAmount||0))}</div><p class="muted warning">⚠️ Поле tonAmount у базі не доводить, що виплату GRAM виконано. «Схвалено» не означає «виплачено». Резерв гаманця та реальний борг не розраховуються без перевіреного курсу й історії транзакцій.</p></section>
  <section class="panel" id="players"><h2>👥 Гравці</h2><form class="row" method="get" action="/admin/dashboard"><input name="q" placeholder="Нікнейм або точний Telegram ID" value="${esc(q)}"><button>Знайти</button><a href="/admin/dashboard">Очистити</a></form><div class="tablewrap"><table><thead><tr><th>Гравець</th><th>Telegram ID</th><th>Рівень</th><th>Coins</th><th>Points</th><th>Diamonds</th><th>Тварини</th><th>Остання активність</th></tr></thead><tbody>${recentUsers.map((u: any)=>`<tr><td>${userName(u)}</td><td>${esc(u.telegramId.toString())}</td><td>${u.level}</td><td>${fmt(u.coins)}</td><td>${fmt(u.points)}</td><td>${fmt(u.diamonds)}</td><td>${u._count.animals}</td><td>${date(u.lastSeenAt)}</td></tr>`).join("")||'<tr><td colspan="8">Немає результатів</td></tr>'}</tbody></table></div>${pagination}</section>
  <section class="panel" id="withdrawals"><h2>💸 Останні заявки</h2><div class="tablewrap"><table><tr><th>ID</th><th>Гравець</th><th>Points</th><th>tonAmount</th><th>Статус</th><th>Дата</th></tr>${withdrawals.map((w: any)=>`<tr><td>${w.id}</td><td>${userName(w.user)}</td><td>${fmt(w.pointsAmount)}</td><td>${fmt(w.tonAmount)}</td><td>${esc(w.status)}</td><td>${date(w.createdAt)}</td></tr>`).join("")}</table></div></section>
  <section class="panel" id="deposits"><h2>💎 Останні TON-поповнення</h2><div class="tablewrap"><table><tr><th>Гравець</th><th>TON</th><th>Дата</th></tr>${recentDeposits.map((d: any)=>`<tr><td>${userName(d.user)}</td><td>${fmt(d.amount)}</td><td>${date(d.createdAt)}</td></tr>`).join("")}</table></div></section>
  <section class="panel" id="purchases"><h2>⭐ Останні покупки Stars</h2><div class="tablewrap"><table><tr><th>ID</th><th>Гравець</th><th>Продукт</th><th>Сума</th><th>Валюта</th><th>Статус</th></tr>${recentPurchases.map((p: any)=>`<tr><td>${p.id}</td><td>${userName(p.user)}</td><td>${esc(p.productCode)}</td><td>${fmt(p.amount)}</td><td>${esc(p.currency)}</td><td>${esc(p.status)}</td></tr>`).join("")}</table></div></section><p class="muted">V1 · тільки перегляд · Дані з PostgreSQL</p>`;
  return res.send(page("Статистика",html));
 } catch(e) { console.error("ADMIN DASHBOARD:",e); return res.status(500).send(page("Помилка",`<section class="panel"><h2>Не вдалося завантажити статистику</h2><p>Перевір логи API на Render.</p></section>`)); }
});
router.post("/dashboard/login", (req,res)=>{
 const supplied = String(req.body?.secret || ""); const key = secret();
 if (!key || supplied.length !== key.length || !crypto.timingSafeEqual(Buffer.from(supplied),Buffer.from(key))) return res.status(401).send(page("Помилка входу",'<section class="panel"><h2>Невірний ключ</h2><a href="/admin/dashboard">Спробувати ще раз</a></section>'));
 const exp = String(Math.floor(Date.now()/1000)+TTL);
 res.cookie(COOKIE,`${exp}.${signature(exp)}`,{httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"strict",maxAge:TTL*1000,path:"/admin"});
 return res.redirect(303,"/admin/dashboard");
});
router.post("/dashboard/logout", (_req,res)=>{res.clearCookie(COOKIE,{path:"/admin"});res.redirect(303,"/admin/dashboard");});
export default router;
