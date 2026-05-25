import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { evaluateAndUpdateTier } from "../services/tierService";

// ── Webhook: ORDERS_FULFILLED ─────────────────────────────────────────────────
//
// Order is fully fulfilled — activate the pending points transaction
// and sync spendable balance + tier.

export const action = async ({ request }: ActionFunctionArgs) => {
  const { payload, shop, topic, admin } = await authenticate.webhook(request);

  console.log(`[webhook] ${topic} received for shop: ${shop}`);

  const order   = payload as any;
  const orderId = String(order.id);

  // ── Find the pending transaction for this order ───────────────────────────
  const pendingTx = await db.pointTransaction.findFirst({
    where:   { shop, orderId, status: "pending" },
    include: { customer: true },
  });

  if (!pendingTx) {
    console.log(`[orders-fulfilled] No pending transaction for order ${orderId}, skipping.`);
    return new Response(null, { status: 200 });
  }

  const { customer, points } = pendingTx;

  // ── Activate: mark transaction active + credit spendable balance ──────────
  await db.$transaction([
    db.pointTransaction.update({
      where: { id: pendingTx.id },
      data:  {
        status: "active",
        note:   `${pendingTx.note?.replace("pending fulfilment", "confirmed")}`,
      },
    }),
    db.loyaltyCustomer.update({
      where: { id: customer.id },
      data:  { points: { increment: points } },
    }),
  ]);

  console.log(
    `[orders-fulfilled] Activated ${points} pts for customer ${customer.shopifyCustomerId}`
  );

  // ── Re-evaluate tier now that lifetimePoints are confirmed ────────────────
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
};