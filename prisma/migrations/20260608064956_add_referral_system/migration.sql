/*
  Warnings:

  - You are about to drop the column `referralBonusReferee` on the `LoyaltySettings` table. All the data in the column will be lost.
  - You are about to drop the column `referralBonusReferrer` on the `LoyaltySettings` table. All the data in the column will be lost.
  - You are about to drop the column `firstPurchaseOrderId` on the `ReferralRelationship` table. All the data in the column will be lost.
  - You are about to drop the column `refereePointsAwarded` on the `ReferralRelationship` table. All the data in the column will be lost.
  - You are about to drop the column `referrerPointsAwarded` on the `ReferralRelationship` table. All the data in the column will be lost.

*/
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
    "referralSignupBonus" INTEGER NOT NULL DEFAULT 100,
    "referralReferrerPct" REAL NOT NULL DEFAULT 10,
    "referralRefereePct" REAL NOT NULL DEFAULT 10,
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
CREATE TABLE "new_ReferralRelationship" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "referrerId" TEXT NOT NULL,
    "refereeId" TEXT NOT NULL,
    "referralCode" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "signupBonusPaid" BOOLEAN NOT NULL DEFAULT false,
    "orderBonusPaid" BOOLEAN NOT NULL DEFAULT false,
    "referrerBonusPts" INTEGER,
    "refereeBonusPts" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ReferralRelationship_referrerId_fkey" FOREIGN KEY ("referrerId") REFERENCES "LoyaltyCustomer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ReferralRelationship_refereeId_fkey" FOREIGN KEY ("refereeId") REFERENCES "LoyaltyCustomer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_ReferralRelationship" ("createdAt", "id", "refereeId", "referralCode", "referrerId", "shop", "status", "updatedAt") SELECT "createdAt", "id", "refereeId", "referralCode", "referrerId", "shop", "status", "updatedAt" FROM "ReferralRelationship";
DROP TABLE "ReferralRelationship";
ALTER TABLE "new_ReferralRelationship" RENAME TO "ReferralRelationship";
CREATE UNIQUE INDEX "ReferralRelationship_refereeId_key" ON "ReferralRelationship"("refereeId");
CREATE INDEX "ReferralRelationship_shop_referrerId_idx" ON "ReferralRelationship"("shop", "referrerId");
CREATE INDEX "ReferralRelationship_referralCode_idx" ON "ReferralRelationship"("referralCode");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
