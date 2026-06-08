-- CreateTable
CREATE TABLE "ReferralRelationship" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "referrerId" TEXT NOT NULL,
    "refereeId" TEXT NOT NULL,
    "referralCode" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "referrerPointsAwarded" INTEGER NOT NULL DEFAULT 0,
    "refereePointsAwarded" INTEGER NOT NULL DEFAULT 0,
    "firstPurchaseOrderId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ReferralRelationship_referrerId_fkey" FOREIGN KEY ("referrerId") REFERENCES "LoyaltyCustomer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ReferralRelationship_refereeId_fkey" FOREIGN KEY ("refereeId") REFERENCES "LoyaltyCustomer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_LoyaltySettings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "pointsPerCurrency" REAL NOT NULL DEFAULT 10,
    "orderAmountType" TEXT NOT NULL DEFAULT 'subtotal',
    "bronzeMultiplier" REAL NOT NULL DEFAULT 1.0,
    "silverMultiplier" REAL NOT NULL DEFAULT 1.25,
    "goldMultiplier" REAL NOT NULL DEFAULT 1.5,
    "bronzeRedemptionRate" REAL NOT NULL DEFAULT 100,
    "silverRedemptionRate" REAL NOT NULL DEFAULT 80,
    "goldRedemptionRate" REAL NOT NULL DEFAULT 60,
    "voucherPreset1" INTEGER NOT NULL DEFAULT 500,
    "voucherPreset2" INTEGER NOT NULL DEFAULT 1000,
    "voucherPreset3" INTEGER NOT NULL DEFAULT 2000,
    "referralBonusReferrer" INTEGER NOT NULL DEFAULT 200,
    "referralBonusReferee" INTEGER NOT NULL DEFAULT 200,
    "accentColor" TEXT NOT NULL DEFAULT '#d4a017',
    "bgColor" TEXT NOT NULL DEFAULT '#0d0d0d',
    "textColor" TEXT NOT NULL DEFAULT '#ffffff',
    "buttonColor" TEXT NOT NULL DEFAULT '#d4a017',
    "buttonTextColor" TEXT NOT NULL DEFAULT '#0d0d0d',
    "borderRadius" INTEGER NOT NULL DEFAULT 16,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_LoyaltySettings" ("accentColor", "bgColor", "borderRadius", "bronzeMultiplier", "bronzeRedemptionRate", "buttonColor", "buttonTextColor", "createdAt", "goldMultiplier", "goldRedemptionRate", "id", "orderAmountType", "pointsPerCurrency", "shop", "silverMultiplier", "silverRedemptionRate", "textColor", "updatedAt", "voucherPreset1", "voucherPreset2", "voucherPreset3") SELECT "accentColor", "bgColor", "borderRadius", "bronzeMultiplier", "bronzeRedemptionRate", "buttonColor", "buttonTextColor", "createdAt", "goldMultiplier", "goldRedemptionRate", "id", "orderAmountType", "pointsPerCurrency", "shop", "silverMultiplier", "silverRedemptionRate", "textColor", "updatedAt", "voucherPreset1", "voucherPreset2", "voucherPreset3" FROM "LoyaltySettings";
DROP TABLE "LoyaltySettings";
ALTER TABLE "new_LoyaltySettings" RENAME TO "LoyaltySettings";
CREATE UNIQUE INDEX "LoyaltySettings_shop_key" ON "LoyaltySettings"("shop");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "ReferralRelationship_refereeId_key" ON "ReferralRelationship"("refereeId");

-- CreateIndex
CREATE INDEX "ReferralRelationship_shop_referrerId_idx" ON "ReferralRelationship"("shop", "referrerId");

-- CreateIndex
CREATE INDEX "ReferralRelationship_referralCode_idx" ON "ReferralRelationship"("referralCode");

-- CreateIndex
CREATE UNIQUE INDEX "ReferralRelationship_shop_refereeId_key" ON "ReferralRelationship"("shop", "refereeId");
