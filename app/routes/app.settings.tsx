import { useLoaderData, useFetcher } from "react-router";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { useRef, useState } from "react";
import { authenticate } from "../shopify.server";
import { getLoyaltySettings, saveLoyaltySettings } from "../services/loyaltySettings.server";

declare global {
  namespace JSX {
    interface IntrinsicElements { [elemName: string]: any; }
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

  const tab = raw.tab as string;

  // ── Style save ──
  if (tab === "style") {
    const current = await getLoyaltySettings(session.shop);
    await saveLoyaltySettings(session.shop, {
      ...current,
      accentColor:     String(raw.accentColor     ?? current.accentColor),
      bgColor:         String(raw.bgColor         ?? current.bgColor),
      textColor:       String(raw.textColor       ?? current.textColor),
      buttonColor:     String(raw.buttonColor     ?? current.buttonColor),
      buttonTextColor: String(raw.buttonTextColor ?? current.buttonTextColor),
      borderRadius:    Number(raw.borderRadius    ?? current.borderRadius),
    });
    return { ok: true, errors: [], tab: "style" };
  }

  // ── Earning / multipliers save ──
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

  if (errors.length > 0) return { ok: false, errors, tab: "earning" };

  const current = await getLoyaltySettings(session.shop);
  await saveLoyaltySettings(session.shop, {
    ...current,
    pointsPerCurrency,
    orderAmountType,
    bronzeMultiplier,
    silverMultiplier,
    goldMultiplier,
  });

  return { ok: true, errors: [], tab: "earning" };
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  padding: "8px 12px", border: "1px solid #ccc",
  borderRadius: "6px", fontSize: "14px",
};

const colorRowStyle: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: "12px", marginBottom: "4px",
};

