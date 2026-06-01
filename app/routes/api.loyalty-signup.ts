import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { getOrCreateLoyaltyCustomer } from "../services/points.server";
import db from "../db.server";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept",
  "Content-Type": "application/json",
};

export async function loader({ request }: LoaderFunctionArgs) {
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: corsHeaders });
}

export async function action({ request }: ActionFunctionArgs) {
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