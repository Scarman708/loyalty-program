import type { LoaderFunctionArgs } from "react-router";
import { getCustomerBalance } from "../services/points.server";
import { getTierConfig } from "../services/tierService";
import db from "../db.server";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json",
};

export async function loader({ request }: LoaderFunctionArgs) {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const url = new URL(request.url);
  const shop = url.searchParams.get("shop");
  const customerId = url.searchParams.get("customerId");

  if (!shop || !customerId) {
    return new Response(
      JSON.stringify({ error: "shop and customerId are required" }),
      { status: 400, headers: corsHeaders }
    );
  }

  try {
    // Check enrollment
    const enrolled = await db.loyaltyCustomer.findUnique({
      where: {
        shop_shopifyCustomerId: {
          shop,
          shopifyCustomerId: String(customerId),
        },
      },
    });

    if (!enrolled) {
      return new Response(
        JSON.stringify({ enrolled: false }),
        { status: 200, headers: corsHeaders }
      );
    }

    // Get balance + transactions
    const balance = await getCustomerBalance(shop, String(customerId));

    // Get tier thresholds for progress bar
    const tierConfig = await getTierConfig(shop);

    // Build tier progress info
    const lifetimePoints = balance?.lifetimePoints ?? 0;
    const currentTier = balance?.tier ?? "bronze";

    const tierProgress = buildTierProgress(currentTier, lifetimePoints, tierConfig);

    // Build referral token (simple shop+customer hash for now)
    const referralCode = generateReferralCode(shop, String(customerId));

    return new Response(
      JSON.stringify({
        enrolled: true,
        customer: {
          firstName: balance?.firstName,
          lastName: balance?.lastName,
          email: balance?.email,
          points: balance?.points ?? 0,
          lifetimePoints,
          tier: currentTier,
        },
        tierProgress,
        transactions: balance?.transactions ?? [],
        referralCode,
      }),
      { status: 200, headers: corsHeaders }
    );
  } catch (err: any) {
    console.error("[api.loyalty-dashboard] Error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: corsHeaders }
    );
  }
}

function buildTierProgress(
  currentTier: string,
  lifetimePoints: number,
  tierConfig: { bronze: number; silver: number; gold: number }
) {
  const tiers = [
    { name: "bronze", min: tierConfig.bronze },
    { name: "silver", min: tierConfig.silver },
    { name: "gold", min: tierConfig.gold },
  ];

  const currentIndex = tiers.findIndex((t) => t.name === currentTier);
  const nextTier = tiers[currentIndex + 1] ?? null;

  if (!nextTier) {
    // Already at gold — max tier
    return {
      currentTier,
      nextTier: null,
      pointsToNext: 0,
      progressPercent: 100,
      currentMin: tierConfig.gold,
      nextMin: null,
    };
  }

  const currentMin = tiers[currentIndex].min;
  const nextMin = nextTier.min;
  const range = nextMin - currentMin;
  const earned = lifetimePoints - currentMin;
  const progressPercent = Math.min(100, Math.max(0, Math.floor((earned / range) * 100)));

  return {
    currentTier,
    nextTier: nextTier.name,
    pointsToNext: Math.max(0, nextMin - lifetimePoints),
    progressPercent,
    currentMin,
    nextMin,
  };
}

function generateReferralCode(shop: string, customerId: string): string {
  // Simple deterministic code — replace with a real referral system later
  const base = `${shop}-${customerId}`.replace(/[^a-z0-9]/gi, "").toUpperCase();
  return base.slice(0, 12);
}