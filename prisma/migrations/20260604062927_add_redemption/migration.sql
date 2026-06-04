-- CreateTable
CREATE TABLE "RedemptionVoucher" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "discountAmount" REAL NOT NULL,
    "pointsUsed" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RedemptionVoucher_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "LoyaltyCustomer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
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
    "accentColor" TEXT NOT NULL DEFAULT '#d4a017',
    "bgColor" TEXT NOT NULL DEFAULT '#0d0d0d',
    "textColor" TEXT NOT NULL DEFAULT '#ffffff',
    "buttonColor" TEXT NOT NULL DEFAULT '#d4a017',
    "buttonTextColor" TEXT NOT NULL DEFAULT '#0d0d0d',
    "borderRadius" INTEGER NOT NULL DEFAULT 16,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_LoyaltySettings" ("accentColor", "bgColor", "borderRadius", "bronzeMultiplier", "buttonColor", "buttonTextColor", "createdAt", "goldMultiplier", "id", "orderAmountType", "pointsPerCurrency", "shop", "silverMultiplier", "textColor", "updatedAt") SELECT "accentColor", "bgColor", "borderRadius", "bronzeMultiplier", "buttonColor", "buttonTextColor", "createdAt", "goldMultiplier", "id", "orderAmountType", "pointsPerCurrency", "shop", "silverMultiplier", "textColor", "updatedAt" FROM "LoyaltySettings";
DROP TABLE "LoyaltySettings";
ALTER TABLE "new_LoyaltySettings" RENAME TO "LoyaltySettings";
CREATE UNIQUE INDEX "LoyaltySettings_shop_key" ON "LoyaltySettings"("shop");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "RedemptionVoucher_shop_customerId_idx" ON "RedemptionVoucher"("shop", "customerId");

-- CreateIndex
CREATE INDEX "RedemptionVoucher_code_idx" ON "RedemptionVoucher"("code");
