import { Router } from "express";

const router = Router();

router.use((req, _res, next) => {
  console.log("TELEGRAM HIT:", req.method, req.originalUrl);
  next();
});

router.post("/", (req, res) => {
  console.log("TELEGRAM BODY:", JSON.stringify(req.body));
  res.sendStatus(200);
});

router.get("/", (_req, res) => {
  res.send("telegram webhook ok 12345");
});

export default router;
