import { Router } from "express";
import type { TgAuthedRequest } from "../middleware/telegramAuth";
import {
  STAR_PACKAGES,
  isStarPackageCode,
  makeInvoicePayload,
} from "../services/telegramStars";

const router = Router();

router.get("/", (_req, res) => {
  return res.json({
    ok: true,
    packages: STAR_PACKAGES,
  });
});

router.post("/buy", async (req: TgAuthedRequest, res) => {
  try {
    if (!req.telegramUser?.id) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const packageCode = String(req.body?.packageCode ?? "").trim();

    if (!isStarPackageCode(packageCode)) {
      return res.status(400).json({ error: "Invalid packageCode" });
    }

    const pack = STAR_PACKAGES[packageCode];
    const payload = makeInvoicePayload(req.telegramUser.id, packageCode);

    return res.json({
      ok: true,
      packageCode,
      payload,
      invoiceDraft: {
        title: pack.title,
        description: pack.description,
        currency: "XTR",
        prices: [{ label: pack.title, amount: pack.stars }],
      },
      note: "Створи справжній invoice через бота і передай йому цей payload.",
    });
  } catch (e) {
    console.error("SHOP STARS ERROR:", e);
    return res.status(500).json({ error: "Server error" });
  }
});

export default router;
