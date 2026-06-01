import db from "../db.server";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface LoyaltySettingsData {
  pointsPerCurrency: number;
  orderAmountType:   "subtotal" | "total";
  bronzeMultiplier:  number;
  silverMultiplier:  number;
  goldMultiplier:    number;
  // Style
  accentColor:       string;
  bgColor:           string;
  textColor:         string;
  buttonColor:       string;
  buttonTextColor:   string;
  borderRadius:      number;
}

const DEFAULTS: LoyaltySettingsData = {
  pointsPerCurrency: 10,
  orderAmountType:   "subtotal",
  bronzeMultiplier:  1.0,
  silverMultiplier:  1.25,
  goldMultiplier:    1.5,
  accentColor:       "#d4a017",
  bgColor:           "#0d0d0d",
  textColor:         "#ffffff",
  buttonColor:       "#d4a017",
  buttonTextColor:   "#0d0d0d",
  borderRadius:      16,
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
      accentColor:       (row as any).accentColor     ?? DEFAULTS.accentColor,
      bgColor:           (row as any).bgColor         ?? DEFAULTS.bgColor,
      textColor:         (row as any).textColor       ?? DEFAULTS.textColor,
      buttonColor:       (row as any).buttonColor     ?? DEFAULTS.buttonColor,
      buttonTextColor:   (row as any).buttonTextColor ?? DEFAULTS.buttonTextColor,
      borderRadius:      (row as any).borderRadius    ?? DEFAULTS.borderRadius,
    };
  }
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

// ── Calculate points ──────────────────────────────────────────────────────────

export function calculatePoints(
  orderAmount: number,
  customerTier: string,
  settings: LoyaltySettingsData,
): number {
  const multiplier =
    customerTier === "gold"   ? settings.goldMultiplier :
    customerTier === "silver" ? settings.silverMultiplier :
                                settings.bronzeMultiplier;
  return Math.floor(orderAmount * settings.pointsPerCurrency * multiplier);
}