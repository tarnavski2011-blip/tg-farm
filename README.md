# tg-farm (Telegram Mini App demo)

## 1) Install
In two terminals:

### API
```bash
cd api
npm i
npx prisma generate
npx prisma db push
npm run dev
```

### Web (Vite)
```bash
cd web
npm i
npm run dev
```

Open web at: http://localhost:5173

## 2) Ngrok (optional)
Expose **web** OR **api** (recommended: web) and keep Vite proxy to api locally.

Example:
```bash
ngrok http 5173
```

If you expose 5173 via ngrok and see "host not allowed", add your domain to `web/vite.config.js` -> `server.allowedHosts`.

## 3) Telegram
Set Mini App URL to your HTTPS ngrok URL (the Vite/web URL).
