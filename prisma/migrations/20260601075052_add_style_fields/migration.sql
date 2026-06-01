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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "accentColor" TEXT NOT NULL DEFAULT '#d4a017',
    "bgColor" TEXT NOT NULL DEFAULT '#0d0d0d',
    "textColor" TEXT NOT NULL DEFAULT '#ffffff',
    "buttonColor" TEXT NOT NULL DEFAULT '#d4a017',
    "buttonTextColor" TEXT NOT NULL DEFAULT '#0d0d0d',
    "borderRadius" INTEGER NOT NULL DEFAULT 16
);
INSERT INTO "new_LoyaltySettings" ("bronzeMultiplier", "createdAt", "goldMultiplier", "id", "orderAmountType", "pointsPerCurrency", "shop", "silverMultiplier", "updatedAt") SELECT "bronzeMultiplier", "createdAt", "goldMultiplier", "id", "orderAmountType", "pointsPerCurrency", "shop", "silverMultiplier", "updatedAt" FROM "LoyaltySettings";
DROP TABLE "LoyaltySettings";
ALTER TABLE "new_LoyaltySettings" RENAME TO "LoyaltySettings";
CREATE UNIQUE INDEX "LoyaltySettings_shop_key" ON "LoyaltySettings"("shop");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
