import { Router } from "express";

const router = Router();

router.use((req, _res, next) => {
  console.error("TELEGRAM HIT:", req.method, req.originalUrl);
  next();
});

router.post("/", (req, res) => {
  console.error("TELEGRAM BODY:", JSON.stringify(req.body));
  res.status(200).json({ ok: true, got: req.body ?? null });
});

router.get("/", (_req, res) => {
  res.send("telegram webhook ok 12345");
});

export default router;
