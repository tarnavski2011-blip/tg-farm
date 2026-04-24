import { Router } from "express";
import { prisma } from "../prisma";

const router = Router();

router.get("/", async (_req, res) => {
  try {
    const payments = await prisma.payment.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        user: {
          select: {
            id: true,
            telegramId: true,
            coins: true,
            diamonds: true,
            points: true,
          },
        },
      },
    });

    return res.json({
      ok: true,
      items: payments.map((p) => ({
        id: p.id,
        userId: p.userId,
        telegramId: p.user.telegramId.toString(),
        productCode: p.productCode,
        currency: p.currency,
        amount: p.amount,
        status: p.status,
        telegramPaymentChargeId: p.telegramPaymentChargeId,
        providerPaymentChargeId: p.providerPaymentChargeId,
        metadata: p.metadataJson ? JSON.parse(p.metadataJson) : null,
        createdAt: p.createdAt,
        paidAt: p.paidAt,
        user: {
          coins: p.user.coins,
          diamonds: p.user.diamonds,
          points: p.user.points,
        },
      })),
    });
  } catch (e) {
    console.error("PAYMENT LOGS ERROR:", e);
    return res.status(500).json({ error: "Server error" });
  }
});

export default router;
