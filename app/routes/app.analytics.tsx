import { useLoaderData } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";

declare global {
  namespace JSX {
    interface IntrinsicElements {
      [elemName: string]: any;
    }
  }
}

// ── Types ─────────────────────────────────────────────────────────────────────

type TierName = "Bronze" | "Silver" | "Gold";

interface TopCustomer {
  shopifyCustomerId: string;
  totalPoints: number;
  name: string | null;
}

interface RecentTransaction {
  id: string;
  customerId: string;
  type: "earn" | "redeem" | "expire" | "adjust";
  points: number;
  note: string | null;
  createdAt: Date;
  customerName: string | null;
}

interface DayStat {
  date: string;
  issued: number;
  redeemed: number;
}

interface TierStat {
  tier: TierName;
  count: number;
  threshold: string;
}

interface AnalyticsData {
  totalMembers: number;
  pointsIssued30d: number;
  pointsRedeemed30d: number;
  outstandingBalance: number;
  newMembers30d: number;
  topCustomers: TopCustomer[];
  recentTransactions: RecentTransaction[];
  dailyStats: DayStat[];
  tierStats: TierStat[];
}

// ── Tier helpers ──────────────────────────────────────────────────────────────

function getTier(points: number): TierName {
  if (points >= 2000) return "Gold";
  if (points >= 500) return "Silver";
  return "Bronze";
}

const TIER_CONFIG: { tier: TierName; threshold: string }[] = [
  { tier: "Gold",   threshold: "≥ 2,000 pts" },
  { tier: "Silver", threshold: "500–1,999 pts" },
  { tier: "Bronze", threshold: "< 500 pts" },
];

// ── Loader ────────────────────────────────────────────────────────────────────

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [allCustomers, transactions30d, recentRaw] = await Promise.all([
    db.loyaltyCustomer.findMany({
      select: {
        shopifyCustomerId: true,
        points: true,
        firstName: true,
        lastName: true,
        createdAt: true,
      },
    }),

    db.pointTransaction.findMany({
      where: { createdAt: { gte: thirtyDaysAgo } },
      select: { type: true, points: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    }),

    db.pointTransaction.findMany({
      take: 10,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        customerId: true,
        type: true,
        points: true,
        note: true,
        createdAt: true,
        customer: { select: { firstName: true, lastName: true } },
      },
    }),
  ]);

  // ── Aggregate stats ────────────────────────────────────────────────────────

  const totalMembers  = allCustomers.length;
  const newMembers30d = allCustomers.filter((c) => c.createdAt >= thirtyDaysAgo).length;
  const outstandingBalance = allCustomers.reduce((sum, c) => sum + c.points, 0);

  let pointsIssued30d   = 0;
  let pointsRedeemed30d = 0;
  for (const t of transactions30d) {
    if (t.type === "earn" || t.type === "adjust") pointsIssued30d   += t.points;
    else                                           pointsRedeemed30d += t.points;
  }

  // ── Top 5 customers ────────────────────────────────────────────────────────

  const topCustomers: TopCustomer[] = [...allCustomers]
    .sort((a, b) => b.points - a.points)
    .slice(0, 5)
    .map((c) => ({
      shopifyCustomerId: c.shopifyCustomerId,
      totalPoints: c.points,
      name: [c.firstName, c.lastName].filter(Boolean).join(" ") || null,
    }));

  // ── Daily stats (last 30 days) ─────────────────────────────────────────────

  const dayMap = new Map<string, { issued: number; redeemed: number }>();
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dayMap.set(d.toISOString().slice(0, 10), { issued: 0, redeemed: 0 });
  }
  for (const t of transactions30d) {
    const key   = t.createdAt.toISOString().slice(0, 10);
    const entry = dayMap.get(key);
    if (!entry) continue;
    if (t.type === "earn" || t.type === "adjust") entry.issued   += t.points;
    else                                           entry.redeemed += t.points;
  }
  const dailyStats: DayStat[] = Array.from(dayMap.entries()).map(([date, v]) => ({ date, ...v }));

  // ── Tier distribution ──────────────────────────────────────────────────────

  const tierCounts: Record<TierName, number> = { Gold: 0, Silver: 0, Bronze: 0 };
  for (const c of allCustomers) tierCounts[getTier(c.points)]++;

  const tierStats: TierStat[] = TIER_CONFIG.map(({ tier, threshold }) => ({
    tier,
    count: tierCounts[tier],
    threshold,
  }));

  // ── Recent transactions ────────────────────────────────────────────────────

  const recentTransactions: RecentTransaction[] = recentRaw.map((t) => ({
    id: t.id,
    customerId: t.customerId,
    type: t.type as RecentTransaction["type"],
    points: t.points,
    note: t.note,
    createdAt: t.createdAt,
    customerName:
      t.customer
        ? [t.customer.firstName, t.customer.lastName].filter(Boolean).join(" ") || null
        : null,
  }));

  return {
    totalMembers,
    newMembers30d,
    pointsIssued30d,
    pointsRedeemed30d,
    outstandingBalance,
    topCustomers,
    recentTransactions,
    dailyStats,
    tierStats,
  } satisfies AnalyticsData;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function initials(name: string | null, id: string): string {
  if (name) {
    const parts = name.trim().split(/\s+/);
    return parts.length >= 2
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : parts[0].slice(0, 2).toUpperCase();
  }
  return id.slice(0, 2).toUpperCase();
}

