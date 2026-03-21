-- CreateTable
CREATE TABLE "User" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "telegramId" BIGINT NOT NULL,
    "coins" INTEGER NOT NULL DEFAULT 0,
    "diamonds" INTEGER NOT NULL DEFAULT 0,
    "points" INTEGER NOT NULL DEFAULT 0,
    "level" INTEGER NOT NULL DEFAULT 1,
    "xp" INTEGER NOT NULL DEFAULT 0,
    "feedUntil" DATETIME,
    "feedActivatedAt" DATETIME,
    "lastTapAt" DATETIME DEFAULT CURRENT_TIMESTAMP,
    "boostUntil" DATETIME,
    "vipUntil" DATETIME,
    "autoCollectUntil" DATETIME,
    "lastDailyAt" DATETIME,
    "dailyStreak" INTEGER NOT NULL DEFAULT 0,
    "warehouseLevel" INTEGER NOT NULL DEFAULT 1,
    "labLevel" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "labMultiplier" INTEGER NOT NULL DEFAULT 1,
    "lastWheelSpinAt" DATETIME
);

-- CreateTable
CREATE TABLE "Storage" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "eggs" INTEGER NOT NULL DEFAULT 0,
    "wool" INTEGER NOT NULL DEFAULT 0,
    "milk" INTEGER NOT NULL DEFAULT 0,
    "capacity" INTEGER NOT NULL DEFAULT 1000,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Storage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Animal" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 1,
    "lastClaim" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Animal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AchievementClaim" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "claimed" BOOLEAN NOT NULL DEFAULT false,
    "claimedAt" DATETIME,
    CONSTRAINT "AchievementClaim_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Referral" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "referrerId" INTEGER NOT NULL,
    "invitedId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Referral_referrerId_fkey" FOREIGN KEY ("referrerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Referral_invitedId_fkey" FOREIGN KEY ("invitedId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DailyQuestClaim" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "claimDate" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DailyQuestClaim_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "productCode" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "telegramPaymentChargeId" TEXT,
    "providerPaymentChargeId" TEXT,
    "metadataJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidAt" DATETIME,
    CONSTRAINT "Payment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_telegramId_key" ON "User"("telegramId");

-- CreateIndex
CREATE UNIQUE INDEX "Storage_userId_key" ON "Storage"("userId");

-- CreateIndex
CREATE INDEX "Animal_userId_type_idx" ON "Animal"("userId", "type");

-- CreateIndex
CREATE INDEX "AchievementClaim_userId_idx" ON "AchievementClaim"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "AchievementClaim_userId_code_key" ON "AchievementClaim"("userId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "Referral_invitedId_key" ON "Referral"("invitedId");

-- CreateIndex
CREATE INDEX "DailyQuestClaim_userId_claimDate_idx" ON "DailyQuestClaim"("userId", "claimDate");

-- CreateIndex
CREATE UNIQUE INDEX "DailyQuestClaim_userId_code_claimDate_key" ON "DailyQuestClaim"("userId", "code", "claimDate");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_payload_key" ON "Payment"("payload");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_telegramPaymentChargeId_key" ON "Payment"("telegramPaymentChargeId");

-- CreateIndex
CREATE INDEX "Payment_userId_status_idx" ON "Payment"("userId", "status");

-- CreateIndex
CREATE INDEX "Payment_productCode_idx" ON "Payment"("productCode");
