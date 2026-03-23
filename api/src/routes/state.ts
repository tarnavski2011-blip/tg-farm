import { Router } from "express";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const user = (req as any).telegramUser;

    if (!user?.id) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const telegramId = BigInt(user.id);

    return res.json({
      ok: true,
      telegramId: telegramId.toString(),
    });
  } catch (e) {
    console.error("STATE ERROR:", e);
    return res.status(500).json({ error: "Server error" });
  }
});

export default router;
