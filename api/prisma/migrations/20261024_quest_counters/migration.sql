CREATE TABLE IF NOT EXISTS "QuestCounter" ("id" SERIAL PRIMARY KEY,"userId" INTEGER NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,"period" TEXT NOT NULL,"metric" TEXT NOT NULL,"value" INTEGER NOT NULL DEFAULT 0);
CREATE UNIQUE INDEX IF NOT EXISTS "QuestCounter_userId_period_metric_key" ON "QuestCounter"("userId","period","metric");
CREATE INDEX IF NOT EXISTS "QuestCounter_userId_period_idx" ON "QuestCounter"("userId","period");
CREATE TABLE IF NOT EXISTS "QuestPeriodClaim" ("id" SERIAL PRIMARY KEY,"userId" INTEGER NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,"period" TEXT NOT NULL,"code" TEXT NOT NULL,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE UNIQUE INDEX IF NOT EXISTS "QuestPeriodClaim_userId_period_code_key" ON "QuestPeriodClaim"("userId","period","code");
CREATE INDEX IF NOT EXISTS "QuestPeriodClaim_userId_period_idx" ON "QuestPeriodClaim"("userId","period");
