import { Router } from "express";

const router = Router();

router.use((req, _res, next) => {
  console.error("TELEGRAM HIT:", req.method, req.originalUrl);
  next();
});

router.post("/", (req, res) => {
  process.stdout.write("TELEGRAM UPDATE:\n");
  process.stdout.write(JSON.stringify(req.body) + "\n");

  res.status(200).json({ ok: true });
});

router.get("/", (_req, res) => {
  res.send("telegram webhook ok 12345");
});

export default router;
