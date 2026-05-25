// extensions/loyalty-ui/assets/loyalty-widget.js
// Loyalty Program Widget — Signup + Dashboard
// Drop this in your Theme App Extension as a Script tag block

(function () {
  "use strict";

  const APP_URL = window.__LOYALTY_APP_URL__ || ""; // injected by liquid
  const SHOP = window.__LOYALTY_SHOP__ || Shopify.shop;
  const CUSTOMER_ID = window.__LOYALTY_CUSTOMER_ID__ || null; // injected by liquid if logged in

  const TIER_COLORS = {
    bronze: { bg: "#f5e6d3", accent: "#c8813a", text: "#7a4a1e", glow: "rgba(200,129,58,0.3)" },
    silver: { bg: "#e8edf2", accent: "#8899aa", text: "#3a5068", glow: "rgba(136,153,170,0.3)" },
    gold:   { bg: "#fdf3d0", accent: "#d4a017", text: "#7a5a00", glow: "rgba(212,160,23,0.3)" },
  };

  const TIER_ICONS = {
    bronze: "🥉",
    silver: "🥈",
    gold:   "🥇",
  };

  // ── Inject global styles once ──────────────────────────────────────────────
  function injectStyles() {
    if (document.getElementById("loyalty-widget-styles")) return;
    const style = document.createElement("style");
    style.id = "loyalty-widget-styles";
    style.textContent = `
      @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Sans:wght@400;500;600&display=swap');

      .lw-root {
        font-family: 'DM Sans', sans-serif;
        --lw-radius: 16px;
        --lw-shadow: 0 4px 24px rgba(0,0,0,0.08);
        max-width: 480px;
        margin: 0 auto;
      }

      /* ── Signup Card ── */
      .lw-signup {
        background: #0d0d0d;
        border-radius: var(--lw-radius);
        padding: 36px 32px;
        color: #fff;
        position: relative;
        overflow: hidden;
        box-shadow: var(--lw-shadow);
      }
      .lw-signup::before {
        content: '';
        position: absolute;
        top: -60px; right: -60px;
        width: 200px; height: 200px;
        background: radial-gradient(circle, rgba(212,160,23,0.25) 0%, transparent 70%);
        pointer-events: none;
      }
      .lw-signup-badge {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        background: rgba(212,160,23,0.15);
        border: 1px solid rgba(212,160,23,0.4);
        border-radius: 999px;
        padding: 4px 12px;
        font-size: 11px;
        font-weight: 600;
        letter-spacing: 0.08em;
        color: #d4a017;
        text-transform: uppercase;
        margin-bottom: 20px;
      }
      .lw-signup h2 {
        font-family: 'DM Serif Display', serif;
        font-size: 28px;
        line-height: 1.2;
        margin: 0 0 10px;
        font-weight: 400;
      }
      .lw-signup h2 em { font-style: italic; color: #d4a017; }
      .lw-signup p {
        font-size: 14px;
        color: rgba(255,255,255,0.6);
        margin: 0 0 28px;
        line-height: 1.6;
      }
      .lw-perks {
        display: flex;
        gap: 12px;
        margin-bottom: 28px;
        flex-wrap: wrap;
      }
      .lw-perk {
        background: rgba(255,255,255,0.06);
        border: 1px solid rgba(255,255,255,0.1);
        border-radius: 10px;
        padding: 10px 14px;
        font-size: 12px;
        color: rgba(255,255,255,0.8);
        flex: 1;
        min-width: 100px;
        text-align: center;
      }
      .lw-perk-icon { font-size: 20px; display: block; margin-bottom: 4px; }
      .lw-btn {
        display: block;
        width: 100%;
        padding: 14px 24px;
        border-radius: 10px;
        border: none;
        cursor: pointer;
        font-family: 'DM Sans', sans-serif;
        font-size: 15px;
        font-weight: 600;
        letter-spacing: 0.01em;
        transition: all 0.2s ease;
        text-align: center;
      }
      .lw-btn-primary {
        background: #d4a017;
        color: #0d0d0d;
      }
      .lw-btn-primary:hover { background: #e8b420; transform: translateY(-1px); box-shadow: 0 6px 20px rgba(212,160,23,0.35); }
      .lw-btn-primary:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }
      .lw-signup-note {
        margin-top: 12px;
        font-size: 11px;
        color: rgba(255,255,255,0.35);
        text-align: center;
      }

      /* ── Dashboard ── */
      .lw-dashboard {
        background: #fff;
        border-radius: var(--lw-radius);
        overflow: hidden;
        box-shadow: var(--lw-shadow);
        border: 1px solid #e8e8e8;
      }

      .lw-hero {
        padding: 28px 28px 24px;
        position: relative;
        overflow: hidden;
      }
      .lw-hero-top {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        margin-bottom: 20px;
      }
      .lw-greeting {
        font-size: 13px;
        color: rgba(0,0,0,0.45);
        margin-bottom: 2px;
      }
      .lw-name {
        font-family: 'DM Serif Display', serif;
        font-size: 22px;
        font-weight: 400;
        color: #0d0d0d;
      }
      .lw-tier-badge {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        padding: 5px 13px;
        border-radius: 999px;
        font-size: 12px;
        font-weight: 600;
        letter-spacing: 0.05em;
        text-transform: uppercase;
      }

      .lw-points-display {
        display: flex;
        align-items: baseline;
        gap: 6px;
        margin-bottom: 20px;
      }
      .lw-points-number {
        font-family: 'DM Serif Display', serif;
        font-size: 48px;
        line-height: 1;
        color: #0d0d0d;
      }
      .lw-points-label {
        font-size: 14px;
        color: rgba(0,0,0,0.5);
        font-weight: 500;
      }

      /* Progress bar */
      .lw-progress-wrap { margin-bottom: 4px; }
      .lw-progress-labels {
        display: flex;
        justify-content: space-between;
        font-size: 11px;
        color: rgba(0,0,0,0.45);
        margin-bottom: 6px;
      }
      .lw-progress-track {
        height: 6px;
        background: rgba(0,0,0,0.08);
        border-radius: 999px;
        overflow: hidden;
      }
      .lw-progress-fill {
        height: 100%;
        border-radius: 999px;
        transition: width 1s cubic-bezier(0.4, 0, 0.2, 1);
      }
      .lw-progress-hint {
        font-size: 11px;
        color: rgba(0,0,0,0.4);
        margin-top: 5px;
      }
      .lw-progress-hint strong { color: #0d0d0d; }
      .lw-max-tier-msg {
        font-size: 12px;
        font-weight: 600;
        color: #d4a017;
        margin-top: 8px;
      }

      /* ── Tabs ── */
      .lw-tabs {
        display: flex;
        border-bottom: 1px solid #efefef;
        padding: 0 28px;
        gap: 0;
      }
      .lw-tab {
        padding: 12px 16px;
        font-size: 13px;
        font-weight: 500;
        color: rgba(0,0,0,0.4);
        cursor: pointer;
        border: none;
        background: none;
        border-bottom: 2px solid transparent;
        margin-bottom: -1px;
        transition: all 0.15s;
        font-family: 'DM Sans', sans-serif;
      }
      .lw-tab:hover { color: #0d0d0d; }
      .lw-tab.active { color: #0d0d0d; border-bottom-color: #0d0d0d; }

      /* ── Tab Panels ── */
      .lw-panel { display: none; padding: 20px 28px 28px; }
      .lw-panel.active { display: block; }

      /* Transactions */
      .lw-tx-list { list-style: none; margin: 0; padding: 0; }
      .lw-tx-item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px 0;
        border-bottom: 1px solid #f0f0f0;
        gap: 12px;
      }
      .lw-tx-item:last-child { border-bottom: none; }
      .lw-tx-icon {
        width: 34px; height: 34px;
        border-radius: 8px;
        display: flex; align-items: center; justify-content: center;
        font-size: 14px;
        flex-shrink: 0;
      }
      .lw-tx-meta { flex: 1; min-width: 0; }
      .lw-tx-desc {
        font-size: 13px;
        font-weight: 500;
        color: #0d0d0d;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .lw-tx-date {
        font-size: 11px;
        color: rgba(0,0,0,0.4);
        margin-top: 1px;
      }
      .lw-tx-pts {
        font-size: 14px;
        font-weight: 600;
        flex-shrink: 0;
      }
      .lw-tx-pts.earn { color: #1a7a4a; }
      .lw-tx-pts.redeem { color: #b91c1c; }
      .lw-tx-pts.pending { color: #92400e; }
      .lw-tx-empty {
        text-align: center;
        padding: 32px 0;
        color: rgba(0,0,0,0.35);
        font-size: 13px;
      }

      /* Referral */
      .lw-referral-card {
        background: #0d0d0d;
        border-radius: 12px;
        padding: 24px;
        color: #fff;
        position: relative;
        overflow: hidden;
      }
      .lw-referral-card::after {
        content: '';
        position: absolute;
        bottom: -40px; right: -40px;
        width: 160px; height: 160px;
        background: radial-gradient(circle, rgba(212,160,23,0.2) 0%, transparent 70%);
        pointer-events: none;
      }
      .lw-referral-label {
        font-size: 11px;
        font-weight: 600;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: rgba(255,255,255,0.5);
        margin-bottom: 8px;
      }
      .lw-referral-title {
        font-family: 'DM Serif Display', serif;
        font-size: 20px;
        font-weight: 400;
        margin-bottom: 6px;
      }
      .lw-referral-sub {
        font-size: 13px;
        color: rgba(255,255,255,0.55);
        margin-bottom: 20px;
        line-height: 1.5;
      }
      .lw-referral-code-row {
        display: flex;
        gap: 8px;
        align-items: stretch;
      }
      .lw-code-box {
        flex: 1;
        background: rgba(255,255,255,0.08);
        border: 1px solid rgba(255,255,255,0.15);
        border-radius: 8px;
        padding: 10px 14px;
        font-size: 15px;
        font-weight: 600;
        letter-spacing: 0.1em;
        color: #d4a017;
        font-family: 'DM Sans', monospace;
      }
      .lw-copy-btn {
        background: #d4a017;
        color: #0d0d0d;
        border: none;
        border-radius: 8px;
        padding: 10px 16px;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        font-family: 'DM Sans', sans-serif;
        transition: all 0.15s;
        white-space: nowrap;
      }
      .lw-copy-btn:hover { background: #e8b420; }
      .lw-copy-btn.copied { background: #1a7a4a; color: #fff; }

      /* Loading / error states */
      .lw-loading {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 48px;
        color: rgba(0,0,0,0.35);
        font-size: 13px;
        gap: 8px;
      }
      .lw-spinner {
        width: 18px; height: 18px;
        border: 2px solid rgba(0,0,0,0.1);
        border-top-color: #0d0d0d;
        border-radius: 50%;
        animation: lw-spin 0.7s linear infinite;
      }
      @keyframes lw-spin { to { transform: rotate(360deg); } }

      .lw-not-logged-in {
        text-align: center;
        padding: 40px 24px;
        background: #f9f9f9;
        border-radius: var(--lw-radius);
        border: 1px dashed #ddd;
      }
      .lw-not-logged-in p { font-size: 14px; color: rgba(0,0,0,0.5); margin: 8px 0 20px; }
      .lw-not-logged-in a {
        display: inline-block;
        background: #0d0d0d;
        color: #fff;
        text-decoration: none;
        padding: 10px 24px;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 600;
        transition: opacity 0.15s;
      }
      .lw-not-logged-in a:hover { opacity: 0.8; }

      @media (max-width: 480px) {
        .lw-signup { padding: 28px 20px; }
        .lw-hero { padding: 24px 20px 20px; }
        .lw-tabs { padding: 0 20px; }
        .lw-panel { padding: 16px 20px 24px; }
        .lw-points-number { font-size: 40px; }
        .lw-perks { gap: 8px; }
      }
    `;
    document.head.appendChild(style);
  }

  // ── Helpers ──────────────────────────────────────────────────────────────
  function formatDate(iso) {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  }

  function txIcon(type, status) {
    if (status === "pending") return { emoji: "⏳", bg: "#fef3c7" };
    if (status === "voided" || status === "deducted") return { emoji: "↩️", bg: "#fee2e2" };
    if (type === "earn") return { emoji: "⭐", bg: "#d1fae5" };
    if (type === "redeem") return { emoji: "🎁", bg: "#fee2e2" };
    if (type === "adjust") return { emoji: "✏️", bg: "#e0e7ff" };
    return { emoji: "📋", bg: "#f3f4f6" };
  }

  function txPointsClass(type, status) {
    if (status === "pending") return "pending";
    if (status === "voided" || status === "deducted") return "redeem";
    if (type === "earn") return "earn";
    if (type === "redeem") return "redeem";
    return "";
  }

  function txPointsLabel(type, status, points) {
    if (status === "voided") return `−${Math.abs(points)} (void)`;
    if (status === "deducted") return `−${Math.abs(points)}`;
    if (status === "pending") return `+${points} (pending)`;
    if (type === "earn") return `+${points}`;
    if (type === "redeem") return `−${Math.abs(points)}`;
    return `${points > 0 ? "+" : ""}${points}`;
  }

  function txDesc(tx) {
    if (tx.note) return tx.note;
    if (tx.orderName) return `Order ${tx.orderName}`;
    if (tx.type === "earn") return "Points earned";
    if (tx.type === "redeem") return "Points redeemed";
    if (tx.type === "adjust") return "Manual adjustment";
    return "Transaction";
  }

  // ── Render: Not logged in ─────────────────────────────────────────────────
  function renderNotLoggedIn(container) {
    container.innerHTML = `
      <div class="lw-root">
        <div class="lw-not-logged-in">
          <div style="font-size:32px;margin-bottom:8px;">🔒</div>
          <p>Log in to join our loyalty program and start earning rewards.</p>
          <a href="/account/login">Log in to your account</a>
        </div>
      </div>
    `;
  }

  // ── Render: Signup ────────────────────────────────────────────────────────
  function renderSignup(container, onEnrolled) {
    container.innerHTML = `
      <div class="lw-root">
        <div class="lw-signup">
          <div class="lw-signup-badge">✦ New — Loyalty Program</div>
          <h2>Earn rewards on<br><em>every purchase</em></h2>
          <p>Join thousands of members earning points, unlocking tiers, and getting exclusive perks.</p>
          <div class="lw-perks">
            <div class="lw-perk"><span class="lw-perk-icon">⭐</span>Earn points</div>
            <div class="lw-perk"><span class="lw-perk-icon">🎯</span>Unlock tiers</div>
            <div class="lw-perk"><span class="lw-perk-icon">🎁</span>Get rewards</div>
          </div>
          <button class="lw-btn lw-btn-primary" id="lw-join-btn">Join for free</button>
          <p class="lw-signup-note">No credit card needed. Instant enrollment.</p>
        </div>
      </div>
    `;

    document.getElementById("lw-join-btn").addEventListener("click", async function () {
      const btn = this;
      btn.disabled = true;
      btn.textContent = "Joining...";

      try {
        const res = await fetch(`${APP_URL}/api/loyalty-signup`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            shop: SHOP,
            customerId: CUSTOMER_ID,
            email: window.__LOYALTY_CUSTOMER_EMAIL__ || null,
            firstName: window.__LOYALTY_CUSTOMER_FIRST_NAME__ || null,
            lastName: window.__LOYALTY_CUSTOMER_LAST_NAME__ || null,
          }),
        });

        const data = await res.json();
        if (data.success) {
          onEnrolled();
        } else {
          btn.disabled = false;
          btn.textContent = "Try again";
        }
      } catch (e) {
        btn.disabled = false;
        btn.textContent = "Try again";
        console.error("[loyalty-widget] signup error", e);
      }
    });
  }

  // ── Render: Dashboard ─────────────────────────────────────────────────────
  function renderDashboard(container, data) {
    const { customer, tierProgress, transactions, referralCode } = data;
    const tier = customer.tier || "bronze";
    const colors = TIER_COLORS[tier] || TIER_COLORS.bronze;
    const icon = TIER_ICONS[tier] || "🥉";
    const firstName = customer.firstName || "Member";

    const progressBar = tierProgress.nextTier
      ? `
        <div class="lw-progress-wrap">
          <div class="lw-progress-labels">
            <span>${icon} ${tier.charAt(0).toUpperCase() + tier.slice(1)}</span>
            <span>${TIER_ICONS[tierProgress.nextTier]} ${tierProgress.nextTier.charAt(0).toUpperCase() + tierProgress.nextTier.slice(1)}</span>
          </div>
          <div class="lw-progress-track">
            <div class="lw-progress-fill" style="width:${tierProgress.progressPercent}%;background:${colors.accent}"></div>
          </div>
          <div class="lw-progress-hint"><strong>${tierProgress.pointsToNext.toLocaleString()} pts</strong> to reach ${tierProgress.nextTier}</div>
        </div>`
      : `<div class="lw-max-tier-msg">🏆 You've reached our highest tier!</div>`;

    const txRows = transactions.length
      ? transactions.map((tx) => {
          const { emoji, bg } = txIcon(tx.type, tx.status);
          const cls = txPointsClass(tx.type, tx.status);
          return `
            <li class="lw-tx-item">
              <div class="lw-tx-icon" style="background:${bg}">${emoji}</div>
              <div class="lw-tx-meta">
                <div class="lw-tx-desc">${txDesc(tx)}</div>
                <div class="lw-tx-date">${formatDate(tx.createdAt)}</div>
              </div>
              <div class="lw-tx-pts ${cls}">${txPointsLabel(tx.type, tx.status, tx.points)}</div>
            </li>`;
        }).join("")
      : `<div class="lw-tx-empty">No transactions yet. Start shopping to earn points!</div>`;

    container.innerHTML = `
      <div class="lw-root">
        <div class="lw-dashboard">
          <div class="lw-hero" style="background:${colors.bg}">
            <div class="lw-hero-top">
              <div>
                <div class="lw-greeting">Welcome back,</div>
                <div class="lw-name">${firstName}</div>
              </div>
              <div class="lw-tier-badge" style="background:${colors.accent};color:${colors.bg}">
                ${icon} ${tier}
              </div>
            </div>
            <div class="lw-points-display">
              <div class="lw-points-number">${customer.points.toLocaleString()}</div>
              <div class="lw-points-label">points available</div>
            </div>
            ${progressBar}
          </div>

          <div class="lw-tabs">
            <button class="lw-tab active" data-panel="history">History</button>
            <button class="lw-tab" data-panel="referral">Refer a Friend</button>
          </div>

          <div class="lw-panel active" id="lw-panel-history">
            <ul class="lw-tx-list">${txRows}</ul>
          </div>

          <div class="lw-panel" id="lw-panel-referral">
            <div class="lw-referral-card">
              <div class="lw-referral-label">Refer & Earn</div>
              <div class="lw-referral-title">Share your code,<br>both of you win</div>
              <div class="lw-referral-sub">Share your unique code with friends. When they join and make their first purchase, you both earn bonus points.</div>
              <div class="lw-referral-code-row">
                <div class="lw-code-box">${referralCode}</div>
                <button class="lw-copy-btn" id="lw-copy-btn">Copy</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    // Tab switching
    container.querySelectorAll(".lw-tab").forEach((tab) => {
      tab.addEventListener("click", function () {
        container.querySelectorAll(".lw-tab").forEach((t) => t.classList.remove("active"));
        container.querySelectorAll(".lw-panel").forEach((p) => p.classList.remove("active"));
        this.classList.add("active");
        document.getElementById(`lw-panel-${this.dataset.panel}`).classList.add("active");
      });
    });

    // Copy referral code
    document.getElementById("lw-copy-btn").addEventListener("click", function () {
      navigator.clipboard.writeText(referralCode).then(() => {
        this.textContent = "Copied!";
        this.classList.add("copied");
        setTimeout(() => {
          this.textContent = "Copy";
          this.classList.remove("copied");
        }, 2000);
      });
    });
  }

  // ── Main init ─────────────────────────────────────────────────────────────
  async function init() {
    const container = document.getElementById("loyalty-widget-root");
    if (!container) return;

    injectStyles();

    // Not logged in
    if (!CUSTOMER_ID) {
      renderNotLoggedIn(container);
      return;
    }

    // Loading state
    container.innerHTML = `
      <div class="lw-root">
        <div class="lw-loading"><div class="lw-spinner"></div> Loading your rewards…</div>
      </div>`;

    try {
      const res = await fetch(
        `${APP_URL}/api/loyalty-dashboard?shop=${encodeURIComponent(SHOP)}&customerId=${encodeURIComponent(CUSTOMER_ID)}`
      );
      const data = await res.json();

      if (!data.enrolled) {
        renderSignup(container, () => init()); // re-init after signup
      } else {
        renderDashboard(container, data);
      }
    } catch (e) {
      console.error("[loyalty-widget] init error", e);
      container.innerHTML = `<div class="lw-root"><div class="lw-loading">Something went wrong. Please refresh.</div></div>`;
    }
  }

  // Run when DOM is ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
