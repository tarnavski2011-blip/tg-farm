import { Router } from "express";
import { prisma } from "../prisma";
import type { TgAuthedRequest } from "../middleware/telegramAuth";
import { getLevelReward, getXpNeeded } from "../lib/levelSystem";

const router = Router();

router.get("/", async (req: TgAuthedRequest, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { telegramId: BigInt(req.telegramUser!.id) },
      select: { id: true, level: true, xp: true, rewardStartLevel: true, levelRewards: true },
    });
    if (!user) return res.status(404).json({ error: "User not found" });
    const saved = new Map(user.levelRewards.map(r => [r.level, r]));
    const levels = Array.from({ length: 100 }, (_, i) => {
      const level = i + 1;
      const row = saved.get(level);
      const standard = getLevelReward(level);
      return {
        level,
        coins: row?.coins ?? standard.rewardCoins,
        diamonds: row?.diamonds ?? standard.rewardDiamonds,
        unlocked: level <= user.level,
        claimed: level <= user.rewardStartLevel || !!row?.claimedAt,
        claimable: level > user.rewardStartLevel && level <= user.level && !!row && !row.claimedAt,
      };
    });
    return res.json({ ok: true, currentLevel: user.level, xp: user.xp, xpNeeded: getXpNeeded(user.level), levels });
  } catch (e) {
    console.error("LEVELS LIST ERROR", e);
    return res.status(500).json({ error: "Server error" });
  }
});

router.post("/:level/claim", async (req: TgAuthedRequest, res) => {
  const level = Number(req.params.level);
  if (!Number.isInteger(level) || level < 2 || level > 100) {
    return res.status(400).json({ error: "Invalid level" });
  }
  try {
    const telegramId = BigInt(req.telegramUser!.id);
    const reward = await prisma.$transaction(async tx => {
      const user = await tx.user.findUnique({ where: { telegramId }, select: { id: true, level: true, rewardStartLevel: true } });
      if (!user || level > user.level || level <= user.rewardStartLevel) return null;
      // Conditional update is atomic: simultaneous clicks can never credit twice.
      const result = await tx.levelReward.updateMany({
        where: { userId: user.id, level, claimedAt: null },
        data: { claimedAt: new Date() },
      });
      if (result.count !== 1) return null;
      const entry = await tx.levelReward.findUnique({ where: { userId_level: { userId: user.id, level } } });
      if (!entry) throw new Error("Missing level reward");
      const updated = await tx.user.update({
        where: { id: user.id },
        data: { coins: { increment: entry.coins }, diamonds: { increment: entry.diamonds } },
        select: { coins: true, diamonds: true },
      });
      return { coins: entry.coins, diamonds: entry.diamonds, balance: updated };
    });
    if (!reward) return res.status(409).json({ error: "Reward not available or already claimed" });
    return res.json({ ok: true, reward });
  } catch (e) {
    console.error("LEVEL CLAIM ERROR", e);
    return res.status(500).json({ error: "Server error" });
  }
});
export default router;
