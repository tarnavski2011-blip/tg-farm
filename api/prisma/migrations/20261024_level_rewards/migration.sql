-- Existing levels already paid automatically: prevent retroactive duplicate claims.
ALTER TABLE "User" ADD COLUMN "rewardStartLevel" INTEGER NOT NULL DEFAULT 1;
UPDATE "User" SET "rewardStartLevel" = GREATEST(1, "level");
CREATE TABLE "LevelReward" (
 "id" SERIAL PRIMARY KEY,
 "userId" INTEGER NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
 "level" INTEGER NOT NULL,
 "coins" INTEGER NOT NULL DEFAULT 0,
 "diamonds" INTEGER NOT NULL DEFAULT 0,
 "claimedAt" TIMESTAMP(3),
 CONSTRAINT "LevelReward_userId_level_key" UNIQUE ("userId", "level")
);
CREATE INDEX "LevelReward_userId_claimedAt_idx" ON "LevelReward"("userId", "claimedAt");
