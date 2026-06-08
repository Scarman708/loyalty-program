// app/services/referral.server.ts
// All referral logic in one place

import db from "../db.server";
import type { LoyaltySettingsData } from "./loyaltySettings.server";

// ── Generate referral code from shopifyCustomerId ─────────────────────────────
// Deterministic — same input always gives same code
export function generateReferralCode(shop: string, shopifyCustomerId: string): string {
  const base = `${shop}-${shopifyCustomerId}`.replace(/[^a-z0-9]/gi, "").toUpperCase();
  return base.slice(0, 12);
}

// ── Find customer by referral code ────────────────────────────────────────────
export async function findCustomerByReferralCode(
  shop: string,
  code: string,
): Promise<{ id: string; shopifyCustomerId: string } | null> {
  // Code is derived from shopifyCustomerId — scan customers and match
  const customers = await db.loyaltyCustomer.findMany({
    where: { shop },
    select: { id: true, shopifyCustomerId: true },
  });

  return customers.find((c) => generateReferralCode(shop, c.shopifyCustomerId) === code) ?? null;
}

// ── Award signup bonus to referee ─────────────────────────────────────────────
export async function awardSignupBonus(
  shop: string,
  referrerId: string,        // LoyaltyCustomer.id
  refereeId: string,         // LoyaltyCustomer.id
  referralCode: string,
  signupBonus: number,
): Promise<void> {
  if (signupBonus <= 0) return;

  await db.$transaction([
    // Award points to referee
    db.loyaltyCustomer.update({
      where: { id: refereeId },
      data: {
        points:        { increment: signupBonus },
        lifetimePoints: { increment: signupBonus },
      },
    }),
    // Record transaction for referee
    db.pointTransaction.create({
      data: {
        shop,
        customerId: refereeId,
        type:   "earn",
        points: signupBonus,
        status: "active",
        note:   `Referral signup bonus — ${signupBonus} pts`,
      },
    }),
    // Create referral relationship
    db.referralRelationship.create({
      data: {
        shop,
        referrerId,
        refereeId,
        referralCode,
        status:          "signup_bonus_paid",
        signupBonusPaid: true,
      },
    }),
  ]);

  console.log(`[referral] Signup bonus: ${signupBonus} pts → referee ${refereeId}`);
}

// ── Award order bonus to both parties ────────────────────────────────────────
// Called on referee's first completed order
export async function awardOrderBonus(
  shop: string,
  referral: {
    id: string;
    referrerId: string;
    refereeId: string;
  },
  baseOrderPoints: number,    // points earned from the order itself
  referrerPct: number,        // e.g. 10 = 10%
  refereePct: number,
): Promise<void> {
  const referrerBonus = Math.floor(baseOrderPoints * (referrerPct / 100));
  const refereeBonus  = Math.floor(baseOrderPoints * (refereePct  / 100));

  const ops: any[] = [
    // Mark referral complete
    db.referralRelationship.update({
      where: { id: referral.id },
      data: {
        status:          "completed",
        orderBonusPaid:  true,
        referrerBonusPts: referrerBonus,
        refereeBonusPts:  refereeBonus,
      },
    }),
  ];

  if (referrerBonus > 0) {
    ops.push(
      db.loyaltyCustomer.update({
        where: { id: referral.referrerId },
        data: { points: { increment: referrerBonus }, lifetimePoints: { increment: referrerBonus } },
      }),
      db.pointTransaction.create({
        data: {
          shop, customerId: referral.referrerId,
          type: "earn", points: referrerBonus, status: "active",
          note: `Referral bonus — your referee made their first purchase (+${referrerBonus} pts)`,
        },
      }),
    );
  }

  if (refereeBonus > 0) {
    ops.push(
      db.loyaltyCustomer.update({
        where: { id: referral.refereeId },
        data: { points: { increment: refereeBonus }, lifetimePoints: { increment: refereeBonus } },
      }),
      db.pointTransaction.create({
        data: {
          shop, customerId: referral.refereeId,
          type: "earn", points: refereeBonus, status: "active",
          note: `Referral bonus — first purchase bonus (+${refereeBonus} pts)`,
        },
      }),
    );
  }

  await db.$transaction(ops);

  console.log(`[referral] Order bonus: referrer +${referrerBonus} pts, referee +${refereeBonus} pts`);
}

// ── Check if this is the referee's first order ────────────────────────────────
export async function isFirstOrder(shop: string, customerId: string): Promise<boolean> {
  const count = await db.pointTransaction.count({
    where: {
      shop,
      customerId,
      type:   "earn",
      status: { in: ["active", "pending"] },
      orderId: { not: null },
    },
  });
  return count === 0;
}