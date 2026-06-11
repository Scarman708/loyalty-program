import type { LoaderFunctionArgs, HeadersFunction } from "react-router";
import { useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import db from "../db.server";

declare global {
  namespace JSX { interface IntrinsicElements { [elemName: string]: any; } }
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const shop = session.shop;

  // Fetch shop info
  const shopRes  = await admin.graphql(`query { shop { name myshopifyDomain currencyCode } }`);
  const shopData = await shopRes.json();
  const shopInfo = shopData.data?.shop ?? {};

  // Loyalty stats
  const [memberCount, settings] = await Promise.all([
    db.loyaltyCustomer.count({ where: { shop } }),
    db.loyaltySettings.findUnique({ where: { shop } }),
  ]);

  // Check if loyalty page exists
  const pageRes  = await admin.graphql(`
    query { pages(first: 5, query: "title:'Loyalty Rewards'") { nodes { id title handle } } }
  `);
  const pageData  = await pageRes.json();
  const loyaltyPage = pageData.data?.pages?.nodes?.[0] ?? null;

  // Check active theme for app embed
  const themeRes  = await admin.graphql(`
    query { themes(first: 10) { nodes { id role name } } }
  `);
  const themeData  = await themeRes.json();
  const activeTheme = themeData.data?.themes?.nodes?.find((t: any) => t.role === "MAIN") ?? null;

  return {
    shop:          shopInfo,
    memberCount,
    hasSettings:   !!settings,
    loyaltyPage,
    activeTheme,
    appUrl:        process.env.SHOPIFY_APP_URL ?? "",
  };
};

export default function Index() {
  const { shop, memberCount, hasSettings, loyaltyPage, activeTheme, appUrl } = useLoaderData<typeof loader>();

  const storeDomain = shop.myshopifyDomain ?? "";
  const adminBase   = `https://admin.shopify.com/store/${storeDomain.replace(".myshopify.com", "")}`;

  // Checklist items
  const checklist = [
    {
      done:  memberCount > 0 || hasSettings,
      title: "App installed & configured",
      desc:  "Your loyalty program is active and ready to accept members.",
      action: null,
    },
    {
      done:  !!loyaltyPage,
      title: "Loyalty Rewards page created",
      desc:  loyaltyPage
        ? `Page exists at /pages/${loyaltyPage.handle}`
        : "The Loyalty Rewards page was not found. It should be auto-created on install.",
      action: loyaltyPage
        ? { label: "View page", url: `https://${storeDomain}/pages/${loyaltyPage.handle}`, external: true }
        : null,
    },
    {
      done:  false, // merchant must verify manually
      title: "Enable App Embed in theme",
      desc:  `In your theme editor, go to App Embeds and enable "Loyalty Widget" for your active theme${activeTheme ? ` (${activeTheme.name})` : ""}.`,
      action: activeTheme
        ? {
            label: "Open theme editor",
            url:   `${adminBase}/themes/${activeTheme.id.replace("gid://shopify/OnlineStoreTheme/", "")}/editor?context=apps`,
            external: true,
          }
        : null,
    },
    {
      done:  false,
      title: "Add Loyalty CTA to your storefront",
      desc:  "Use the theme editor to add the Loyalty Register section or Loyalty CTA block to your homepage, product pages, or any page.",
      action: activeTheme
        ? {
            label: "Open theme editor",
            url:   `${adminBase}/themes/${activeTheme.id.replace("gid://shopify/OnlineStoreTheme/", "")}/editor`,
            external: true,
          }
        : null,
    },
    {
      done:  false,
      title: "Configure earning rules",
      desc:  "Set how many points customers earn per order, and tier multipliers.",
      action: { label: "Go to Settings", url: "/app/settings", external: false },
    },
    {
      done:  false,
      title: "Set redemption rates & voucher presets",
      desc:  "Configure how many points equal a discount, and the 3 voucher amounts customers can choose.",
      action: { label: "Go to Settings", url: "/app/settings", external: false },
    },
  ];

  const doneCount = checklist.filter((c) => c.done).length;
  const allDone   = doneCount === checklist.length;

  return (
    <s-page heading={`Welcome to Loyalify${shop.name ? `, ${shop.name}` : ""}`}>

      {/* ── Hero stats row ── */}
      <s-section>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px" }}>
          {[
            { icon: "👥", label: "Loyalty members", value: memberCount.toLocaleString(), sub: "enrolled customers" },
            { icon: "⚙️", label: "Program status",  value: hasSettings ? "Active" : "Not configured", sub: hasSettings ? "earning rules set" : "complete setup below", positive: hasSettings },
            { icon: "🏪", label: "Store",            value: shop.name ?? storeDomain, sub: shop.currencyCode ?? "" },
          ].map(({ icon, label, value, sub, positive }) => (
            <s-card key={label}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: "14px" }}>
                <div style={{ fontSize: "28px", lineHeight: 1, flexShrink: 0 }}>{icon}</div>
                <div>
                  <div style={{ fontSize: "11px", color: "#888", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "4px" }}>{label}</div>
                  <div style={{ fontSize: "20px", fontWeight: 700, color: positive === false ? "#b91c1c" : positive ? "#065f46" : "#0d0d0d", marginBottom: "2px" }}>{value}</div>
                  <div style={{ fontSize: "12px", color: "#aaa" }}>{sub}</div>
                </div>
              </div>
            </s-card>
          ))}
        </div>
      </s-section>

      {/* ── Setup checklist ── */}
      <s-section heading="Setup checklist">
        <s-card>
          {/* Progress header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
            <div style={{ fontSize: "13px", color: "#666" }}>
              {allDone ? "🎉 All steps complete!" : `${doneCount} of ${checklist.length} steps completed`}
            </div>
            <div style={{ fontSize: "13px", fontWeight: 600, color: "#1d4ed8" }}>
              {Math.round((doneCount / checklist.length) * 100)}%
            </div>
          </div>
          <div style={{ height: "6px", background: "#f0f0f0", borderRadius: "999px", overflow: "hidden", marginBottom: "24px" }}>
            <div style={{
              height: "100%", borderRadius: "999px", background: "#1d4ed8",
              width: `${Math.round((doneCount / checklist.length) * 100)}%`,
              transition: "width 0.6s ease",
            }} />
          </div>

          {/* Steps */}
          <div style={{ display: "flex", flexDirection: "column", gap: "0" }}>
            {checklist.map(({ done, title, desc, action }, i) => (
              <div key={title} style={{
                display: "flex", gap: "14px", alignItems: "flex-start",
                padding: "14px 0",
                borderTop: i === 0 ? "none" : "1px solid #f5f5f5",
              }}>
                {/* Status icon */}
                <div style={{
                  width: "24px", height: "24px", borderRadius: "50%", flexShrink: 0, marginTop: "1px",
                  background: done ? "#d1fae5" : "#f3f4f6",
                  border: `2px solid ${done ? "#34d399" : "#e5e7eb"}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "13px",
                }}>
                  {done ? "✓" : <span style={{ color: "#9ca3af", fontSize: "11px", fontWeight: 700 }}>{i + 1}</span>}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "3px", flexWrap: "wrap" }}>
                    <div style={{ fontWeight: 600, fontSize: "14px", color: done ? "#6b7280" : "#0d0d0d",
                      textDecoration: done ? "line-through" : "none" }}>
                      {title}
                    </div>
                    {done && (
                      <span style={{ background: "#d1fae5", color: "#065f46", fontSize: "11px", fontWeight: 600,
                        padding: "1px 7px", borderRadius: "999px" }}>Done</span>
                    )}
                  </div>
                  <div style={{ fontSize: "13px", color: "#666", lineHeight: 1.5 }}>{desc}</div>
                  {action && !done && (
                    <div style={{ marginTop: "8px" }}>
                      {action.external ? (
                        <a href={action.url} target="_blank" rel="noreferrer" style={{
                          display: "inline-flex", alignItems: "center", gap: "4px",
                          padding: "6px 14px", borderRadius: "6px", fontSize: "13px", fontWeight: 600,
                          background: "#1d4ed8", color: "#fff", textDecoration: "none",
                          transition: "opacity 0.15s",
                        }}>
                          {action.label} ↗
                        </a>
                      ) : (
                        <a href={action.url} style={{
                          display: "inline-flex", alignItems: "center", gap: "4px",
                          padding: "6px 14px", borderRadius: "6px", fontSize: "13px", fontWeight: 600,
                          background: "#f3f4f6", color: "#0d0d0d", textDecoration: "none",
                          border: "1px solid #e5e7eb",
                        }}>
                          {action.label} →
                        </a>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </s-card>
      </s-section>

      {/* ── Quick links aside ── */}
      <s-section slot="aside" heading="Quick links">
        {[
          { label: "📊 Analytics",  url: "/app/analytics" },
          { label: "⚙️ Settings",   url: "/app/settings"  },
          { label: "🎯 Tiers",      url: "/app/tiers"     },
        ].map(({ label, url }) => (
          <div key={url} style={{ marginBottom: "8px" }}>
            <a href={url} style={{
              display: "block", padding: "10px 14px", borderRadius: "8px",
              background: "#fafafa", border: "1px solid #efefef",
              fontSize: "14px", fontWeight: 500, color: "#0d0d0d",
              textDecoration: "none", transition: "background 0.1s",
            }}>
              {label}
            </a>
          </div>
        ))}
      </s-section>

      {/* ── How it works aside ── */}
      <s-section slot="aside" heading="How it works">
        {[
          { icon: "🛒", step: "Customer places order",        desc: "Points awarded as pending" },
          { icon: "📦", step: "Order fulfilled",              desc: "Points become active & spendable" },
          { icon: "🎁", step: "Customer redeems",             desc: "Discount code generated instantly" },
          { icon: "🏆", step: "Tier upgrade",                 desc: "Based on lifetime points earned" },
          { icon: "🔗", step: "Referral",                     desc: "Bonus points for both parties" },
        ].map(({ icon, step, desc }) => (
          <div key={step} style={{ display: "flex", gap: "10px", marginBottom: "12px", alignItems: "flex-start" }}>
            <span style={{ fontSize: "16px", flexShrink: 0, marginTop: "1px" }}>{icon}</span>
            <div>
              <div style={{ fontSize: "13px", fontWeight: 600, color: "#0d0d0d" }}>{step}</div>
              <div style={{ fontSize: "12px", color: "#888" }}>{desc}</div>
            </div>
          </div>
        ))}
      </s-section>

      {/* ── Storefront widget guide ── */}
      <s-section heading="Adding the widget to your storefront">
        <s-card>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
            {[
              {
                icon: "🧩",
                title: "Loyalty Widget (Dashboard)",
                desc: "Full customer dashboard — points balance, tier progress, redeem tab, transaction history, referral code. Add as an App Embed.",
                where: "App Embeds → enable Loyalty Widget",
              },
              {
                icon: "📣",
                title: "Loyalty Register Section",
                desc: "A rich-text style section with a heading, description, and join button. Redirects enrolled customers to their dashboard.",
                where: "Add section → Apps → Loyalty Register",
              },
              {
                icon: "🔘",
                title: "Loyalty CTA Block",
                desc: "Compact join button block. Place anywhere — homepage, product pages, cart page.",
                where: "Add block → Apps → Loyalty CTA",
              },
              {
                icon: "📄",
                title: "Loyalty Rewards Page",
                desc: "Auto-created on install at /pages/loyalty-rewards. Contains the widget div — just enable the App Embed and it renders automatically.",
                where: loyaltyPage ? `✓ Live at /pages/${loyaltyPage.handle}` : "Not found — reinstall app",
              },
            ].map(({ icon, title, desc, where }) => (
              <div key={title} style={{
                background: "#fafafa", border: "1px solid #efefef",
                borderRadius: "10px", padding: "16px",
              }}>
                <div style={{ fontSize: "24px", marginBottom: "8px" }}>{icon}</div>
                <div style={{ fontWeight: 600, fontSize: "14px", marginBottom: "4px" }}>{title}</div>
                <div style={{ fontSize: "13px", color: "#666", marginBottom: "8px", lineHeight: 1.5 }}>{desc}</div>
                <div style={{ fontSize: "11px", color: "#1d4ed8", fontWeight: 600, background: "#eff6ff",
                  padding: "4px 8px", borderRadius: "4px", display: "inline-block" }}>
                  {where}
                </div>
              </div>
            ))}
          </div>
        </s-card>
      </s-section>

    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};