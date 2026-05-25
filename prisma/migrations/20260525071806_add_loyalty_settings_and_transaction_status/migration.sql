-- CreateTable
CREATE TABLE "LoyaltySettings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "pointsPerCurrency" REAL NOT NULL DEFAULT 10,
    "orderAmountType" TEXT NOT NULL DEFAULT 'subtotal',
    "bronzeMultiplier" REAL NOT NULL DEFAULT 1.0,
    "silverMultiplier" REAL NOT NULL DEFAULT 1.25,
    "goldMultiplier" REAL NOT NULL DEFAULT 1.5,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_PointTransaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "orderId" TEXT,
    "orderName" TEXT,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PointTransaction_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "LoyaltyCustomer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_PointTransaction" ("createdAt", "customerId", "id", "note", "orderId", "orderName", "points", "shop", "type") SELECT "createdAt", "customerId", "id", "note", "orderId", "orderName", "points", "shop", "type" FROM "PointTransaction";
DROP TABLE "PointTransaction";
ALTER TABLE "new_PointTransaction" RENAME TO "PointTransaction";
CREATE INDEX "PointTransaction_shop_customerId_idx" ON "PointTransaction"("shop", "customerId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "LoyaltySettings_shop_key" ON "LoyaltySettings"("shop");
