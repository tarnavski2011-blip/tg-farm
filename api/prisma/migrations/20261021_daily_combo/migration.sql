CREATE TABLE IF NOT EXISTS "DailyCombo" (
  "day" TEXT PRIMARY KEY,
  "items" TEXT[] NOT NULL
);
CREATE TABLE IF NOT EXISTS "DailyComboAttempt" (
  "id" SERIAL PRIMARY KEY,
  "day" TEXT NOT NULL,
  "userId" INTEGER NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "attemptNo" INTEGER NOT NULL,
  "items" TEXT[] NOT NULL,
  "won" BOOLEAN NOT NULL DEFAULT FALSE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE("day", "userId", "attemptNo")
);
CREATE INDEX IF NOT EXISTS "DailyComboAttempt_day_won_idx" ON "DailyComboAttempt"("day", "won");
