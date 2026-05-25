import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { getOrCreateLoyaltyCustomer } from "../services/points.server";
import { getLoyaltySettings, calculatePoints } from "../services/loyaltySettings.server";

// ── Webhook: ORDERS_PAID ──────────────────────────────────────────────────────
//
// Fires when payment is captured. We award points immediately but mark them
// as "pending" — they become "active" on ORDERS_FULFILLED, or are voided
// on ORDERS_CANCELLED / refund.

export const action = async ({ request }: ActionFunctionArgs) => {
  const { payload, shop, topic } = await authenticate.webhook(request);

  console.log(`[webhook] ${topic} received for shop: ${shop}`);

  // ── Guard: only process paid orders with a customer ───────────────────────
  const order = payload as any;

  if (!order.customer?.id) {
    console.log("[orders-paid] No customer on order, skipping.");
    return new Response(null, { status: 200 });
  }

  const shopifyCustomerId = String(order.customer.id);
  const orderId           = String(order.id);
  const orderName         = order.name as string;         // e.g. "#1042"

  // ── Idempotency: skip if we already processed this order ─────────────────
  const existing = await db.pointTransaction.findFirst({
    where: { shop, orderId },
  });
  if (existing) {
    console.log(`[orders-paid] Already processed order ${orderName}, skipping.`);
    return new Response(null, { status: 200 });
  }

  // ── Get settings + customer ───────────────────────────────────────────────
  const settings = await getLoyaltySettings(shop);

  const customer = await getOrCreateLoyaltyCustomer(shop, shopifyCustomerId, {
    email:     order.customer.email     ?? undefined,
    firstName: order.customer.first_name ?? undefined,
    lastName:  order.customer.last_name  ?? undefined,
  });

  // ── Calculate order amount based on setting ───────────────────────────────
  const orderAmount =
    settings.orderAmountType === "total"
      ? parseFloat(order.total_price      ?? "0")   // inc. shipping + tax
      : parseFloat(order.subtotal_price   ?? "0");   // products only

  const points = calculatePoints(orderAmount, customer.tier, settings);

  if (points <= 0) {
    console.log(`[orders-paid] Order ${orderName} calculated 0 points, skipping.`);
    return new Response(null, { status: 200 });
  }

  // ── Award points as PENDING ───────────────────────────────────────────────
  // Points are visible to the customer but locked until order is fulfilled.
  // We increment lifetimePoints now (for tier calculation) but do NOT
  // increment spendable `points` until fulfilment confirms the order.
  await db.$transaction([
    db.loyaltyCustomer.update({
      where: { id: customer.id },
      data:  { lifetimePoints: { increment: points } },
    }),
    db.pointTransaction.create({
      data: {
        shop,
        customerId: customer.id,
        type:       "earn",
        points,
        status:     "pending",
        orderId,
        orderName,
        note: `Order ${orderName} — ${points} pts pending fulfilment`,
      },
    }),
  ]);

  console.log(
    `[orders-paid] Awarded ${points} pending pts to customer ${shopifyCustomerId} for order ${orderName}`
  );

  return new Response(null, { status: 200 });
};