function relativeTime(date: Date): string {
  const diffMs   = Date.now() - new Date(date).getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  if (diffMins < 1)  return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24)  return `${diffHrs}h ago`;
  return `${Math.floor(diffHrs / 24)}d ago`;
}

function fmtNum(n: number): string {
  return n.toLocaleString();
}

const TIER_STYLES: Record<TierName, string> = {
  Gold:   "#BA7517",
  Silver: "#5F5E5A",
  Bronze: "#D85A30",
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const data = useLoaderData<typeof loader>();

  const totalForTier = data.tierStats.reduce((s, t) => s + t.count, 0) || 1;

  // Every-other-day to avoid label crowding on the 30-day chart
  const chartDays = data.dailyStats
    .filter((_, i) => i % 2 === 0)
    .map((d) => {
      const [, m, day] = d.date.split("-");
      return `${parseInt(m)}/${parseInt(day)}`;
    });
  const chartIssued   = data.dailyStats.filter((_, i) => i % 2 === 0).map((d) => d.issued);
  const chartRedeemed = data.dailyStats.filter((_, i) => i % 2 === 0).map((d) => d.redeemed);

  return (
    <s-page heading="Loyalty Analytics">

      {/* ── KPI cards ── */}
      <s-section heading="Last 30 days">
        {/* s-grid doesn't accept `columns`; use CSS grid instead */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px" }}>
          <s-card>
            <s-stack direction="block" gap="large-200">
              <s-text tone="neutral">Total members</s-text>
              <s-heading>{fmtNum(data.totalMembers)}</s-heading>
              <s-text tone="neutral">+{data.newMembers30d} new this month</s-text>
            </s-stack>
          </s-card>

          <s-card>
            <s-stack direction="block" gap="large-200">
              <s-text tone="neutral">Points issued</s-text>
              <s-heading>{fmtNum(data.pointsIssued30d)}</s-heading>
              <s-text tone="success">This period</s-text>
            </s-stack>
          </s-card>

          <s-card>
            <s-stack direction="block" gap="large-200">
              <s-text tone="neutral">Points redeemed</s-text>
              <s-heading>{fmtNum(data.pointsRedeemed30d)}</s-heading>
              <s-text tone="neutral">This period</s-text>
            </s-stack>
          </s-card>

          <s-card>
            <s-stack direction="block" gap="large-200">
              <s-text tone="neutral">Outstanding balance</s-text>
              <s-heading>{fmtNum(data.outstandingBalance)}</s-heading>
              <s-text tone="neutral">Across all members</s-text>
            </s-stack>
          </s-card>
        </div>
      </s-section>

      {/* ── Points chart ── */}
      <s-section heading="Daily activity">
        <s-card>
          <div style={{ position: "relative", width: "100%", height: "220px" }}>
            <canvas
              id="loyaltyChart"
              role="img"
              aria-label="Bar chart of daily points issued vs redeemed over the last 30 days"
            >
              Points issued and redeemed by day.
            </canvas>
          </div>

          {/* Custom legend */}
          <div style={{ display: "flex", gap: "16px", marginTop: "12px" }}>
            <span style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px" }}>
              <span style={{ width: "10px", height: "10px", borderRadius: "2px", background: "#97C459", display: "inline-block" }} />
              Issued
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px" }}>
              <span style={{ width: "10px", height: "10px", borderRadius: "2px", background: "#F09595", display: "inline-block" }} />
              Redeemed
            </span>
          </div>
        </s-card>

        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                var days     = ${JSON.stringify(chartDays)};
                var issued   = ${JSON.stringify(chartIssued)};
                var redeemed = ${JSON.stringify(chartRedeemed)};
                function initChart() {
                  if (typeof Chart === 'undefined') { setTimeout(initChart, 100); return; }
                  var ctx = document.getElementById('loyaltyChart');
                  if (!ctx) return;
                  new Chart(ctx, {
                    type: 'bar',
                    data: {
                      labels: days,
                      datasets: [
                        { label: 'Issued',   data: issued,   backgroundColor: '#97C459', borderRadius: 3 },
                        { label: 'Redeemed', data: redeemed, backgroundColor: '#F09595', borderRadius: 3 }
                      ]
                    },
                    options: {
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: { legend: { display: false } },
                      scales: {
                        x: { grid: { display: false }, ticks: { autoSkip: true, maxTicksLimit: 8 } },
                        y: { beginAtZero: true, ticks: { precision: 0 } }
                      }
                    }
                  });
                }
                var s = document.createElement('script');
                s.src = 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js';
                s.onload = initChart;
                document.head.appendChild(s);
              })();
            `,
          }}
        />
      </s-section>

      {/* ── Two-column: top customers + recent transactions ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
        <s-section heading="Top customers">
          <s-card>
            {data.topCustomers.length === 0 ? (
              <s-text tone="neutral">No customers yet.</s-text>
            ) : (
              <s-resource-list>
                {data.topCustomers.map((c) => (
                  <s-resource-item key={c.shopifyCustomerId}>
                    {/* s-stack doesn't support `align`; use inline flex div */}
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <s-avatar initials={initials(c.name, c.shopifyCustomerId)} />
                      <div style={{ flex: 1 }}>
                        <s-text>{c.name ?? `Customer ${c.shopifyCustomerId}`}</s-text>
                        <br />
                        <s-text tone="neutral">{fmtNum(c.totalPoints)} pts</s-text>
                      </div>
                      <s-badge tone="info">{getTier(c.totalPoints)}</s-badge>
                    </div>
                  </s-resource-item>
                ))}
              </s-resource-list>
            )}
          </s-card>
        </s-section>

        <s-section heading="Recent transactions">
          <s-card>
            {data.recentTransactions.length === 0 ? (
              <s-text tone="neutral">No transactions yet.</s-text>
            ) : (
              <s-resource-list>
                {data.recentTransactions.map((t) => {
                  const isPositive = t.type === "earn" || t.type === "adjust";
                  return (
                    <s-resource-item key={t.id}>
                      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        {/* Simple +/- badge instead of s-icon (source prop unsupported) */}
                        <div
                          style={{
                            width: "28px",
                            height: "28px",
                            borderRadius: "50%",
                            background: isPositive ? "#EAF3DE" : "#FCEBEB",
                            color:      isPositive ? "#3B6D11" : "#A32D2D",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontWeight: 600,
                            fontSize: "16px",
                            flexShrink: 0,
                          }}
                          aria-hidden="true"
                        >
                          {isPositive ? "+" : "−"}
                        </div>
                        <div style={{ flex: 1 }}>
                          <s-text>{t.note ?? (isPositive ? "Award" : "Deduction")}</s-text>
                          <br />
                          <s-text tone="neutral">
                            {t.customerName ?? t.customerId} · {relativeTime(t.createdAt)}
                          </s-text>
                        </div>
                        <s-text tone={isPositive ? "success" : "critical"}>
                          {isPositive ? "+" : "−"}{fmtNum(t.points)}
                        </s-text>
                      </div>
                    </s-resource-item>
                  );
                })}
              </s-resource-list>
            )}
          </s-card>
        </s-section>
      </div>

      {/* ── Tier distribution ── */}
      <s-section heading="Membership tier distribution">
        <s-card>
          <s-stack direction="block" gap="large-400">
            {data.tierStats.map(({ tier, count, threshold }) => {
              const pct = Math.round((count / totalForTier) * 100);
              return (
                <div key={tier}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                    <s-text>
                      {tier} <span style={{ color: "var(--p-color-text-secondary)", fontSize: "13px" }}>{threshold}</span>
                    </s-text>
                    <s-text tone="neutral">{fmtNum(count)} members · {pct}%</s-text>
                  </div>
                  <div
                    style={{
                      height: "7px",
                      background: "var(--p-color-bg-surface-secondary)",
                      borderRadius: "4px",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        width: `${pct}%`,
                        height: "100%",
                        background: TIER_STYLES[tier],
                        borderRadius: "4px",
                        transition: "width 0.6s ease",
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </s-stack>
        </s-card>
      </s-section>

    </s-page>
  );
}