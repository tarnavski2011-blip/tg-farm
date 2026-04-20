import { Router } from "express";
import { prisma } from "../prisma";
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

    const telegramId = BigInt(req.telegramUser.id);
    const packageCode = String(req.body?.packageCode ?? "").trim();

    if (!isStarPackageCode(packageCode)) {
      return res.status(400).json({ error: "Invalid packageCode" });
    }

    const user = await prisma.user.findUnique({
      where: { telegramId },
      select: {
        id: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const pack = STAR_PACKAGES[packageCode];

    const payment = await prisma.payment.create({
      data: {
        userId: user.id,
        productCode: packageCode,
        payload: stars_${user.id}_${Date.now()}_${packageCode},
        currency: "XTR",
        amount: pack.diamonds,
        status: "pending",
        metadataJson: JSON.stringify({
          packageCode,
          stars: pack.stars,
          diamonds: pack.diamonds,
        }),
      },
    });

    const payload = makeInvoicePayload(payment.id);

    return res.json({
      ok: true,
      packageCode,
      payload,
      invoiceDraft: {
        title: pack.title,
        description: pack.description,
        currency: "XTR",
        prices: [
          {
            label: pack.title,
            amount: pack.stars,
          },
        ],
      },
    });
  } catch (e) {
    console.error("SHOP STARS ERROR:", e);
    return res.status(500).json({ error: "Server error" });
  }
});

export default router;