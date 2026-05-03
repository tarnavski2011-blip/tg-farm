import { Router } from "express";
import { prisma } from "../prisma";
import type { TgAuthedRequest } from "../middleware/telegramAuth";

const router = Router();

const POINTS_PER_TON = 100000;
const FEE_PERCENT = 5;
const MIN_POINTS = 100000;

router.post("/", async (req: TgAuthedRequest, res) => {
  try {
    const telegramId = BigInt(req.telegramUser!.id);
    const pointsAmount = Number(req.body?.pointsAmount);
    const tonAddress = String(req.body?.tonAddress ?? "").trim();

    if (!pointsAmount || pointsAmount < MIN_POINTS) {
      return res.status(400).json({
        ok: false,
        error: "Мінімальний вивід 100 000 Points",
      });
    }

    if (!tonAddress || tonAddress.length < 20) {
      return res.status(400).json({
        ok: false,
        error: "Введи правильну TON адресу",
      });
    }

    const user = await prisma.user.findUnique({
      where: {
        telegramId,
      },
      select: {
        id: true,
        points: true,
      },
    });

    if (!user) {
      return res.status(404).json({
        ok: false,
        error: "User not found",
      });
    }

    if ((user.points ?? 0) < pointsAmount) {
      return res.status(400).json({
        ok: false,
        error: "Не вистачає Points",
      });
    }

    const tonBeforeFee = pointsAmount / POINTS_PER_TON;
    const tonAmount = Number(
      (tonBeforeFee * (1 - FEE_PERCENT / 100)).toFixed(4),
    );

    const result = await prisma.$transaction(async (tx) => {
      const updatedUser = await tx.user.update({
        where: {
          id: user.id,
        },
        data: {
          points: {
            decrement: pointsAmount,
          },
        },
        select: {
          points: true,
        },
      });

      const withdrawal = await tx.withdrawalRequest.create({
        data: {
          userId: user.id,
          pointsAmount,
          tonAmount,
          tonAddress,
          status: "pending",
        },
      });

      return {
        updatedUser,
        withdrawal,
      };
    });

    return res.json({
      ok: true,
      message: "Заявку на вивід створено",
      pointsAmount,
      tonAmount,
      status: result.withdrawal.status,
      pointsLeft: result.updatedUser.points,
    });
  } catch (e) {
    console.error("WITHDRAW REQUEST ERROR:", e);

    return res.status(500).json({
      ok: false,
      error: "Server error",
    });
  }
});

export default router;
