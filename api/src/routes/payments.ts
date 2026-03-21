import { Router } from "express";
import { prisma } from "../prisma";
import type { TgAuthedRequest } from "../middleware/telegramAuth";
import { PREMIUM_PRODUCTS, getPremiumProduct } from "../config/premiumProducts";
import { createStarsInvoiceLink } from "../services/telegramStars";

const router = Router();

router.get("/products", async (_req, res) => {
  return res.json({
    items: Object.values(PREMIUM_PRODUCTS).map((p) => ({
      code: p.code,
      title: p.title,
      description: p.description,
      starsAmount: p.starsAmount,
    })),
  });
});

router.post("/create-invoice", async (req: TgAuthedRequest, res) => {
  if (!req.tgUserId) return res.status(401).json({ error: "Unauthorized" });

  const productCode = String(req.body?.productCode ?? "").trim();
  const product = getPremiumProduct(productCode);
  if (!product) return res.status(400).json({ error: "Unknown product" });

  const telegramId = BigInt(req.tgUserId);
  const user = await prisma.user.findUnique({
    where: { telegramId },
    select: { id: true },
  });
  if (!user) return res.status(404).json({ error: "User not found" });

  const created = await prisma.payment.create({
    data: {
      userId: user.id,
      productCode: product.code,
      payload: `stars:${user.id}:0`,
      currency: "XTR",
      amount: product.starsAmount,
      metadataJson: JSON.stringify({
        title: product.title,
        description: product.description,
      }),
    },
  });

  const payload = `stars:${user.id}:${created.id}`;

  await prisma.payment.update({
    where: { id: created.id },
    data: { payload },
  });

  try {
    const invoiceLink = await createStarsInvoiceLink({
      title: product.title,
      description: product.description,
      payload,
      starsAmount: product.starsAmount,
    });

    return res.json({
      ok: true,
      invoiceLink,
      paymentId: created.id,
      product: {
        code: product.code,
        title: product.title,
        starsAmount: product.starsAmount,
      },
    });
  } catch (error: any) {
    await prisma.payment.update({
      where: { id: created.id },
      data: { status: "failed" },
    });

    return res.status(500).json({
      error: error?.message || "Failed to create invoice",
    });
  }
});

export default router;
