import { useLoaderData, useFetcher } from "react-router";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { useRef } from "react";
import { authenticate } from "../shopify.server";
import { getLoyaltySettings, saveLoyaltySettings } from "../services/loyaltySettings.server";

declare global {
  namespace JSX {
    interface IntrinsicElements {
      [elemName: string]: any;
    }
  }
}

// ── Loader ────────────────────────────────────────────────────────────────────

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const settings = await getLoyaltySettings(session.shop);
  return { settings };
};

// ── Action ────────────────────────────────────────────────────────────────────

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  const contentType = request.headers.get("content-type") ?? "";
  let raw: Record<string, any>;

  if (contentType.includes("application/json")) {
    raw = await request.json();
  } else {
    const fd = await request.formData();
    raw = Object.fromEntries(fd.entries());
  }

  const pointsPerCurrency = Number(raw.pointsPerCurrency);
  const orderAmountType   = raw.orderAmountType as "subtotal" | "total";
  const bronzeMultiplier  = Number(raw.bronzeMultiplier);
  const silverMultiplier  = Number(raw.silverMultiplier);
  const goldMultiplier    = Number(raw.goldMultiplier);

  const errors: string[] = [];
  if (isNaN(pointsPerCurrency) || pointsPerCurrency <= 0)
    errors.push("Points per currency unit must be a positive number.");
  if (!["subtotal", "total"].includes(orderAmountType))
    errors.push("Order amount type must be subtotal or total.");
  if (bronzeMultiplier <= 0) errors.push("Bronze multiplier must be positive.");
  if (silverMultiplier <= bronzeMultiplier)
    errors.push("Silver multiplier must be greater than Bronze.");
  if (goldMultiplier <= silverMultiplier)
    errors.push("Gold multiplier must be greater than Silver.");

  if (errors.length > 0) return { ok: false, errors };

  await saveLoyaltySettings(session.shop, {
    pointsPerCurrency,
    orderAmountType,
    bronzeMultiplier,
    silverMultiplier,
    goldMultiplier,
  });

  return { ok: true, errors: [] };
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { settings } = useLoaderData<typeof loader>();
  const fetcher      = useFetcher<typeof action>();
  const isSaving     = fetcher.state !== "idle";
  const result       = fetcher.data;

  // Refs for all inputs — same pattern as app.tiers.tsx
  const ppcRef     = useRef<HTMLInputElement>(null);
  const oatRef     = useRef<HTMLSelectElement>(null);
  const bronzeRef  = useRef<HTMLInputElement>(null);
  const silverRef  = useRef<HTMLInputElement>(null);
  const goldRef    = useRef<HTMLInputElement>(null);

  const handleSave = () => {
    fetcher.submit(
      {
        pointsPerCurrency: Number(ppcRef.current?.value    ?? settings.pointsPerCurrency),
        orderAmountType:          oatRef.current?.value    ?? settings.orderAmountType,
        bronzeMultiplier:  Number(bronzeRef.current?.value ?? settings.bronzeMultiplier),
        silverMultiplier:  Number(silverRef.current?.value ?? settings.silverMultiplier),
        goldMultiplier:    Number(goldRef.current?.value   ?? settings.goldMultiplier),
      },
      { method: "POST", encType: "application/json" },
    );
  };

  return (
    <s-page heading="Loyalty Settings">

      {/* ── Earning rules ── */}
      <s-section heading="Earning rules">
        <s-card>
          {/* Banners */}
          {result?.ok === true && (
            <div style={{
              background: "#EAF3DE", border: "1px solid #97C459",
              borderRadius: "8px", padding: "12px 16px",
              marginBottom: "20px", color: "#3B6D11", fontSize: "14px",
            }}>
              ✓ Settings saved successfully.
            </div>
          )}
          {result?.errors && result.errors.length > 0 && (
            <div style={{
              background: "#FCEBEB", border: "1px solid #F09595",
              borderRadius: "8px", padding: "12px 16px",
              marginBottom: "20px", color: "#A32D2D", fontSize: "14px",
            }}>
              {result.errors.map((e: string) => <div key={e}>⚠ {e}</div>)}
            </div>
          )}

          <s-stack direction="block" gap="large-400">

            {/* Points per currency unit */}
            <div>
              <div style={{ fontWeight: 600, marginBottom: "6px" }}>
                Points per currency unit
              </div>
              <div style={{ fontSize: "13px", color: "#666", marginBottom: "10px" }}>
                How many points a customer earns for every 1 unit of store currency spent
                (e.g. 10 = 10 pts per $1).
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <input
                  ref={ppcRef}
                  type="number"
                  defaultValue={settings.pointsPerCurrency}
                  min={0.1}
                  step={0.1}
                  style={{
                    width: "120px", padding: "8px 12px",
                    border: "1px solid #ccc", borderRadius: "6px", fontSize: "14px",
                  }}
                />
                <span style={{ fontSize: "13px", color: "#888" }}>pts per 1 currency unit</span>
              </div>
            </div>

            {/* Order amount type */}
            <div>
              <div style={{ fontWeight: 600, marginBottom: "6px" }}>
                Base order amount on
              </div>
              <div style={{ fontSize: "13px", color: "#666", marginBottom: "10px" }}>
                Whether points are calculated on the subtotal (products only) or the
                total (including shipping and tax).
              </div>
              <select
                ref={oatRef}
                defaultValue={settings.orderAmountType}
                style={{
                  padding: "8px 12px", border: "1px solid #ccc",
                  borderRadius: "6px", fontSize: "14px",
                  background: "#fff", cursor: "pointer",
                }}
              >
                <option value="subtotal">Subtotal (products only)</option>
                <option value="total">Total (including shipping &amp; tax)</option>
              </select>
            </div>

          </s-stack>
        </s-card>
      </s-section>

      {/* ── Tier multipliers ── */}
      <s-section heading="Tier multipliers">
        <s-card>
          <s-stack direction="block" gap="large-400">
            <s-text>
              Multipliers are applied on top of the base earn rate. A 1.5× multiplier
              means Gold members earn 50% more points than Bronze on the same order.
            </s-text>

            {/* Preview formula */}
            <div style={{
              background: "#F6F6F7", borderRadius: "8px",
              padding: "12px 16px", fontSize: "13px", color: "#444",
            }}>
              <strong>Formula:</strong>{" "}
              <code>floor(orderAmount × pointsPerCurrency × tierMultiplier)</code>
              <br />
              <span style={{ color: "#888" }}>
                Example: $50 order · 10 pts/$1 · Gold 1.5× = <strong>750 pts</strong>
              </span>
            </div>

            {/* Bronze */}
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                <span style={{ fontSize: "18px" }}>🥉</span>
                <strong style={{ color: "#D85A30" }}>Bronze multiplier</strong>
                <span style={{ fontSize: "12px", color: "#888" }}>(base rate, usually 1×)</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <input
                  ref={bronzeRef}
                  type="number"
                  defaultValue={settings.bronzeMultiplier}
                  min={0.1}
                  step={0.05}
                  style={{
                    width: "100px", padding: "8px 12px",
                    border: "1px solid #ccc", borderRadius: "6px", fontSize: "14px",
                  }}
                />
                <span style={{ fontSize: "13px", color: "#888" }}>×</span>
              </div>
            </div>

            {/* Silver */}
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                <span style={{ fontSize: "18px" }}>🥈</span>
                <strong style={{ color: "#5F5E5A" }}>Silver multiplier</strong>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <input
                  ref={silverRef}
                  type="number"
                  defaultValue={settings.silverMultiplier}
                  min={0.1}
                  step={0.05}
                  style={{
                    width: "100px", padding: "8px 12px",
                    border: "1px solid #ccc", borderRadius: "6px", fontSize: "14px",
                  }}
                />
                <span style={{ fontSize: "13px", color: "#888" }}>×</span>
              </div>
            </div>

            {/* Gold */}
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                <span style={{ fontSize: "18px" }}>🥇</span>
                <strong style={{ color: "#BA7517" }}>Gold multiplier</strong>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <input
                  ref={goldRef}
                  type="number"
                  defaultValue={settings.goldMultiplier}
                  min={0.1}
                  step={0.05}
                  style={{
                    width: "100px", padding: "8px 12px",
                    border: "1px solid #ccc", borderRadius: "6px", fontSize: "14px",
                  }}
                />
                <span style={{ fontSize: "13px", color: "#888" }}>×</span>
              </div>
            </div>

            <div>
              <s-button
                variant="primary"
                onClick={handleSave}
                {...(isSaving ? { loading: true } : {})}
              >
                {isSaving ? "Saving…" : "Save settings"}
              </s-button>
            </div>

          </s-stack>
        </s-card>
      </s-section>

      {/* ── Points lifecycle ── */}
      <s-section heading="Points lifecycle">
        <s-card>
          <s-stack direction="block" gap="large-300">
            {[
              { icon: "🛒", label: "Order paid",      desc: "Points awarded immediately as Pending — visible but not spendable." },
              { icon: "📦", label: "Order fulfilled",  desc: "Pending points become Active — customer can now spend them." },
              { icon: "❌", label: "Order cancelled",  desc: "Pending points are voided; Active points are deducted from balance." },
            ].map(({ icon, label, desc }) => (
              <div
                key={label}
                style={{
                  display: "flex", gap: "12px", alignItems: "flex-start",
                  padding: "10px 0",
                  borderBottom: "0.5px solid #eee",
                }}
              >
                <span style={{ fontSize: "20px", flexShrink: 0 }}>{icon}</span>
                <div>
                  <div style={{ fontWeight: 600, fontSize: "14px" }}>{label}</div>
                  <div style={{ fontSize: "13px", color: "#666", marginTop: "2px" }}>{desc}</div>
                </div>
              </div>
            ))}
          </s-stack>
        </s-card>
      </s-section>

    </s-page>
  );
}