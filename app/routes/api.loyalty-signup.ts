import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { getOrCreateLoyaltyCustomer } from "../services/points.server";
import db from "../db.server";

export async function action({ request }: ActionFunctionArgs) {
  // Support both storefront (public) and admin calls
  const origin = request.headers.get("origin") || "";

  // CORS headers for Theme App Extension calls
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  };

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: corsHeaders,
    });
  }

  try {
    const body = await request.json();
    const { shop, customerId, email, firstName, lastName } = body;

    if (!shop || !customerId) {
      return new Response(
        JSON.stringify({ error: "shop and customerId are required" }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Check if already enrolled
    const existing = await db.loyaltyCustomer.findUnique({
      where: {
        shop_shopifyCustomerId: {
          shop,
          shopifyCustomerId: String(customerId),
        },
      },
    });

    if (existing) {
      return new Response(
        JSON.stringify({ success: true, alreadyEnrolled: true, customer: existing }),
        { status: 200, headers: corsHeaders }
      );
    }

    // Enroll the customer
    const customer = await getOrCreateLoyaltyCustomer(
      shop,
      String(customerId),
      { email, firstName, lastName }
    );

    return new Response(
      JSON.stringify({ success: true, alreadyEnrolled: false, customer }),
      { status: 201, headers: corsHeaders }
    );
  } catch (err: any) {
    console.error("[api.loyalty-signup] Error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function loader({ request }: ActionFunctionArgs) {
  // Handle preflight / GET check
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json",
  };
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: corsHeaders,
  });
}