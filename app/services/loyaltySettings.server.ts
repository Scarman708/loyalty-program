import db from "../db.server";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface LoyaltySettingsData {
  pointsPerCurrency: number;   // e.g. 10 = 10 pts per $1
  orderAmountType:   "subtotal" | "total";
  bronzeMultiplier:  number;   // 1.0
  silverMultiplier:  number;   // 1.25
  goldMultiplier:    number;   // 1.5
}

const DEFAULTS: LoyaltySettingsData = {
  pointsPerCurrency: 10,
  orderAmountType:   "subtotal",
  bronzeMultiplier:  1.0,
  silverMultiplier:  1.25,
  goldMultiplier:    1.5,
};

// ── Read ──────────────────────────────────────────────────────────────────────

export async function getLoyaltySettings(shop: string): Promise<LoyaltySettingsData> {
  const row = await db.loyaltySettings.findUnique({ where: { shop } });
  if (row) {
    return {
      pointsPerCurrency: row.pointsPerCurrency,
      orderAmountType:   row.orderAmountType as "subtotal" | "total",
      bronzeMultiplier:  row.bronzeMultiplier,
      silverMultiplier:  row.silverMultiplier,
      goldMultiplier:    row.goldMultiplier,
    };
  }
  // Auto-create with defaults
  await db.loyaltySettings.create({ data: { shop, ...DEFAULTS } });
  return DEFAULTS;
}

// ── Write ─────────────────────────────────────────────────────────────────────

export async function saveLoyaltySettings(
  shop: string,
  data: LoyaltySettingsData,
): Promise<void> {
  await db.loyaltySettings.upsert({
    where:  { shop },
    create: { shop, ...data },
    update: data,
  });
}

// ── Calculate points for an order ─────────────────────────────────────────────

export function calculatePoints(
  orderAmount: number,         // in store currency (dollars, etc.)
  customerTier: string,
  settings: LoyaltySettingsData,
): number {
  const multiplier =
    customerTier === "gold"   ? settings.goldMultiplier :
    customerTier === "silver" ? settings.silverMultiplier :
                                settings.bronzeMultiplier;

  const raw = orderAmount * settings.pointsPerCurrency * multiplier;
  return Math.floor(raw); // always whole points, round down
}