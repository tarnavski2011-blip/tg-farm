import { Router } from "express";
import { prisma } from "../prisma";
import type { TgAuthedRequest } from "../middleware/telegramAuth";
import { createStarsInvoiceLink } from "../services/telegramStars";

const router = Router();

const PACKAGES = {
  small: {
    code: "small",
    title: "Малий пакет",
    description: "50 діамантів",
    starsAmount: 20,
    diamonds: 50,
  },
  medium: {
    code: "medium",
    title: "Середній пакет",
    description: "120 діамантів",
    starsAmount: 50,
    diamonds: 120,
  },
  large: {
    code: "large",
    title: "Великий пакет",
    description: "300 діамантів",
    starsAmount: 100,
    diamonds: 300,
  },
} as const;

router.get("/", (_req, res) => {
  return res.json({
    items: Object.values(PACKAGES),
  });
});

router.post("/buy", async (req: TgAuthedRequest, res) => {
  try {
    if (!req.telegramUser?.id) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const code = String(req.body?.code ?? "").trim();

    if (!(code in PACKAGES)) {
      return res.status(400).json({ error: "Invalid package" });
    }

    const pack = PACKAGES[code as keyof typeof PACKAGES];
    const telegramId = BigInt(req.telegramUser.id);

    const user = await prisma.user.findUnique({
      where: { telegramId },
      select: { id: true },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const created = await prisma.payment.create({
      data: {
        userId: user.id,
        productCode: pack.code,
        payload: `stars:${user.id}:0`,
        currency: "XTR",
        amount: pack.diamonds,
        status: "pending",
        metadataJson: JSON.stringify({
          title: pack.title,
          description: pack.description,
          starsAmount: pack.starsAmount,
          diamonds: pack.diamonds,
        }),
      },
    });

    const payload = `stars:${user.id}:${created.id}`;

    await prisma.payment.update({
      where: { id: created.id },
      data: { payload },
    });

    const invoiceLink = await createStarsInvoiceLink({
      title: pack.title,
      description: pack.description,
      payload,
      starsAmount: pack.starsAmount,
    });

    return res.json({
      ok: true,
      invoiceLink,
    });
  } catch (e: any) {
    console.error("SHOP STARS ERROR:", e);
    return res.status(500).json({ error: "Server error" });
  }
});

export default router;
