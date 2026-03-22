import { Router } from "express";

const router = Router();

router.post("/", async (req, res) => {
  console.log("TELEGRAM ROUTER UPDATE:", req.body);
  res.sendStatus(200);
});

router.get("/", (_req, res) => {
  res.send("telegram webhook ok");
});

export default router;