function ColorField({
  label, desc, value, onChange,
}: {
  label: string; desc: string; value: string; onChange: (v: string) => void;
}) {
  return (
    <div style={{ marginBottom: "20px" }}>
      <div style={{ fontWeight: 600, marginBottom: "4px" }}>{label}</div>
      <div style={{ fontSize: "13px", color: "#666", marginBottom: "8px" }}>{desc}</div>
      <div style={colorRowStyle}>
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{ width: "44px", height: "36px", padding: "2px", border: "1px solid #ccc", borderRadius: "6px", cursor: "pointer" }}
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{ ...inputStyle, width: "110px", fontFamily: "monospace" }}
        />
        <div style={{
          width: "36px", height: "36px", borderRadius: "6px",
          background: value, border: "1px solid #ddd", flexShrink: 0,
        }} />
      </div>
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { settings } = useLoaderData<typeof loader>();
  const fetcher      = useFetcher<typeof action>();
  const isSaving     = fetcher.state !== "idle";
  const result       = fetcher.data;

  const [activeTab, setActiveTab] = useState<"earning" | "style">("earning");

  // Earning refs
  const ppcRef    = useRef<HTMLInputElement>(null);
  const oatRef    = useRef<HTMLSelectElement>(null);
  const bronzeRef = useRef<HTMLInputElement>(null);
  const silverRef = useRef<HTMLInputElement>(null);
  const goldRef   = useRef<HTMLInputElement>(null);

  // Style state (controlled — needed for live preview)
  const [accentColor,     setAccentColor]     = useState(settings.accentColor     ?? "#d4a017");
  const [bgColor,         setBgColor]         = useState(settings.bgColor         ?? "#0d0d0d");
  const [textColor,       setTextColor]       = useState(settings.textColor       ?? "#ffffff");
  const [buttonColor,     setButtonColor]     = useState(settings.buttonColor     ?? "#d4a017");
  const [buttonTextColor, setButtonTextColor] = useState(settings.buttonTextColor ?? "#0d0d0d");
  const [borderRadius,    setBorderRadius]    = useState(settings.borderRadius    ?? 16);

  const handleSaveEarning = () => {
    fetcher.submit(
      {
        tab: "earning",
        pointsPerCurrency: Number(ppcRef.current?.value    ?? settings.pointsPerCurrency),
        orderAmountType:          oatRef.current?.value    ?? settings.orderAmountType,
        bronzeMultiplier:  Number(bronzeRef.current?.value ?? settings.bronzeMultiplier),
        silverMultiplier:  Number(silverRef.current?.value ?? settings.silverMultiplier),
        goldMultiplier:    Number(goldRef.current?.value   ?? settings.goldMultiplier),
      },
      { method: "POST", encType: "application/json" },
    );
  };

  const handleSaveStyle = () => {
    fetcher.submit(
      { tab: "style", accentColor, bgColor, textColor, buttonColor, buttonTextColor, borderRadius },
      { method: "POST", encType: "application/json" },
    );
  };

  // Only show banner for the active tab's action
  const showSuccess = result?.ok === true && result?.tab === activeTab;
  const showErrors  = result?.ok === false && result?.tab === activeTab && (result?.errors?.length ?? 0) > 0;

  const Banner = () => (
    <>
      {showSuccess && (
        <div style={{
          background: "#EAF3DE", border: "1px solid #97C459",
          borderRadius: "8px", padding: "12px 16px",
          marginBottom: "20px", color: "#3B6D11", fontSize: "14px",
        }}>✓ Settings saved successfully.</div>
      )}
      {showErrors && (
        <div style={{
          background: "#FCEBEB", border: "1px solid #F09595",
          borderRadius: "8px", padding: "12px 16px",
          marginBottom: "20px", color: "#A32D2D", fontSize: "14px",
        }}>
          {result!.errors!.map((e: string) => <div key={e}>⚠ {e}</div>)}
        </div>
      )}
    </>
  );

  // ── Tab bar ──
  const tabBarStyle: React.CSSProperties = {
    display: "flex", gap: "0", borderBottom: "1px solid #e1e3e5", marginBottom: "24px",
  };
  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: "10px 20px", fontSize: "14px", fontWeight: active ? 600 : 400,
    color: active ? "#0d0d0d" : "#6d7175", cursor: "pointer",
    borderBottom: active ? "2px solid #0d0d0d" : "2px solid transparent",
    marginBottom: "-1px", background: "none", border: "none",
    borderBottomWidth: "2px", borderBottomStyle: "solid",
    borderBottomColor: active ? "#0d0d0d" : "transparent",
  });

  return (
    <s-page heading="Loyalty Settings">

      {/* ── Tab bar ── */}
      <s-section>
        <s-card>
          <div style={tabBarStyle}>
            <button style={tabStyle(activeTab === "earning")} onClick={() => setActiveTab("earning")}>
              Earning Rules
            </button>
            <button style={tabStyle(activeTab === "style")} onClick={() => setActiveTab("style")}>
              Widget Style
            </button>
          </div>

          <Banner />

          {/* ══════════════════════════════════════════════════════════════
              EARNING TAB
          ══════════════════════════════════════════════════════════════ */}
          {activeTab === "earning" && (
            <s-stack direction="block" gap="large-400">

              <div>
                <div style={{ fontWeight: 600, marginBottom: "6px" }}>Points per currency unit</div>
                <div style={{ fontSize: "13px", color: "#666", marginBottom: "10px" }}>
                  How many points a customer earns for every 1 unit of store currency spent (e.g. 10 = 10 pts per $1).
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <input ref={ppcRef} type="number" defaultValue={settings.pointsPerCurrency}
                    min={0.1} step={0.1} style={{ ...inputStyle, width: "120px" }} />
                  <span style={{ fontSize: "13px", color: "#888" }}>pts per 1 currency unit</span>
                </div>
              </div>

              <div>
                <div style={{ fontWeight: 600, marginBottom: "6px" }}>Base order amount on</div>
                <div style={{ fontSize: "13px", color: "#666", marginBottom: "10px" }}>
                  Whether points are calculated on the subtotal or the total (including shipping and tax).
                </div>
                <select ref={oatRef} defaultValue={settings.orderAmountType}
                  style={{ ...inputStyle, background: "#fff", cursor: "pointer" }}>
                  <option value="subtotal">Subtotal (products only)</option>
                  <option value="total">Total (including shipping &amp; tax)</option>
                </select>
              </div>

              <div style={{
                background: "#F6F6F7", borderRadius: "8px",
                padding: "12px 16px", fontSize: "13px", color: "#444",
              }}>
                <strong>Formula:</strong>{" "}
                <code>floor(orderAmount × pointsPerCurrency × tierMultiplier)</code><br />
                <span style={{ color: "#888" }}>
                  Example: $50 order · 10 pts/$1 · Gold 1.5× = <strong>750 pts</strong>
                </span>
              </div>

              {[
                { ref: bronzeRef, emoji: "🥉", label: "Bronze multiplier", color: "#D85A30", note: "(base rate, usually 1×)", val: settings.bronzeMultiplier },
                { ref: silverRef, emoji: "🥈", label: "Silver multiplier", color: "#5F5E5A", note: "",                          val: settings.silverMultiplier },
                { ref: goldRef,   emoji: "🥇", label: "Gold multiplier",   color: "#BA7517", note: "",                          val: settings.goldMultiplier   },
              ].map(({ ref, emoji, label, color, note, val }) => (
                <div key={label}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                    <span style={{ fontSize: "18px" }}>{emoji}</span>
                    <strong style={{ color }}>{label}</strong>
                    {note && <span style={{ fontSize: "12px", color: "#888" }}>{note}</span>}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <input ref={ref} type="number" defaultValue={val} min={0.1} step={0.05}
                      style={{ ...inputStyle, width: "100px" }} />
                    <span style={{ fontSize: "13px", color: "#888" }}>×</span>
                  </div>
                </div>
              ))}

              <div>
                <s-button variant="primary" onClick={handleSaveEarning}
                  {...(isSaving ? { loading: true } : {})}>
                  {isSaving ? "Saving…" : "Save settings"}
                </s-button>
              </div>

            </s-stack>
          )}

          {/* ══════════════════════════════════════════════════════════════
              STYLE TAB
          ══════════════════════════════════════════════════════════════ */}
          {activeTab === "style" && (
            <div style={{ display: "flex", gap: "40px", alignItems: "flex-start", flexWrap: "wrap" }}>

              {/* Left — controls */}
              <div style={{ flex: "1", minWidth: "280px" }}>

                <ColorField label="Accent color" desc="Progress bar, highlights, tier badges."
                  value={accentColor} onChange={setAccentColor} />
                <ColorField label="Card background" desc="Background of the widget card."
                  value={bgColor} onChange={setBgColor} />
                <ColorField label="Text color" desc="Primary text on the widget card."
                  value={textColor} onChange={setTextColor} />
                <ColorField label="Button color" desc="Join / CTA button background."
                  value={buttonColor} onChange={setButtonColor} />
                <ColorField label="Button text color" desc="Text on the CTA button."
                  value={buttonTextColor} onChange={setButtonTextColor} />

                <div style={{ marginBottom: "24px" }}>
                  <div style={{ fontWeight: 600, marginBottom: "4px" }}>Border radius</div>
                  <div style={{ fontSize: "13px", color: "#666", marginBottom: "8px" }}>
                    Corner rounding on cards (px).
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <input type="range" min={0} max={32} value={borderRadius}
                      onChange={(e) => setBorderRadius(Number(e.target.value))}
                      style={{ width: "140px", cursor: "pointer" }} />
                    <input type="number" min={0} max={32} value={borderRadius}
                      onChange={(e) => setBorderRadius(Number(e.target.value))}
                      style={{ ...inputStyle, width: "70px" }} />
                    <span style={{ fontSize: "13px", color: "#888" }}>px</span>
                  </div>
                </div>

                <s-button variant="primary" onClick={handleSaveStyle}
                  {...(isSaving ? { loading: true } : {})}>
                  {isSaving ? "Saving…" : "Save style"}
                </s-button>
              </div>

              {/* Right — live preview */}
              <div style={{ flex: "1", minWidth: "260px" }}>
                <div style={{ fontSize: "12px", fontWeight: 600, color: "#888", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "12px" }}>
                  Live preview
                </div>
                <div style={{
                  background: bgColor,
                  borderRadius: `${borderRadius}px`,
                  padding: "28px 24px",
                  fontFamily: "'DM Sans', sans-serif",
                  position: "relative",
                  overflow: "hidden",
                  boxShadow: "0 4px 24px rgba(0,0,0,0.12)",
                }}>
                  {/* Glow */}
                  <div style={{
                    position: "absolute", top: "-40px", right: "-40px",
                    width: "140px", height: "140px",
                    background: `radial-gradient(circle, ${accentColor}33 0%, transparent 70%)`,
                    pointerEvents: "none",
                  }} />

                  {/* Badge */}
                  <div style={{
                    display: "inline-flex", alignItems: "center", gap: "5px",
                    background: `${accentColor}22`, border: `1px solid ${accentColor}66`,
                    borderRadius: "999px", padding: "3px 10px",
                    fontSize: "10px", fontWeight: 600, letterSpacing: "0.08em",
                    color: accentColor, textTransform: "uppercase", marginBottom: "14px",
                  }}>
                    ✦ Loyalty Program
                  </div>

                  {/* Points */}
                  <div style={{ color: textColor, fontSize: "36px", fontWeight: 700, lineHeight: 1, marginBottom: "4px" }}>
                    1,250
                  </div>
                  <div style={{ color: `${textColor}88`, fontSize: "13px", marginBottom: "16px" }}>
                    points available
                  </div>

                  {/* Progress bar */}
                  <div style={{ marginBottom: "16px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: `${textColor}66`, marginBottom: "5px" }}>
                      <span>🥉 Bronze</span><span>🥈 Silver</span>
                    </div>
                    <div style={{ height: "6px", background: `${textColor}18`, borderRadius: "999px", overflow: "hidden" }}>
                      <div style={{ width: "62%", height: "100%", background: accentColor, borderRadius: "999px" }} />
                    </div>
                    <div style={{ fontSize: "11px", color: `${textColor}55`, marginTop: "4px" }}>
                      <strong style={{ color: textColor }}>250 pts</strong> to reach Silver
                    </div>
                  </div>

                  {/* Button */}
                  <div style={{
                    background: buttonColor, color: buttonTextColor,
                    borderRadius: `${Math.max(6, borderRadius - 4)}px`,
                    padding: "11px 20px", fontSize: "14px", fontWeight: 600,
                    textAlign: "center", cursor: "pointer",
                  }}>
                    Join the program
                  </div>
                </div>

                <div style={{ fontSize: "11px", color: "#aaa", marginTop: "10px", textAlign: "center" }}>
                  Preview only — actual widget may vary slightly
                </div>
              </div>

            </div>
          )}

        </s-card>
      </s-section>

      {/* ── Points lifecycle (always visible) ── */}
      <s-section heading="Points lifecycle">
        <s-card>
          <s-stack direction="block" gap="large-300">
            {[
              { icon: "🛒", label: "Order paid",     desc: "Points awarded immediately as Pending — visible but not spendable." },
              { icon: "📦", label: "Order fulfilled", desc: "Pending points become Active — customer can now spend them." },
              { icon: "❌", label: "Order cancelled", desc: "Pending points are voided; Active points are deducted from balance." },
            ].map(({ icon, label, desc }) => (
              <div key={label} style={{
                display: "flex", gap: "12px", alignItems: "flex-start",
                padding: "10px 0", borderBottom: "0.5px solid #eee",
              }}>
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