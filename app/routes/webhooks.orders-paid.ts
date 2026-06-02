import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { getOrCreateLoyaltyCustomer } from "../services/points.server";
import { getLoyaltySettings, calculatePoints } from "../services/loyaltySettings.server";
import { evaluateAndUpdateTier } from "../services/tierService";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { payload, shop, topic, admin } = await authenticate.webhook(request);

  console.log(`[webhook] ${topic} received for shop: ${shop}`);

  const order = payload as any;

  if (!order.customer?.id) {
    console.log("[orders-paid] No customer on order, skipping.");
    return new Response(null, { status: 200 });
  }

  const shopifyCustomerId = String(order.customer.id);
  const orderId           = String(order.id);
  const orderName         = order.name as string;

  // ── Idempotency ───────────────────────────────────────────────────────────
  const existing = await db.pointTransaction.findFirst({ where: { shop, orderId } });
  if (existing) {
    console.log(`[orders-paid] Already processed order ${orderName}, skipping.`);
    return new Response(null, { status: 200 });
  }

  const settings = await getLoyaltySettings(shop);
  const customer = await getOrCreateLoyaltyCustomer(shop, shopifyCustomerId, {
    email:     order.customer.email      ?? undefined,
    firstName: order.customer.first_name ?? undefined,
    lastName:  order.customer.last_name  ?? undefined,
  });

  const orderAmount =
    settings.orderAmountType === "total"
      ? parseFloat(order.total_price    ?? "0")
      : parseFloat(order.subtotal_price ?? "0");

  const points = calculatePoints(orderAmount, customer.tier, settings);

  if (points <= 0) {
    console.log(`[orders-paid] Order ${orderName} calculated 0 points, skipping.`);
    return new Response(null, { status: 200 });
  }

  // ── COD check: is the order already fulfilled at payment time? ────────────
  const isCOD = order.fulfillment_status === "fulfilled";

  if (isCOD) {
    // Activate immediately — no pending state needed
    await db.$transaction([
      db.loyaltyCustomer.update({
        where: { id: customer.id },
        data: {
          lifetimePoints: { increment: points },
          points:         { increment: points },
        },
      }),
      db.pointTransaction.create({
        data: {
          shop,
          customerId: customer.id,
          type:       "earn",
          points,
          status:     "active",
          orderId,
          orderName,
          note: `Order ${orderName} — ${points} pts (COD, activated immediately)`,
        },
      }),
    ]);

    console.log(`[orders-paid] COD order ${orderName} — activated ${points} pts immediately for ${shopifyCustomerId}`);

    // Evaluate tier since lifetimePoints changed
    const refreshed = await db.loyaltyCustomer.findUnique({ where: { id: customer.id } });
    if (refreshed) {
      await evaluateAndUpdateTier(
        {
          id:                refreshed.id,
          shopifyCustomerId: refreshed.shopifyCustomerId,
          shop:              refreshed.shop,
          lifetimePoints:    refreshed.lifetimePoints,
          tier:              refreshed.tier,
        },
        admin,
      );
    }

    return new Response(null, { status: 200 });
  }

  // ── Normal flow: create pending transaction ───────────────────────────────
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

  console.log(`[orders-paid] Awarded ${points} pending pts to ${shopifyCustomerId} for order ${orderName}`);

  return new Response(null, { status: 200 });
};