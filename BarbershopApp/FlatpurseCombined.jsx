import { useState, useEffect, useRef, useCallback } from "react";

// ═══════════════════════════════════════════════════════════════════
// FLATPURSE FLOW — FULL APP
// Onboarding → App transition
// ═══════════════════════════════════════════════════════════════════


// ═══════════════════════════════════════════════════════════════════
// THEME
// ═══════════════════════════════════════════════════════════════════
const T = {
  light: {
    bg: "#FAF8F5", card: "#FFFFFF", border: "#EDE9E4", text: "#1E293B",
    sub: "#64748B", muted: "#94A3B8", dim: "#CBD5E1",
    accent: "#534AB7", accentSoft: "rgba(83,74,183,0.08)", accentText: "#534AB7",
    green: "#22C55E", greenBg: "#DCFCE7", greenText: "#16A34A",
    yellow: "#F59E0B", yellowBg: "#FEF3C7", yellowText: "#D97706",
    pink: "#FDA4AF", pinkBg: "#FFF1F2", pinkText: "#BE123C",
    blue: "#3B82F6", blueBg: "#EFF6FF", blueText: "#2563EB",
    orange: "#F97316", orangeBg: "#FFF7ED", orangeText: "#C2410C",
    navBg: "#FAF8F5", navBorder: "#EDE9E4",
    statusBar: "#1E293B", deviceBorder: "#E8E4DF",
    shadow: "0 1px 3px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.02)",
    inputBg: "#F5F2EE",
  },
  dark: {
    bg: "#0A0F1A", card: "#111827", border: "#1E293B", text: "#E2E8F0",
    sub: "#94A3B8", muted: "#64748B", dim: "#475569",
    accent: "#8B6CFF", accentSoft: "rgba(139,108,255,0.12)", accentText: "#C4B5FD",
    green: "#34D399", greenBg: "rgba(52,211,153,0.15)", greenText: "#34D399",
    yellow: "#FBBF24", yellowBg: "rgba(251,191,36,0.12)", yellowText: "#FBBF24",
    pink: "#FB7185", pinkBg: "rgba(251,113,133,0.1)", pinkText: "#FB7185",
    blue: "#60A5FA", blueBg: "rgba(96,165,250,0.12)", blueText: "#60A5FA",
    orange: "#FB923C", orangeBg: "rgba(249,115,22,0.12)", orangeText: "#FB923C",
    navBg: "#0A0F1A", navBorder: "#1E293B",
    statusBar: "#E2E8F0", deviceBorder: "#1E293B",
    shadow: "0 1px 3px rgba(0,0,0,0.2), 0 4px 16px rgba(0,0,0,0.1)",
    inputBg: "#1E293B",
  },
};

const f = "'DM Sans','Instrument Sans',sans-serif";

// ── Service Worker registration ─────────────────────────────────────
if (typeof window !== "undefined" && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}

// ── IndexedDB offline queue ──────────────────────────────────────────
const IDB_NAME = "fpf-offline";
const IDB_STORE = "sync_queue";

function openOfflineDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(IDB_STORE))
        db.createObjectStore(IDB_STORE, { keyPath: "id", autoIncrement: true });
    };
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = (e) => reject(e.target.error);
  });
}

async function queueOfflineOp(type, payload) {
  try {
    const db = await openOfflineDB();
    await new Promise((res, rej) => {
      const tx = db.transaction(IDB_STORE, "readwrite");
      tx.objectStore(IDB_STORE).add({ type, payload, ts: Date.now() });
      tx.oncomplete = res;
      tx.onerror = (e) => rej(e.target.error);
    });
  } catch {}
}

async function flushOfflineQueue() {
  try {
    const db = await openOfflineDB();
    const items = await new Promise((res, rej) => {
      const tx = db.transaction(IDB_STORE, "readonly");
      const req = tx.objectStore(IDB_STORE).getAll();
      req.onsuccess = (e) => res(e.target.result);
      req.onerror = (e) => rej(e.target.error);
    });
    if (!items.length) return;
    const r = await fetch("/api/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items }),
    });
    if (r.ok) {
      const tx = (await openOfflineDB()).transaction(IDB_STORE, "readwrite");
      tx.objectStore(IDB_STORE).clear();
    }
  } catch {}
}

// ── Online status hook ───────────────────────────────────────────────
function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );
  useEffect(() => {
    const up = () => { setIsOnline(true); flushOfflineQueue(); };
    const down = () => setIsOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, []);
  return isOnline;
}

// ── Deposit rules engine ─────────────────────────────────────────────
function getDepositRule(client) {
  if (!client) return { required: false, recommended: false, reason: null };
  const noShowCount = client.noShowCount ??
    (client.visits_data || []).filter(v => v.status === "no-show").length;
  if (noShowCount >= 2) return { required: true, recommended: true, reason: "2+ no-shows" };
  if ((client.visits === 0 || (client.visits_data || []).length === 0) && !client.savedCard)
    return { required: false, recommended: true, reason: "new-client" };
  return { required: false, recommended: false, reason: null };
}

// ── Standalone logo mark — unique gradient ID per render instance ──
let _logoCount = 0;
function FlatpurseLogo({ size = 44 }) {
  const id = useRef("fpg" + (++_logoCount)).current;
  const h = Math.round(size * 80 / 110);
  return (
    <svg width={size} height={h} viewBox="0 0 110 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="110" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#8B30FF"/>
          <stop offset="50%" stopColor="#D93080"/>
          <stop offset="100%" stopColor="#FF4500"/>
        </linearGradient>
      </defs>
      <path d="M58 6 L28 6 Q6 6 6 40 Q6 74 28 74 L58 74" stroke={`url(#${id})`} strokeWidth="9" strokeLinecap="round" strokeLinejoin="round"/>
      <line x1="66" y1="6" x2="66" y2="74" stroke={`url(#${id})`} strokeWidth="9" strokeLinecap="round"/>
      <path d="M66 6 L88 6 Q104 6 104 22 L104 34 Q104 40 88 40 L66 40" stroke={`url(#${id})`} strokeWidth="9" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M66 40 L88 40 Q104 40 104 54 L104 62 Q104 74 88 74 L66 74" stroke={`url(#${id})`} strokeWidth="9" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

// ═══════════════════════════════════════════════════════════════════
// TOGGLE SWITCH
// ═══════════════════════════════════════════════════════════════════
function Toggle({ on, onToggle, t }) {
  return (
    <div onClick={onToggle} style={{
      width: 48, height: 28, borderRadius: 14, position: "relative", cursor: "pointer", flexShrink: 0,
      background: on ? t.accent : t.inputBg,
      border: `1.5px solid ${on ? t.accent : t.border}`,
      transition: "background 0.25s, border-color 0.25s",
    }}>
      <div style={{
        width: 22, height: 22, borderRadius: 11, position: "absolute", top: 2,
        left: on ? 22 : 2,
        background: on ? "#fff" : t.muted,
        transition: "left 0.25s",
        boxShadow: "0 1px 4px rgba(0,0,0,0.18)",
      }} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// ANIMATED COUNTER
// ═══════════════════════════════════════════════════════════════════
function AnimCount({ target, dur = 1200 }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    const s = performance.now();
    const tick = (n) => {
      const p = Math.min((n - s) / dur, 1);
      setV(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [target, dur]);
  return <>{v.toLocaleString()}</>;
}

// ═══════════════════════════════════════════════════════════════════
// CIRCULAR SCORE (Operations)
// ═══════════════════════════════════════════════════════════════════
function CircularScore({ score, t }) {
  const r = 54, circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  const color = score >= 80 ? t.green : score >= 60 ? t.yellow : t.orange;
  return (
    <svg width="128" height="128" viewBox="0 0 128 128">
      <circle cx="64" cy="64" r={r} fill="none" stroke={t.border} strokeWidth="10" />
      <circle cx="64" cy="64" r={r} fill="none" stroke={color} strokeWidth="10"
        strokeLinecap="round" strokeDasharray={`${dash} ${circ}`}
        transform="rotate(-90 64 64)" style={{ transition: "stroke-dasharray 1s ease" }} />
      <text x="64" y="56" textAnchor="middle" fill={t.text} fontSize="24" fontWeight="800" fontFamily={f}>{score}</text>
      <text x="64" y="76" textAnchor="middle" fill={t.sub} fontSize="11" fontWeight="600" fontFamily={f}>/100</text>
    </svg>
  );
}

// ═══════════════════════════════════════════════════════════════════
// CUSTOMER DETAIL SCREEN
// ═══════════════════════════════════════════════════════════════════



// ═══════════════════════════════════════════════════════════════════
// CLIENT DATA
// ═══════════════════════════════════════════════════════════════════
const CLIENTS_DB = [
  {
    id: "SJ001", initials: "SJ", color: "#534AB7",
    name: "Sarah Johnson", phone: "+1 555 123 4567", email: "sarah.j@email.com",
    address: "142 Whyte Ave, Edmonton AB T6E 2A3",
    birthday: "March 14",
    customerSince: "Jan 2022",
    preferred: "Emma Davis",
    tags: ["VIP", "High Spender"],
    ltv: 4200, visits: 24, avgSpend: 118,
    lastVisit: "Apr 12", nextApt: "May 8 · 10:00 AM",
    churnRisk: "low", upsellProb: "high",
    notes: "Allergic to sulfates. Prefers cooler water. Likes ash blonde — see last visit photos. Birthday: March 14.",
    aiInsight: "Books every 4–5 weeks like clockwork. Highest tip rate of any client. Likely to upgrade to balayage if offered.",
    aiChips: ["Due back in 5 days", "Upsell ready"],
    visits_data: [
      { service: "Hair Styling", date: "Apr 12", staff: "Emma", duration: "1.5 hr", price: 125, tip: 22, status: "completed" },
      { service: "Hair Styling + Treatment", date: "Mar 8", staff: "Emma", duration: "2 hr", price: 165, tip: 25, status: "completed" },
      { service: "Hair Styling", date: "Feb 4", staff: "Emma", duration: "1.5 hr", price: 125, tip: 20, status: "completed" },
      { service: "Balayage", date: "Jan 14", staff: "Emma", duration: "3 hr", price: 285, tip: 45, status: "completed" },
      { service: "Hair Styling", date: "Dec 18", staff: "Emma", duration: "1.5 hr", price: 125, tip: 22, status: "completed" },
    ],
    messages: [
      { from: "ai", text: "Hi Sarah! Emma has an opening Thu May 8 at 11:30 AM — want to grab it? 💇‍♀️", time: "Mon 9:02 AM" },
      { from: "client", text: "Yes please! See you then 🙌", time: "Mon 9:14 AM" },
      { from: "ai", text: "You're booked! Confirmation sent. Reply CANCEL to cancel (no charge before 24hrs).", time: "Mon 9:14 AM" },
    ],
    payments: [
      { date: "Apr 12", service: "Hair Styling", amount: 125, tip: 22, method: "Visa ····4242", status: "paid" },
      { date: "Mar 8", service: "Hair Styling + Treatment", amount: 165, tip: 25, method: "Visa ····4242", status: "paid" },
      { date: "Feb 4", service: "Hair Styling", amount: 125, tip: 20, method: "Visa ····4242", status: "paid" },
    ],
    savedCard: { brand: "Visa", last4: "4242", exp: "12/26", type: "Credit" },
    staffNotes: [
      { author: "Emma", time: "Apr 12 · post-service", text: "Client loved the ash tone. Suggested balayage for next visit — she seemed very interested.", pinned: true },
      { author: "Marcus", time: "Jan 14", text: "Balayage took 3 hrs, she was patient. Booked back immediately for Apr.", pinned: false },
    ],
    automations: [
      { type: "Rebooking reminder", status: "active", nextRun: "May 13" },
      { type: "Birthday offer", status: "active", nextRun: "Mar 9" },
      { type: "Win-back (30-day)", status: "standby", nextRun: "—" },
    ],
  },
  {
    id: "MC002", initials: "MC", color: "#0891B2",
    name: "Michael Chen", phone: "+1 587 445 2201", email: "m.chen@email.com",
    address: "88 Jasper Ave, Edmonton AB T5J 1W5",
    birthday: "July 22",
    customerSince: "Sep 2023",
    preferred: "Marcus Johnson",
    tags: ["New Client"],
    ltv: 360, visits: 8, avgSpend: 45,
    lastVisit: "Apr 8", nextApt: "—",
    churnRisk: "medium", upsellProb: "medium",
    notes: "Prefers shorter sides. Likes a skin fade. Always on time.",
    aiInsight: "8 visits in 7 months — solid frequency. Add-on potential with beard services. Consider a loyalty offer.",
    aiChips: ["Rebook overdue", "Beard upsell"],
    visits_data: [
      { service: "Signature Cut", date: "Apr 8", staff: "Marcus", duration: "45 min", price: 45, tip: 8, status: "completed" },
      { service: "Cut + Beard", date: "Mar 2", staff: "Marcus", duration: "60 min", price: 65, tip: 10, status: "completed" },
      { service: "Signature Cut", date: "Feb 10", staff: "Marcus", duration: "45 min", price: 45, tip: 8, status: "completed" },
    ],
    messages: [
      { from: "ai", text: "Hey Michael! You're due for a cut — want to grab a slot with Marcus this week?", time: "Apr 25 9:00 AM" },
      { from: "client", text: "Maybe next week, I'll reach out", time: "Apr 25 10:12 AM" },
    ],
    payments: [
      { date: "Apr 8", service: "Signature Cut", amount: 45, tip: 8, method: "Mastercard ····8801", status: "paid" },
    ],
    savedCard: { brand: "Mastercard", last4: "8801", exp: "09/27", type: "Debit" },
    staffNotes: [
      { author: "Marcus", time: "Mar 2", text: "Tried the beard trim for the first time — really liked it. Upsell candidate.", pinned: false },
    ],
    automations: [
      { type: "Rebooking reminder", status: "active", nextRun: "May 15" },
      { type: "Win-back (30-day)", status: "active", nextRun: "May 8" },
    ],
  },
  {
    id: "LP003", initials: "LP", color: "#DB2777",
    name: "Lisa Park", phone: "+1 780 227 8841", email: "lisa.park@email.com",
    address: "310 Glenora, Edmonton AB T5N 1C8",
    birthday: "Nov 3",
    customerSince: "Mar 2021",
    preferred: "Emma Davis",
    tags: ["VIP", "Inactive"],
    ltv: 4800, visits: 19, avgSpend: 135,
    lastVisit: "Feb 28", nextApt: "—",
    churnRisk: "high", upsellProb: "low",
    notes: "Known for precise colour work. Likes being updated on new trends. Went quiet after last visit — may have tried another salon.",
    aiInsight: "67 days since last visit — well above her 28-day average. High churn risk. A personalized win-back with an exclusive offer is recommended now.",
    aiChips: ["Win-back ready", "High churn risk"],
    visits_data: [
      { service: "Balayage + Treatment", date: "Feb 28", staff: "Emma", duration: "3.5 hr", price: 310, tip: 40, status: "completed" },
      { service: "Hair Styling", date: "Jan 30", staff: "Emma", duration: "1.5 hr", price: 125, tip: 20, status: "completed" },
      { service: "Balayage", date: "Dec 5", staff: "Emma", duration: "3 hr", price: 285, tip: 35, status: "completed" },
    ],
    messages: [
      { from: "ai", text: "Hi Lisa, it's been a while! We'd love to see you back. Emma has a Balayage slot open May 14 — want to grab it? We'll take 15% off.", time: "Apr 30 9:00 AM" },
    ],
    payments: [
      { date: "Feb 28", service: "Balayage + Treatment", amount: 310, tip: 40, method: "Visa ····9901", status: "paid" },
    ],
    savedCard: { brand: "Visa", last4: "9901", exp: "03/28", type: "Credit" },
    staffNotes: [
      { author: "Emma", time: "Feb 28 · post-service", text: "Lisa seemed a bit quiet. Said she was 'trying some different things' — could mean she's shopping around. Follow up soon.", pinned: true },
    ],
    automations: [
      { type: "Win-back (67-day)", status: "active", nextRun: "today" },
      { type: "Birthday offer", status: "active", nextRun: "Nov 1" },
    ],
  },
  {
    id: "EW004", initials: "EW", color: "#16A34A",
    name: "Emma Wilson", phone: "+1 780 334 5512", email: "ewilson@email.com",
    address: "55 Bonnie Doon, Edmonton AB",
    birthday: "Aug 19",
    customerSince: "Jun 2022",
    preferred: "Anyone",
    tags: [],
    ltv: 1440, visits: 12, avgSpend: 85,
    lastVisit: "Apr 2", nextApt: "May 8 · 2:00 PM",
    churnRisk: "low", upsellProb: "medium",
    notes: "Books every 5–6 weeks. Fine with any staff. Happy with whatever's available.",
    aiInsight: "Consistent mid-tier spender. No signs of churn. Could be upsold on a treatment add-on — she's never tried one.",
    aiChips: ["Treatment upsell"],
    visits_data: [
      { service: "Facial", date: "Apr 2", staff: "John", duration: "1 hr", price: 85, tip: 10, status: "completed" },
      { service: "Facial", date: "Feb 22", staff: "Emma", duration: "1 hr", price: 85, tip: 10, status: "completed" },
    ],
    messages: [],
    payments: [
      { date: "Apr 2", service: "Facial", amount: 85, tip: 10, method: "Amex ····0012", status: "paid" },
    ],
    savedCard: { brand: "Amex", last4: "0012", exp: "06/26", type: "Credit" },
    staffNotes: [],
    automations: [{ type: "Rebooking reminder", status: "active", nextRun: "May 14" }],
  },
  {
    id: "JB005", initials: "JB", color: "#D97706",
    name: "James Brown", phone: "+1 587 991 0034", email: "jbrown@email.com",
    address: "",
    birthday: "",
    customerSince: "Dec 2023",
    preferred: "John Torres",
    tags: ["New Client"],
    ltv: 135, visits: 3, avgSpend: 45,
    lastVisit: "Mar 20", nextApt: "—",
    churnRisk: "medium", upsellProb: "low",
    notes: "Walk-in converted to regular. Only 3 visits. Keep nurturing.",
    aiInsight: "Early-stage client. 3 visits in 5 months — below expected frequency. A gentle rebooking nudge could lock him in.",
    aiChips: ["Rebook nudge"],
    visits_data: [
      { service: "Signature Cut", date: "Mar 20", staff: "John", duration: "45 min", price: 45, tip: 5, status: "completed" },
      { service: "Signature Cut", date: "Feb 1", staff: "John", duration: "45 min", price: 45, tip: 5, status: "completed" },
      { service: "Signature Cut", date: "Jan 5", staff: "John", duration: "45 min", price: 45, tip: 0, status: "no-show" },
      { service: "Signature Cut", date: "Dec 10", staff: "John", duration: "45 min", price: 45, tip: 0, status: "no-show" },
    ],
    messages: [],
    payments: [],
    savedCard: null,
    staffNotes: [],
    automations: [{ type: "Rebooking reminder", status: "active", nextRun: "May 20" }],
  },
];

const TAG_STYLES = {
  "VIP":               { bg: "#FEF3C7", color: "#B45309", border: "#FDE68A" },
  "High Spender":      { bg: "#EDE9FE", color: "#6D28D9", border: "#DDD6FE" },
  "New Client":        { bg: "#DCFCE7", color: "#166534", border: "#BBF7D0" },
  "Inactive":          { bg: "#FEE2E2", color: "#991B1B", border: "#FECACA" },
  "Frequent Canceller":{ bg: "#FFF7ED", color: "#9A3412", border: "#FED7AA" },
};

// ═══════════════════════════════════════════════════════════════════
// CLIENT LIST SCREEN
// ═══════════════════════════════════════════════════════════════════
function ClientsScreen({ t, onSelectClient }) {
  const [search, setSearch] = useState("");
  const [filterTag, setFilterTag] = useState("All");

  const tags = ["All", "VIP", "New Client", "Inactive", "High Spender"];

  const filtered = CLIENTS_DB.filter(c => {
    const q = search.toLowerCase().trim();
    const matchSearch = q.length === 0 ||
      c.name.toLowerCase().includes(q) ||
      (c.phone || "").toLowerCase().includes(q) ||
      (c.email || "").toLowerCase().includes(q) ||
      (c.id || "").toLowerCase().includes(q);
    const matchTag = filterTag === "All" || c.tags.includes(filterTag);
    return matchSearch && matchTag;
  });

  const ChurnDot = ({ risk }) => {
    const colors = { low: "#22C55E", medium: "#F59E0B", high: "#EF4444" };
    return <div style={{ width: 8, height: 8, borderRadius: "50%", background: colors[risk] || t.muted, flexShrink: 0 }} />;
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Search bar */}
      <div style={{ padding: "0 20px 12px", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", borderRadius: 12, background: t.inputBg, border: `1px solid ${t.border}` }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={t.muted} strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, phone, or email"
            style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontSize: 14, color: t.text, fontFamily: f }}
          />
          {search.length > 0 && (
            <button onClick={() => setSearch("")} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", alignItems: "center" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={t.muted} strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          )}
        </div>
      </div>

      {/* Tag filter chips — horizontal scroll */}
      {/* paddingRight on max-content children is eaten by overflow:auto in WebKit.
          Fix: left-pad the outer container to 20px, then add a 20px invisible spacer
          as the last child so the final chip always has breathing room on scroll. */}
      <div style={{ paddingBottom: 12, paddingLeft: 20, flexShrink: 0, overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
        <div style={{ display: "flex", gap: 6, width: "max-content" }}>
          {tags.map(tag => {
            const on = filterTag === tag;
            return (
              <button key={tag} onClick={() => setFilterTag(tag)} style={{ padding: "6px 13px", borderRadius: 20, border: `1.5px solid ${on ? t.accent : t.border}`, background: on ? t.accent : t.card, color: on ? "#fff" : t.text, fontSize: 12, fontWeight: on ? 700 : 500, cursor: "pointer", fontFamily: f, whiteSpace: "nowrap", transition: "all 0.15s" }}>
                {tag}
              </button>
            );
          })}
          {/* Trailing spacer — ensures last chip never clips at the scroll edge */}
          <div style={{ width: 20, flexShrink: 0 }} />
        </div>
      </div>

      {/* Count */}
      <div style={{ padding: "0 20px 10px", fontSize: 11, fontWeight: 700, letterSpacing: 1.2, color: t.muted, flexShrink: 0 }}>
        {filtered.length} CLIENT{filtered.length !== 1 ? "S" : ""}
      </div>

      {/* Client list */}
      <div style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch", padding: "0 20px 20px" }}>
        {filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "48px 20px", color: t.muted }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>🔍</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: t.text, marginBottom: 6 }}>No clients found</div>
            <div style={{ fontSize: 13, color: t.sub }}>Try a different search or filter</div>
          </div>
        ) : filtered.map((client) => (
          <div
            key={client.id}
            onClick={() => onSelectClient(client)}
            style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 16px", borderRadius: 16, background: t.card, border: `1px solid ${t.border}`, marginBottom: 8, cursor: "pointer", boxShadow: t.shadow, transition: "all 0.15s" }}>
            {/* Avatar */}
            <div style={{ position: "relative", flexShrink: 0 }}>
              <div style={{ width: 48, height: 48, borderRadius: 24, background: client.color, color: "#fff", fontSize: 15, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>
                {client.initials}
              </div>
              <ChurnDot risk={client.churnRisk} />
              <div style={{ position: "absolute", bottom: -1, right: -1, width: 14, height: 14, borderRadius: "50%", background: client.churnRisk === "high" ? "#EF4444" : client.churnRisk === "medium" ? "#F59E0B" : "#22C55E", border: `2px solid ${t.card}` }} />
            </div>
            {/* Info */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3, flexWrap: "nowrap", overflow: "hidden" }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: t.text, whiteSpace: "nowrap" }}>{client.name}</span>
                {client.tags.includes("VIP") && <span style={{ fontSize: 9, fontWeight: 700, padding: "1px 6px", borderRadius: 20, background: "#FEF3C7", color: "#B45309", flexShrink: 0 }}>VIP</span>}
                {client.tags.includes("Inactive") && <span style={{ fontSize: 9, fontWeight: 700, padding: "1px 6px", borderRadius: 20, background: "#FEE2E2", color: "#991B1B", flexShrink: 0 }}>Inactive</span>}
              </div>
              <div style={{ fontSize: 12, color: t.sub, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {client.visits} visits · ${client.ltv.toLocaleString()} LTV · Last: {client.lastVisit}
              </div>
            </div>
            {/* Right — avg spend + chevron */}
            <div style={{ flexShrink: 0, textAlign: "right", minWidth: 56 }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: t.text }}>${client.avgSpend}</div>
              <div style={{ fontSize: 10, color: t.muted, marginTop: 2 }}>/visit</div>
            </div>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={t.dim} strokeWidth="2.5" strokeLinecap="round" style={{ flexShrink: 0 }}><path d="M9 18l6-6-6-6"/></svg>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// CUSTOMER DETAIL SCREEN (full rebuild)
// ═══════════════════════════════════════════════════════════════════
// VISIT_HISTORY removed — data lives in CLIENTS_DB.visits_data

function CustomerDetailScreen({ t, onClose, onBook, client }) {
  const [activeTab, setActiveTab] = useState("Overview");
  const [noteSent, setNoteSent] = useState(false);
  const [newNote, setNewNote] = useState("");
  const [chargeDone, setChargeDone] = useState(false);
  const [winbackSent, setWinbackSent] = useState(false); // false | "sending" | true
  const [addingNote, setAddingNote] = useState(false);

  const c = client || CLIENTS_DB[0];
  const visits = c.visits_data || [];

  const ChurnBadge = ({ risk }) => {
    const map = { low: ["Low risk","#22C55E","#DCFCE7"], medium: ["Monitor","#D97706","#FEF3C7"], high: ["Churn risk","#DC2626","#FEE2E2"] };
    const [label, color, bg] = map[risk] || ["—", t.muted, t.inputBg];
    return <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 20, background: bg, color, border: `1px solid ${color}20` }}>{label}</span>;
  };

  const TABS = ["Overview", "History", "Wallet", "Prefs", "AI", "Notes"];

  const SL = ({ children }) => (
    <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.4, color: t.muted, marginBottom: 10, marginTop: 4 }}>{children}</div>
  );

  const Row = ({ icon, label, value, last }) => (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderBottom: last ? "none" : `1px solid ${t.border}` }}>
      <span style={{ fontSize: 15, flexShrink: 0 }}>{icon}</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 11, color: t.muted, marginBottom: 1 }}>{label}</div>
        <div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{value || "—"}</div>
      </div>
    </div>
  );

  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 300, borderRadius: 41, overflow: "hidden", background: t.bg, display: "flex", flexDirection: "column", animation: "slideUp 0.32s cubic-bezier(0.32,0.72,0,1) both" }}>
      {/* Status bar */}
      <div style={{ display: "flex", justifyContent: "space-between", padding: "14px 28px 0", height: 36, flexShrink: 0 }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: t.statusBar }}>9:42 AM</span>
      </div>

      {/* Nav */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 20px 12px", flexShrink: 0 }}>
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", padding: 4, display: "flex" }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={t.text} strokeWidth="2.5" strokeLinecap="round"><path d="M15 18l-6-6 6-6"/></svg>
        </button>
        <div style={{ fontSize: 17, fontWeight: 700, color: t.text }}>Client Profile</div>
        <button style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={t.text} strokeWidth="2" strokeLinecap="round">
            <circle cx="12" cy="5" r="1" fill={t.text}/><circle cx="12" cy="12" r="1" fill={t.text}/><circle cx="12" cy="19" r="1" fill={t.text}/>
          </svg>
        </button>
      </div>

      {/* ── HERO ── */}
      <div style={{ padding: "0 20px 14px", borderBottom: `1px solid ${t.border}`, flexShrink: 0 }}>
        {/* Avatar + identity */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 14, marginBottom: 12 }}>
          <div style={{ position: "relative", flexShrink: 0 }}>
            <div style={{ width: 58, height: 58, borderRadius: 29, background: c.color, color: "#fff", fontSize: 20, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>{c.initials}</div>
            {c.tags.includes("VIP") && <div style={{ position: "absolute", bottom: -2, right: -2, width: 20, height: 20, borderRadius: 10, background: "#F59E0B", border: `2px solid ${t.bg}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10 }}>⭐</div>}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: t.text, letterSpacing: -0.4, marginBottom: 3 }}>{c.name}</div>
            <div style={{ fontSize: 11, color: t.muted, marginBottom: 6 }}>#{c.id} · Since {c.customerSince}</div>
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
              {c.tags.map(tag => {
                const s = TAG_STYLES[tag] || { bg: t.inputBg, color: t.sub, border: t.border };
                return <span key={tag} style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: s.bg, color: s.color, border: `1px solid ${s.border}` }}>{tag}</span>;
              })}
              <ChurnBadge risk={c.churnRisk} />
            </div>
          </div>
        </div>

        {/* 4-stat strip */}
        <div style={{ display: "flex", borderRadius: 12, background: t.inputBg, overflow: "hidden", border: `1px solid ${t.border}`, marginBottom: 12 }}>
          {[
            { label: "LTV", value: `$${c.ltv >= 1000 ? (c.ltv/1000).toFixed(1)+"k" : c.ltv}` },
            { label: "VISITS", value: String(c.visits) },
            { label: "AVG/VISIT", value: `$${c.avgSpend}` },
            { label: "LAST VISIT", value: c.lastVisit },
          ].map((s, i) => (
            <div key={i} style={{ flex: 1, padding: "10px 0", display: "flex", flexDirection: "column", alignItems: "center", borderRight: i < 3 ? `1px solid ${t.border}` : "none" }}>
              <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: 1.2, color: t.muted, marginBottom: 3 }}>{s.label}</div>
              <div style={{ fontSize: 15, fontWeight: 800, color: t.text }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Quick actions — 6 buttons */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 6 }}>
          {[
            { label: "Book", primary: true, onClick: onBook, icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="12" y1="14" x2="12" y2="18"/><line x1="10" y1="16" x2="14" y2="16"/></svg> },
            { label: "SMS", icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={t.text} strokeWidth="2.5" strokeLinecap="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg> },
            { label: "Call", icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={t.text} strokeWidth="2.5" strokeLinecap="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.11 12 19.79 19.79 0 0 1 1.04 3.4 2 2 0 0 1 3 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg> },
            { label: "Email", icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={t.text} strokeWidth="2.5" strokeLinecap="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg> },
            { label: "Charge", onClick: () => setChargeDone(!chargeDone), icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={t.text} strokeWidth="2.5" strokeLinecap="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg> },
            { label: "Note", onClick: () => { setActiveTab("Notes"); setAddingNote(true); }, icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={t.text} strokeWidth="2.5" strokeLinecap="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg> },
          ].map((btn, i) => (
            <button key={i} onClick={btn.onClick} style={{ padding: "9px 2px 8px", borderRadius: 10, background: btn.primary ? t.accent : t.card, border: btn.primary ? "none" : `1px solid ${t.border}`, cursor: "pointer", fontFamily: f, fontSize: 9, fontWeight: 700, color: btn.primary ? "#fff" : t.text, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              {btn.icon}
              {btn.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── TAB BAR ── */}
      <div style={{ display: "flex", borderBottom: `1px solid ${t.border}`, flexShrink: 0, background: t.bg, overflowX: "auto" }}>
        {TABS.map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{ flex: 1, padding: "10px 4px", fontSize: 11, fontWeight: activeTab===tab?700:500, color: activeTab===tab?t.accent:t.muted, background: "none", border: "none", cursor: "pointer", fontFamily: f, borderBottom: activeTab===tab?`2.5px solid ${t.accent}`:"2.5px solid transparent", whiteSpace: "nowrap", minWidth: 52, transition: "all 0.15s" }}>
            {tab}
          </button>
        ))}
      </div>

      {/* ── CONTENT ── */}
      <div style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch" }}>

        {/* ─── OVERVIEW ─── */}
        {activeTab === "Overview" && (
          <div style={{ padding: "14px 20px 28px" }}>
            {/* Next appointment */}
            <div style={{ padding: "12px 16px", borderRadius: 13, background: c.nextApt !== "—" ? t.greenBg : t.inputBg, border: `1px solid ${c.nextApt !== "—" ? t.green+"20" : t.border}`, marginBottom: 12, display: "flex", alignItems: "center", gap: 12 }}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={c.nextApt !== "—" ? t.greenText : t.muted} strokeWidth="2" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: c.nextApt !== "—" ? t.greenText : t.muted, letterSpacing: 1.2 }}>NEXT APPOINTMENT</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: t.text }}>{c.nextApt !== "—" ? c.nextApt : "None scheduled"}</div>
              </div>
              {c.nextApt === "—" && (
                <button onClick={onBook} style={{ padding: "6px 14px", borderRadius: 9, background: t.accent, border: "none", cursor: "pointer", fontFamily: f, fontSize: 12, fontWeight: 700, color: "#fff" }}>Book →</button>
              )}
            </div>

            {/* AI Insights */}
            <div style={{ padding: "13px 16px", borderRadius: 13, background: t.accentSoft, border: `1px solid ${t.accent}20`, marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 7 }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill={t.accent}><path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/></svg>
                <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1.4, color: t.accentText }}>AI INSIGHT</span>
              </div>
              <div style={{ fontSize: 13, color: t.text, lineHeight: 1.65, marginBottom: 10 }}>{c.aiInsight}</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {c.aiChips.map(chip => (
                  <button key={chip} style={{ padding: "4px 11px", borderRadius: 20, background: t.card, border: `1px solid ${t.accent}30`, fontSize: 11, fontWeight: 700, color: t.accentText, cursor: "pointer", fontFamily: f }}>{chip} →</button>
                ))}
              </div>
            </div>

            {/* Client notes */}
            {c.notes && (
              <div style={{ padding: "13px 16px", borderRadius: 13, background: t.yellowBg, border: `1px solid ${t.yellow}20`, marginBottom: 12 }}>
                <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1.4, color: t.yellowText, marginBottom: 6 }}>CLIENT NOTES</div>
                <div style={{ fontSize: 13, color: t.text, lineHeight: 1.65 }}>{c.notes}</div>
              </div>
            )}

            {/* Contact */}
            <SL>CONTACT</SL>
            <div style={{ borderRadius: 13, background: t.card, border: `1px solid ${t.border}`, overflow: "hidden", marginBottom: 12 }}>
              <Row icon="📞" label="Phone" value={c.phone} />
              <Row icon="✉️" label="Email" value={c.email} />
              <Row icon="📅" label="Birthday" value={c.birthday} />
              <Row icon="👤" label="Preferred staff" value={c.preferred} />
              <Row icon="🏠" label="Address" value={c.address} last />
            </div>

            {/* Revenue Intelligence */}
            <SL>REVENUE INTELLIGENCE</SL>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {[
                { label: "Lifetime Value",   val: `$${c.ltv.toLocaleString()}`,                    color: t.accentText, bg: t.accentSoft },
                { label: "Avg Ticket",       val: `$${c.avgSpend}`,                               color: t.greenText, bg: t.greenBg },
                { label: "Upsell Prob.",     val: c.upsellProb === "high" ? "🔥 High" : c.upsellProb === "medium" ? "⚡ Medium" : "— Low", color: t.text, bg: t.inputBg },
                { label: "Churn Risk",       val: c.churnRisk === "high" ? "🔴 High" : c.churnRisk === "medium" ? "🟡 Medium" : "🟢 Low", color: t.text, bg: t.inputBg },
              ].map((m, i) => (
                <div key={i} style={{ padding: "11px 13px", borderRadius: 12, background: m.bg, border: `1px solid ${t.border}` }}>
                  <div style={{ fontSize: 10, color: t.muted, marginBottom: 4, fontWeight: 600 }}>{m.label}</div>
                  <div style={{ fontSize: 17, fontWeight: 800, color: m.color }}>{m.val}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ─── HISTORY ─── */}
        {activeTab === "History" && (
          <div style={{ padding: "14px 20px 28px" }}>
            {/* Upcoming */}
            {c.nextApt !== "—" && (
              <>
                <SL>UPCOMING</SL>
                <div style={{ padding: "12px 16px", borderRadius: 13, background: t.greenBg, border: `1px solid ${t.green}20`, marginBottom: 14, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: t.text }}>{c.nextApt.split("·")[0]}</div>
                    <div style={{ fontSize: 11, color: t.sub }}>{c.nextApt.split("·")[1] || ""}</div>
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 9px", borderRadius: 20, background: "#fff", color: t.greenText }}>Confirmed</span>
                </div>
              </>
            )}

            {/* Past visits */}
            <SL>PAST VISITS</SL>
            {visits.length === 0 ? (
              <div style={{ textAlign: "center", padding: "24px 0", color: t.muted, fontSize: 13 }}>No visit history yet</div>
            ) : visits.map((v, i) => (
              <div key={i} style={{ padding: "12px 0", borderBottom: i < visits.length-1 ? `1px solid ${t.border}` : "none" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 3 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: t.text }}>{v.service}</div>
                    <div style={{ fontSize: 12, color: t.sub }}>{v.date} · {v.staff} · {v.duration}</div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 10 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: t.text }}>${v.price}</div>
                    {v.tip > 0 && <div style={{ fontSize: 11, fontWeight: 700, color: t.greenText }}>${v.tip} tip</div>}
                  </div>
                </div>
              </div>
            ))}

            {/* Messages */}
            {c.messages && c.messages.length > 0 && (
              <>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.4, color: t.muted, marginBottom: 10, marginTop: 20 }}>MESSAGES</div>
                {c.messages.map((msg, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: msg.from==="client"?"flex-end":"flex-start", marginBottom: 8 }}>
                    <div style={{ maxWidth: "80%", padding: "9px 13px", borderRadius: 14, background: msg.from==="client"?t.accent:t.card, border: msg.from==="client"?"none":`1px solid ${t.border}`, color: msg.from==="client"?"#fff":t.text, fontSize: 13, lineHeight: 1.5, borderBottomRightRadius: msg.from==="client"?4:14, borderBottomLeftRadius: msg.from==="ai"?4:14 }}>
                      {msg.from==="ai" && <div style={{ fontSize: 9, fontWeight: 700, color: t.accentText, marginBottom: 3 }}>AI FRONT DESK</div>}
                      {msg.text}
                      <div style={{ fontSize: 10, color: msg.from==="client"?"rgba(255,255,255,0.5)":t.dim, marginTop: 3 }}>{msg.time}</div>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        )}

        {/* ─── WALLET ─── */}
        {activeTab === "Wallet" && (
          <div style={{ padding: "14px 20px 28px" }}>
            <SL>SAVED PAYMENT METHOD</SL>
            {c.savedCard ? (
              <div style={{ padding: "18px 18px 16px", borderRadius: 16, background: "linear-gradient(135deg,#1E1B4B,#312E81)", marginBottom: 16, position: "relative", overflow: "hidden" }}>
                <div style={{ position: "absolute", top: -20, right: -20, width: 120, height: 120, borderRadius: "50%", background: "rgba(255,255,255,0.04)" }} />
                <div style={{ position: "absolute", bottom: -30, left: -10, width: 100, height: 100, borderRadius: "50%", background: "rgba(255,255,255,0.03)" }} />
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 18 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.5)", letterSpacing: 1 }}>{c.savedCard.type?.toUpperCase() || "CARD"}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.8)" }}>{c.savedCard.brand}</span>
                </div>
                <div style={{ fontSize: 20, fontWeight: 700, color: "#fff", letterSpacing: 3, marginBottom: 18, fontFamily: "monospace" }}>•••• •••• •••• {c.savedCard.last4}</div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                  <div>
                    <div style={{ fontSize: 9, color: "rgba(255,255,255,0.4)", letterSpacing: 1, marginBottom: 3 }}>EXPIRES</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>{c.savedCard.exp}</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2" strokeLinecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                    <span style={{ fontSize: 10, color: "rgba(255,255,255,0.45)" }}>PCI Secured · Stripe</span>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ textAlign: "center", padding: "28px 20px", borderRadius: 14, background: t.card, border: `1.5px dashed ${t.border}`, marginBottom: 16 }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>💳</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: t.text, marginBottom: 4 }}>No saved payment method</div>
                <div style={{ fontSize: 12, color: t.sub }}>Saved after first Stripe payment</div>
              </div>
            )}

            {/* Charge payment */}
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              <button onClick={() => setChargeDone(!chargeDone)} style={{ flex: 1, padding: "12px 0", borderRadius: 12, background: chargeDone ? t.greenBg : t.accent, border: chargeDone ? `1px solid ${t.green}` : "none", cursor: "pointer", fontFamily: f, fontSize: 13, fontWeight: 700, color: chargeDone ? t.greenText : "#fff" }}>
                {chargeDone ? "✓ Charged" : "💳 Charge card on file"}
              </button>
              <button style={{ flex: 1, padding: "12px 0", borderRadius: 12, background: t.card, border: `1px solid ${t.border}`, cursor: "pointer", fontFamily: f, fontSize: 13, fontWeight: 700, color: t.text }}>
                🔗 Send pay link
              </button>
            </div>

            {/* Apple Pay / Google Pay */}
            <div style={{ borderRadius: 13, background: t.card, border: `1px solid ${t.border}`, overflow: "hidden", marginBottom: 16 }}>
              {[
                { icon: "", label: "Apple Pay", sub: "Saved on file" },
                { icon: "G", label: "Google Pay", sub: "Not linked" },
              ].map((w, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderBottom: i === 0 ? `1px solid ${t.border}` : "none" }}>
                  <div style={{ width: 32, height: 22, borderRadius: 5, background: "#000", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <span style={{ fontSize: 12, color: "#fff", fontWeight: 700 }}>{w.icon}</span>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{w.label}</div>
                    <div style={{ fontSize: 11, color: t.sub }}>{w.sub}</div>
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: i===0?t.greenBg:t.inputBg, color: i===0?t.greenText:t.muted }}>{i===0?"Active":"—"}</span>
                </div>
              ))}
            </div>

            <SL>PAYMENT HISTORY</SL>
            <div style={{ borderRadius: 13, background: t.card, border: `1px solid ${t.border}`, overflow: "hidden" }}>
              {(c.payments || []).length === 0 ? (
                <div style={{ padding: "16px", textAlign: "center", color: t.muted, fontSize: 13 }}>No payments yet</div>
              ) : (c.payments || []).map((pmt, i, arr) => (
                <div key={i} style={{ padding: "12px 16px", borderBottom: i < arr.length-1 ? `1px solid ${t.border}` : "none" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: t.text }}>{pmt.service}</div>
                      <div style={{ fontSize: 11, color: t.sub }}>{pmt.date} · {pmt.method}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: t.text }}>${pmt.amount}</div>
                      {pmt.tip > 0 && <div style={{ fontSize: 11, color: t.greenText, fontWeight: 600 }}>${pmt.tip} tip</div>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ─── PREFERENCES ─── */}
        {activeTab === "Prefs" && (
          <div style={{ padding: "14px 20px 28px" }}>
            <SL>SERVICE PREFERENCES</SL>
            <div style={{ borderRadius: 13, background: t.card, border: `1px solid ${t.border}`, overflow: "hidden", marginBottom: 14 }}>
              <Row icon="✂️" label="Favourite service" value={c.visits_data?.[0]?.service || "Hair Styling"} />
              <Row icon="👤" label="Preferred staff" value={c.preferred} />
              <Row icon="📍" label="Preferred location" value="Whyte Ave, Edmonton" />
              <Row icon="⏰" label="Preferred time" value="Weekday mornings" last />
            </div>

            <SL>PERSONALISATION</SL>
            <div style={{ borderRadius: 13, background: t.card, border: `1px solid ${t.border}`, overflow: "hidden", marginBottom: 14 }}>
              <Row icon="⚠️" label="Allergies / sensitivities" value={c.notes?.includes("Allergic") ? "Sulfates — avoid" : "None noted"} />
              <Row icon="🌡️" label="Service notes" value={c.notes?.includes("cooler") ? "Cooler water temperature" : "—"} />
              <Row icon="🎨" label="Colour preference" value={c.notes?.includes("ash") ? "Ash blonde" : "—"} last />
            </div>

            <SL>COMMUNICATION</SL>
            <div style={{ borderRadius: 13, background: t.card, border: `1px solid ${t.border}`, overflow: "hidden", marginBottom: 14 }}>
              <Row icon="💬" label="Preferred method" value="SMS" />
              <Row icon="🔔" label="Reminders" value="24hrs before" />
              <Row icon="📢" label="Marketing consent" value="✓ Opted in" last />
            </div>

            <SL>REFERRAL & SOCIAL</SL>
            <div style={{ borderRadius: 13, background: t.card, border: `1px solid ${t.border}`, overflow: "hidden" }}>
              <Row icon="🔗" label="Referral source" value="Instagram" />
              <Row icon="📸" label="Instagram" value="@sarahj_yeg" last />
            </div>
          </div>
        )}

        {/* ─── AI ─── */}
        {activeTab === "AI" && (
          <div style={{ padding: "14px 20px 28px" }}>
            {/* Automations */}
            <SL>ACTIVE AUTOMATIONS</SL>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
              {c.automations.map((auto, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 16px", borderRadius: 13, background: t.card, border: `1px solid ${t.border}` }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: auto.status==="active"?t.green:t.muted, flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: t.text }}>{auto.type}</div>
                    <div style={{ fontSize: 11, color: t.sub }}>Next: {auto.nextRun}</div>
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 9px", borderRadius: 20, background: auto.status==="active"?t.greenBg:t.inputBg, color: auto.status==="active"?t.greenText:t.muted }}>{auto.status}</span>
                </div>
              ))}
            </div>

            {/* Revenue opportunity */}
            <SL>REVENUE OPPORTUNITY</SL>
            <div style={{ padding: "14px 16px", borderRadius: 13, background: t.accentSoft, border: `1px solid ${t.accent}20`, marginBottom: 14 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
                {[
                  { label: "Upsell probability", val: c.upsellProb, color: c.upsellProb==="high"?t.greenText:t.yellowText },
                  { label: "Churn risk", val: c.churnRisk, color: c.churnRisk==="high"?t.pinkText:t.yellowText },
                  { label: "Revenue opportunity", val: c.upsellProb==="high"?"$185/visit":"$45–65", color: t.accentText },
                  { label: "Win-back score", val: c.churnRisk==="high"?"🔴 Now":"🟢 Good", color: t.text },
                ].map((m, i) => (
                  <div key={i} style={{ padding: "10px 12px", borderRadius: 10, background: t.card }}>
                    <div style={{ fontSize: 10, color: t.muted, marginBottom: 3 }}>{m.label}</div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: m.color, textTransform: "capitalize" }}>{m.val}</div>
                  </div>
                ))}
              </div>
              {c.churnRisk === "high" && (
                <button
                  onClick={async () => {
                    if (winbackSent) return;
                    setWinbackSent("sending");
                    const lastVisit = c.visits_data?.[0];
                    const lastService = lastVisit?.service || "their last service";
                    const daysSince = Math.floor(
                      (new Date() - new Date(lastVisit?.date || Date.now())) / (1000 * 60 * 60 * 24)
                    );
                    try {
                      const response = await fetch("/api/ai/winback/generate", {
                        method: "POST",
                        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${localStorage.getItem("access_token") || ""}` },
                        body: JSON.stringify({
                          client_id: "00000000-0000-0000-0000-000000000000",
                          client_name: c.name,
                          last_service: lastService,
                          days_since: daysSince,
                          ltv: c.ltv,
                        })
                      });
                      const data = await response.json();
                      const message = data.message_draft || "We'd love to see you back!";
                      console.log("AI win-back generated:", message);
                      await sendWinBackSMS(c.phone, message);
                    } catch (err) {
                      console.error("Win-back generation failed:", err);
                    }
                    setWinbackSent(true);
                  }}
                  style={{
                    width: "100%", padding: "11px 0", borderRadius: 11,
                    background: winbackSent === true ? t.greenBg : winbackSent === "sending" ? t.inputBg : t.accent,
                    border: winbackSent === true ? `1px solid ${t.green}` : "none",
                    cursor: winbackSent ? "default" : "pointer",
                    fontFamily: f, fontSize: 13, fontWeight: 700,
                    color: winbackSent === true ? t.greenText : winbackSent === "sending" ? t.muted : "#fff",
                    transition: "all 0.2s",
                  }}>
                  {winbackSent === true
                    ? "✓ Win-back sent"
                    : winbackSent === "sending"
                    ? "Generating…"
                    : "Send win-back now →"}
                </button>
              )}
            </div>

            {/* Predicted next visit */}
            <SL>VISIT PREDICTIONS</SL>
            <div style={{ borderRadius: 13, background: t.card, border: `1px solid ${t.border}`, overflow: "hidden" }}>
              <Row icon="📅" label="Predicted next visit" value="~May 13–17" />
              <Row icon="🔄" label="Avg visit frequency" value="Every 28 days" />
              <Row icon="⭐" label="Most booked service" value={c.visits_data?.[0]?.service || "Hair Styling"} last />
            </div>
          </div>
        )}

        {/* ─── NOTES ─── */}
        {activeTab === "Notes" && (
          <div style={{ padding: "14px 20px 28px" }}>
            <SL>STAFF NOTES</SL>
            {(c.staffNotes || []).map((note, i) => (
              <div key={i} style={{ padding: "13px 16px", borderRadius: 13, background: note.pinned?t.yellowBg:t.card, border: `1px solid ${note.pinned?t.yellow+"30":t.border}`, marginBottom: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: t.text }}>{note.author}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    {note.pinned && <span style={{ fontSize: 10, color: t.yellowText, fontWeight: 700 }}>📌 Pinned</span>}
                    <span style={{ fontSize: 10, color: t.muted }}>{note.time}</span>
                  </div>
                </div>
                <div style={{ fontSize: 13, color: t.text, lineHeight: 1.65 }}>{note.text}</div>
              </div>
            ))}
            {(!c.staffNotes || c.staffNotes.length === 0) && (
              <div style={{ textAlign: "center", padding: "24px 0", color: t.muted, fontSize: 13 }}>No notes yet</div>
            )}

            {/* Add note */}
            <div style={{ marginTop: 14 }}>
              <SL>ADD NOTE</SL>
              <textarea
                value={newNote}
                onChange={e => setNewNote(e.target.value)}
                autoFocus={addingNote}
                placeholder="Write a note about this client…"
                style={{ width: "100%", minHeight: 88, padding: "12px 14px", borderRadius: 12, background: t.card, border: `1.5px solid ${newNote ? t.accent : t.border}`, fontSize: 14, color: t.text, fontFamily: f, outline: "none", resize: "none", boxSizing: "border-box", lineHeight: 1.5, transition: "border-color 0.18s" }}
              />
              <button
                onClick={() => { if (newNote.trim()) { setNoteSent(true); setNewNote(""); setAddingNote(false); setTimeout(() => setNoteSent(false), 2200); } }}
                style={{ marginTop: 8, width: "100%", padding: "13px 0", borderRadius: 12, background: noteSent ? t.greenBg : newNote.trim() ? t.accent : t.inputBg, border: noteSent ? `1px solid ${t.green}` : "none", color: noteSent ? t.greenText : newNote.trim() ? "#fff" : t.muted, fontSize: 14, fontWeight: 700, cursor: newNote.trim() ? "pointer" : "default", fontFamily: f, transition: "all 0.2s" }}>
                {noteSent ? "✓ Note saved" : "Save note"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════
// NEW APPOINTMENT OVERLAY
// ═══════════════════════════════════════════════════════════════════
const ALL_CLIENTS = [
  { name: "Sarah Johnson", phone: "+1 587 222 1947", visits: 24, vip: true },
  { name: "Michael Chen", phone: "+1 587 445 2201", visits: 8, vip: false },
  { name: "Emma Wilson", phone: "+1 780 334 5512", visits: 12, vip: false },
  { name: "James Brown", phone: "+1 587 991 0034", visits: 3, vip: false },
  { name: "Lisa Park", phone: "+1 780 227 8841", visits: 19, vip: true },
  { name: "Diana Torres", phone: "+1 587 663 1229", visits: 7, vip: false },
];

const ALL_SERVICES = [
  { icon: "✂️", name: "Hair Styling", duration: "1.5 hrs", price: 125 },
  { icon: "✂️", name: "Signature Fade", duration: "45 min", price: 45 },
  { icon: "🪒", name: "Cut + Beard", duration: "60 min", price: 65 },
  { icon: "💆", name: "Hot Towel Shave", duration: "45 min", price: 55 },
  { icon: "🧒", name: "Kids Cut", duration: "30 min", price: 30 },
];

const STAFF_LIST = [
  { initials: "ED", name: "Emma", color: "#534AB7" },
  { initials: "MJ", name: "Marcus", color: "#16A34A" },
  { initials: "JS", name: "John", color: "#D97706" },
];

function NewAppointmentOverlay({ t, onClose, onSave }) {
  const [clientSearch, setClientSearch] = useState("");
  const [showClientDrop, setShowClientDrop] = useState(false);
  const [selectedClient, setSelectedClient] = useState(null);
  const [showNewClient, setShowNewClient] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");

  const [showServiceDrop, setShowServiceDrop] = useState(false);
  const [selectedService, setSelectedService] = useState(ALL_SERVICES[0]);

  const [selectedStaff, setSelectedStaff] = useState(STAFF_LIST[0]);
  const [date, setDate] = useState("Thu May 8");
  const [time, setTime] = useState("2:00 PM");
  const [notes, setNotes] = useState("");
  const [sendSMS, setSendSMS] = useState(true);
  const [depositPct, setDepositPct] = useState(25);
  const depositRule = getDepositRule(selectedClient);
  const [requireDeposit, setRequireDeposit] = useState(true);
  useEffect(() => {
    if (depositRule.required) setRequireDeposit(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClient?.id ?? selectedClient?.name]);

  const filteredClients = ALL_CLIENTS.filter(c =>
    clientSearch.length > 0 && c.name.toLowerCase().includes(clientSearch.toLowerCase())
  );

  const inputStyle = {
    width: "100%", padding: "12px 14px", borderRadius: 10,
    background: t.inputBg, border: `1px solid ${t.border}`,
    fontSize: 15, color: t.text, fontFamily: f,
    outline: "none", boxSizing: "border-box",
    transition: "border-color 0.2s",
  };

  return (
    <div style={{
      position: "absolute", inset: 0, zIndex: 300, borderRadius: 41,
      overflow: "hidden", background: t.bg, display: "flex", flexDirection: "column",
      animation: "slideUp 0.32s cubic-bezier(0.32,0.72,0,1) both",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 28px 0", height: 36, flexShrink: 0 }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: t.statusBar }}>9:42 AM</span>
        <div style={{ display: "flex", gap: 5 }}>
          <svg width="15" height="11" viewBox="0 0 15 11" fill={t.statusBar}><path d="M0 7.5h2.5V11H0zM4 5h2.5v6H4zM8 3h2.5v8H8zM12 0h2.5v11H12z"/></svg>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 20px 14px", flexShrink: 0 }}>
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", padding: 4, display: "flex", alignItems: "center", justifyContent: "center", width: 32, height: 32 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={t.text} strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
        <div style={{ fontSize: 17, fontWeight: 700, color: t.text }}>New appointment</div>
        <button onClick={() => onSave && onSave({ client: selectedClient, service: selectedService, staff: selectedStaff, date, time })} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 15, fontWeight: 700, color: t.accent, fontFamily: f, padding: "4px 0" }}>Save</button>
      </div>

      <div style={{ flex: 1, padding: "0 20px", display: "flex", flexDirection: "column", gap: 0, position: "relative" }}>
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color: t.muted, marginBottom: 8 }}>CLIENT</div>
          {selectedClient ? (
            <div onClick={() => { setSelectedClient(null); setClientSearch(""); }} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 12, background: t.accentSoft, border: `1.5px solid ${t.accent}`, cursor: "pointer" }}>
              <div style={{ width: 32, height: 32, borderRadius: 16, background: t.accent, color: "#fff", fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                {selectedClient.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: t.text }}>{selectedClient.vip && "⭐ "}{selectedClient.name}</div>
                <div style={{ fontSize: 11, color: t.sub }}>{selectedClient.phone}</div>
              </div>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={t.dim} strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </div>
          ) : (
            <div style={{ position: "relative" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderRadius: 12, background: t.inputBg, border: `1px solid ${showClientDrop ? t.accent : t.border}`, transition: "border-color 0.2s" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={t.muted} strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                <input
                  value={clientSearch}
                  onChange={e => { setClientSearch(e.target.value); setShowClientDrop(true); setShowNewClient(false); }}
                  onFocus={() => setShowClientDrop(true)}
                  placeholder="Search clients or add new"
                  style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontSize: 14, color: t.text, fontFamily: f }}
                />
                <button onClick={() => setShowNewClient(!showNewClient)} style={{ padding: "4px 12px", borderRadius: 8, background: t.accentSoft, border: "none", cursor: "pointer", fontFamily: f, fontSize: 12, fontWeight: 700, color: t.accentText, flexShrink: 0, whiteSpace: "nowrap" }}>+ New</button>
              </div>
              {showClientDrop && filteredClients.length > 0 && (
                <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 50, background: t.card, borderRadius: 12, border: `1px solid ${t.border}`, boxShadow: "0 8px 24px rgba(0,0,0,0.1)", overflow: "hidden" }}>
                  {filteredClients.map((cl, i) => (
                    <div key={i} onClick={() => { setSelectedClient(cl); setShowClientDrop(false); setClientSearch(""); }} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", cursor: "pointer", borderBottom: i < filteredClients.length - 1 ? `1px solid ${t.border}` : "none" }}>
                      <div style={{ width: 32, height: 32, borderRadius: 16, background: cl.vip ? t.accent : t.inputBg, color: cl.vip ? "#fff" : t.text, fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        {cl.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: t.text }}>{cl.vip ? "⭐ " : ""}{cl.name}</div>
                        <div style={{ fontSize: 11, color: t.muted }}>{cl.visits} visits</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {showNewClient && (
                <div style={{ marginTop: 8, padding: "14px 16px", borderRadius: 12, background: t.card, border: `1px solid ${t.accent}`, boxShadow: t.shadow }}>
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, color: t.accentText, marginBottom: 10 }}>NEW CLIENT</div>
                  <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Full name" style={{ ...inputStyle, marginBottom: 8 }} />
                  <input value={newPhone} onChange={e => setNewPhone(e.target.value)} placeholder="Phone number" type="tel" style={{ ...inputStyle, marginBottom: 10 }} />
                  <button onClick={() => {
                    if (newName) {
                      const nc = { name: newName, phone: newPhone, visits: 0, vip: false };
                      setSelectedClient(nc); setShowNewClient(false); setNewName(""); setNewPhone("");
                    }
                  }} style={{ width: "100%", padding: "10px 0", borderRadius: 9, background: t.accent, border: "none", fontSize: 13, fontWeight: 700, color: "#fff", cursor: "pointer", fontFamily: f }}>
                    Create client
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color: t.muted, marginBottom: 8 }}>SERVICE</div>
          <div style={{ position: "relative" }}>
            <div onClick={() => setShowServiceDrop(!showServiceDrop)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 16px", borderRadius: 12, background: t.accentSoft, border: `1.5px solid ${t.accent}`, cursor: "pointer" }}>
              <div style={{ width: 30, height: 30, borderRadius: 8, background: t.accentSoft, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>{selectedService.icon}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: t.text }}>{selectedService.name}</div>
                <div style={{ fontSize: 12, color: t.sub }}>{selectedService.duration} · ${selectedService.price}</div>
              </div>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={t.dim} strokeWidth="2.5" strokeLinecap="round" style={{ transform: showServiceDrop ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}><path d="M6 9l6 6 6-6"/></svg>
            </div>
            {showServiceDrop && (
              <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 50, background: t.card, borderRadius: 12, border: `1px solid ${t.border}`, boxShadow: "0 8px 24px rgba(0,0,0,0.1)", overflow: "hidden" }}>
                {ALL_SERVICES.map((svc, i) => (
                  <div key={i} onClick={() => { setSelectedService(svc); setShowServiceDrop(false); }} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", cursor: "pointer", borderBottom: i < ALL_SERVICES.length - 1 ? `1px solid ${t.border}` : "none", background: selectedService.name === svc.name ? t.accentSoft : "transparent" }}>
                    <span style={{ fontSize: 16 }}>{svc.icon}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: t.text }}>{svc.name}</div>
                      <div style={{ fontSize: 11, color: t.muted }}>{svc.duration} · ${svc.price}</div>
                    </div>
                    {selectedService.name === svc.name && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={t.accent} strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color: t.muted, marginBottom: 8 }}>STAFF</div>
          <div style={{ display: "flex", gap: 10 }}>
            {STAFF_LIST.map((s) => {
              const on = selectedStaff.initials === s.initials;
              return (
                <button key={s.initials} onClick={() => setSelectedStaff(s)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 16px", borderRadius: 24, border: `${on ? 2 : 1}px solid ${on ? t.accent : t.border}`, background: on ? t.accentSoft : t.card, cursor: "pointer", fontFamily: f, transition: "all 0.18s" }}>
                  <div style={{ width: 26, height: 26, borderRadius: 13, background: s.color, color: "#fff", fontSize: 10, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{s.initials}</div>
                  <span style={{ fontSize: 14, fontWeight: on ? 700 : 500, color: on ? t.accentText : t.text }}>{s.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color: t.muted, marginBottom: 8 }}>DATE & TIME</div>
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderRadius: 12, background: t.inputBg, border: `1px solid ${t.border}`, cursor: "pointer" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={t.muted} strokeWidth="2" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              <span style={{ fontSize: 14, fontWeight: 600, color: t.text }}>{date}</span>
            </div>
            <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderRadius: 12, background: t.inputBg, border: `1px solid ${t.border}`, cursor: "pointer" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={t.muted} strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
              <span style={{ fontSize: 14, fontWeight: 600, color: t.text }}>{time}</span>
            </div>
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color: t.muted, marginBottom: 8 }}>NOTES <span style={{ fontWeight: 500, color: t.dim }}>(OPTIONAL)</span></div>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Allergies, preferences, special requests..." style={{ ...inputStyle, minHeight: 72, resize: "none", display: "block", lineHeight: 1.5 }} />
        </div>

        {selectedClient && depositRule.required && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: 12, background: "#FEE2E2", border: "1px solid #FECACA", marginBottom: 10 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#991B1B" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#991B1B" }}>Deposit required — 2+ prior no-shows</span>
          </div>
        )}
        {selectedClient && !depositRule.required && depositRule.recommended && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: 12, background: "#FEF3C7", border: "1px solid #FDE68A", marginBottom: 10 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2.5" strokeLinecap="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#D97706" }}>New client — deposit recommended</span>
          </div>
        )}

        <div style={{ borderRadius: 14, background: t.card, border: `1px solid ${t.border}`, overflow: "hidden", marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "15px 18px", borderBottom: `1px solid ${t.border}` }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={t.sub} strokeWidth="2" strokeLinecap="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
            <span style={{ flex: 1, fontSize: 14, fontWeight: 500, color: t.text }}>Require deposit</span>
            <Toggle on={depositRule.required || requireDeposit} onToggle={() => !depositRule.required && setRequireDeposit(!requireDeposit)} t={t} />
          </div>
          {(depositRule.required || requireDeposit) && (
            <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 18px", borderBottom: `1px solid ${t.border}` }}>
              <span style={{ fontSize: 13, color: t.sub, flex: 1 }}>Deposit %</span>
              <div style={{ display: "flex", gap: 6 }}>
                {[10, 25, 50].map(p => (
                  <button key={p} onClick={() => setDepositPct(p)} style={{ padding: "5px 12px", borderRadius: 8, border: `${depositPct===p?2:1}px solid ${depositPct===p?t.accent:t.border}`, background: depositPct===p?t.accentSoft:t.card, color: depositPct===p?t.accentText:t.text, fontSize: 12, fontWeight: depositPct===p?700:500, cursor: "pointer", fontFamily: f }}>{p}%</button>
                ))}
              </div>
            </div>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "15px 18px" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={t.sub} strokeWidth="2" strokeLinecap="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            <span style={{ flex: 1, fontSize: 14, fontWeight: 500, color: t.text }}>Send confirmation SMS</span>
            <Toggle on={sendSMS} onToggle={() => setSendSMS(!sendSMS)} t={t} />
          </div>
        </div>
      </div>

      <div style={{ padding: "8px 20px 20px", flexShrink: 0 }}>
        <button onClick={() => onSave && onSave({ client: selectedClient, service: selectedService, staff: selectedStaff, date, time })} style={{ width: "100%", padding: "17px 0", borderRadius: 14, background: `linear-gradient(135deg,${t.accent},#6D28D9)`, color: "#fff", border: "none", fontSize: 16, fontWeight: 700, cursor: "pointer", fontFamily: f, boxShadow: `0 4px 16px ${t.accent}40` }}>
          Book appointment
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// APPOINTMENT DETAIL OVERLAY
// ═══════════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════
// CLOSE-OUT MODAL — Tap to Pay · Payment Link · Card on File · Cash
// ═══════════════════════════════════════════════════════════════════
function CloseOutModal({ t, apt, tipPct, setTipPct, tipAmount, grandTotal, sendReceipt, setSendReceipt, onComplete, onClose, isOnline = true }) {
  const [payMethod, setPayMethod] = useState(null); // null | "tap" | "link" | "card" | "cash" | "interac"
  const [linkSent, setLinkSent] = useState(false);
  const [tapState, setTapState] = useState("idle"); // idle | scanning | done
  const [linkCopied, setLinkCopied] = useState(false);
  const [interacRef] = useState(`FPF-${Math.random().toString(36).slice(2,10).toUpperCase()}`);
  const [interacMarked, setInteracMarked] = useState(false);

  const PAY_METHODS = [
    {
      id: "tap",
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <rect x="2" y="5" width="20" height="14" rx="2"/>
          <path d="M2 10h20"/>
          <path d="M7 15h.01M11 15h2"/>
          <path d="M18 8a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2"/>
        </svg>
      ),
      label: "Tap to Pay",
      sub: isOnline ? "NFC · iPhone or terminal" : "Network required",
      color: isOnline ? t.accentText : t.muted,
      bg: isOnline ? t.accentSoft : t.inputBg,
      border: isOnline ? t.accent : t.border,
      disabled: !isOnline,
    },
    {
      id: "link",
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
        </svg>
      ),
      label: "Payment Link",
      sub: isOnline ? "Send via SMS or WhatsApp" : "Network required",
      color: isOnline ? t.blueText : t.muted,
      bg: isOnline ? t.blueBg : t.inputBg,
      border: isOnline ? t.blue : t.border,
      disabled: !isOnline,
    },
    {
      id: "card",
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/>
          <line x1="6" y1="15" x2="10" y2="15"/>
        </svg>
      ),
      label: "Card on File",
      sub: "Mastercard ···· 8801",
      color: t.greenText,
      bg: t.greenBg,
      border: t.green,
    },
    {
      id: "cash",
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <rect x="2" y="6" width="20" height="12" rx="2"/>
          <circle cx="12" cy="12" r="3"/>
          <path d="M6 12h.01M18 12h.01"/>
        </svg>
      ),
      label: "Cash",
      sub: "Mark as received",
      color: t.yellowText,
      bg: t.yellowBg,
      border: t.yellow,
    },
    {
      id: "interac",
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
          <polyline points="9 22 9 12 15 12 15 22"/>
        </svg>
      ),
      label: "Interac",
      sub: "e-Transfer · zero fee",
      color: t.greenText,
      bg: t.greenBg,
      border: t.green,
    },
  ];

  const handleTap = () => {
    setTapState("scanning");
    setTimeout(() => setTapState("done"), 2200);
  };

  const handleSendLink = () => {
    setLinkSent(true);
  };

  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 10, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "flex-end", borderRadius: 41, overflow: "hidden" }}>
      <div style={{ width: "100%", background: t.bg, borderRadius: "22px 22px 0 0", padding: "20px 20px 32px", animation: "slideUp 0.28s cubic-bezier(0.32,0.72,0,1) both", maxHeight: "90%", overflowY: "auto" }}>
        {/* Handle */}
        <div style={{ width: 40, height: 4, borderRadius: 2, background: t.border, margin: "0 auto 18px" }} />

        {/* Offline badge */}
        {!isOnline && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 10, background: "#FEF3C7", border: "1px solid #F59E0B", marginBottom: 12 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#D97706" }}>Offline mode — Tap to Pay &amp; Payment Link unavailable</span>
          </div>
        )}

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: t.text, marginBottom: 3 }}>Close out appointment</div>
            <div style={{ fontSize: 13, color: t.sub }}>Sarah Johnson · Hair Styling · ${apt.total}</div>
          </div>
          <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: "50%", background: t.inputBg, border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={t.muted} strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        {/* Tip selector */}
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.2, color: t.muted, marginBottom: 10, marginTop: 18 }}>ADD GRATUITY</div>
        <div style={{ display: "flex", gap: 7, marginBottom: tipPct > 0 ? 8 : 16 }}>
          {[0, 15, 18, 20, 25].map(pct => (
            <button key={pct} onClick={() => setTipPct(pct)} style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: `${tipPct===pct?2:1}px solid ${tipPct===pct?t.accent:t.border}`, background: tipPct===pct?t.accentSoft:t.card, color: tipPct===pct?t.accentText:t.text, fontSize: 12, fontWeight: tipPct===pct?700:500, cursor: "pointer", fontFamily: f }}>
              {pct === 0 ? "None" : `${pct}%`}
            </button>
          ))}
        </div>
        {tipPct > 0 && (
          <div style={{ fontSize: 13, color: t.sub, marginBottom: 16 }}>
            Tip: <strong style={{ color: t.text }}>${tipAmount}</strong>
            {" · "}Balance due: <strong style={{ color: t.text }}>${grandTotal}</strong>
          </div>
        )}

        {/* Payment method selector */}
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.2, color: t.muted, marginBottom: 10 }}>COLLECT PAYMENT</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
          {PAY_METHODS.map(pm => {
            const on = payMethod === pm.id;
            const disabled = pm.disabled === true;
            return (
              <button key={pm.id} onClick={() => { if (!disabled) { setPayMethod(pm.id); setLinkSent(false); setTapState("idle"); }}} style={{ padding: "12px 14px", borderRadius: 14, border: `${on?2:1}px solid ${on?pm.border:t.border}`, background: disabled ? t.inputBg : (on?pm.bg:t.card), cursor: disabled ? "not-allowed" : "pointer", fontFamily: f, textAlign: "left", transition: "all 0.15s", display: "flex", flexDirection: "column", gap: 6, opacity: disabled ? 0.5 : 1 }}>
                <div style={{ color: on?pm.color:t.sub }}>{pm.icon}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: on?pm.color:t.text }}>{pm.label}</div>
                <div style={{ fontSize: 11, color: t.muted, lineHeight: 1.3 }}>{pm.sub}</div>
              </button>
            );
          })}
        </div>

        {/* Method-specific UI */}
        {payMethod === "tap" && (
          <div style={{ borderRadius: 14, background: t.accentSoft, border: `1px solid ${t.accent}20`, padding: "18px 16px", marginBottom: 16, textAlign: "center" }}>
            {tapState === "idle" && (
              <>
                <div style={{ fontSize: 36, marginBottom: 10 }}>📱</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: t.accentText, marginBottom: 4 }}>Ready to tap</div>
                <div style={{ fontSize: 12, color: t.sub, marginBottom: 14 }}>Hold client's card or phone to the back of your iPhone</div>
                <button onClick={handleTap} style={{ padding: "11px 28px", borderRadius: 12, background: t.accent, color: "#fff", border: "none", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: f }}>
                  Start Tap to Pay · ${grandTotal}
                </button>
              </>
            )}
            {tapState === "scanning" && (
              <div style={{ padding: "8px 0" }}>
                <div style={{ fontSize: 36, marginBottom: 10, animation: "pulseRing 1s ease-out infinite" }}>📡</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: t.accentText }}>Waiting for tap…</div>
                <div style={{ fontSize: 12, color: t.sub, marginTop: 4 }}>Hold card or device near iPhone</div>
              </div>
            )}
            {tapState === "done" && (
              <>
                <div style={{ fontSize: 36, marginBottom: 10 }}>✅</div>
                <div style={{ fontSize: 15, fontWeight: 800, color: t.greenText, marginBottom: 4 }}>Payment accepted!</div>
                <div style={{ fontSize: 12, color: t.sub }}>${grandTotal} · Visa ···· 4242</div>
              </>
            )}
          </div>
        )}

        {payMethod === "link" && (
          <div style={{ borderRadius: 14, background: t.blueBg, border: `1px solid ${t.blue}20`, padding: "16px", marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: t.blueText, marginBottom: 10 }}>Payment link · ${grandTotal}</div>
            {/* Link display + copy */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderRadius: 10, background: t.card, border: `1px solid ${t.border}`, marginBottom: 12 }}>
              <span style={{ flex: 1, fontSize: 12, color: t.accentText, fontWeight: 600 }}>pay.flatpurse.flow/SJ-2840</span>
              <button onClick={() => setLinkCopied(true)} style={{ padding: "4px 10px", borderRadius: 7, background: linkCopied?t.greenBg:t.accentSoft, border: "none", cursor: "pointer", fontFamily: f, fontSize: 11, fontWeight: 700, color: linkCopied?t.greenText:t.accentText }}>
                {linkCopied ? "✓ Copied" : "Copy"}
              </button>
            </div>
            {/* Send options */}
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={handleSendLink} style={{ flex: 1, padding: "10px 0", borderRadius: 10, background: linkSent?t.greenBg:t.blue, border: "none", cursor: "pointer", fontFamily: f, fontSize: 12, fontWeight: 700, color: linkSent?t.greenText:"#fff" }}>
                {linkSent ? "✓ SMS sent" : "📱 Send SMS"}
              </button>
              <button style={{ flex: 1, padding: "10px 0", borderRadius: 10, background: "#25D366", border: "none", cursor: "pointer", fontFamily: f, fontSize: 12, fontWeight: 700, color: "#fff" }}>
                💬 WhatsApp
              </button>
              <button style={{ flex: 1, padding: "10px 0", borderRadius: 10, background: t.card, border: `1px solid ${t.border}`, cursor: "pointer", fontFamily: f, fontSize: 12, fontWeight: 700, color: t.text }}>
                ✉️ Email
              </button>
            </div>
            {linkSent && (
              <div style={{ fontSize: 12, color: t.blueText, marginTop: 10, fontWeight: 600 }}>
                Link expires in 24 hrs · client pays securely via Stripe
              </div>
            )}
          </div>
        )}

        {payMethod === "card" && (
          <div style={{ borderRadius: 14, background: t.greenBg, border: `1px solid ${t.green}20`, padding: "14px 16px", marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 42, height: 28, borderRadius: 6, background: "#1A1F71", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontSize: 9, fontWeight: 900, color: "#fff", fontStyle: "italic", letterSpacing: 0.5 }}>VISA</span>
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: t.greenText }}>Mastercard ···· 8801</div>
                <div style={{ fontSize: 11, color: t.sub }}>Debit · expires 09/27</div>
              </div>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={t.greenText} strokeWidth="2.5" strokeLinecap="round" style={{ marginLeft: "auto" }}><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <div style={{ fontSize: 12, color: t.sub, marginTop: 10, paddingTop: 10, borderTop: `1px solid ${t.green}20` }}>
              Charge ${grandTotal} to card on file · Sarah authorized this card at booking
            </div>
          </div>
        )}

        {payMethod === "cash" && (
          <div style={{ borderRadius: 14, background: t.yellowBg, border: `1px solid ${t.yellow}20`, padding: "14px 16px", marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: t.yellowText, marginBottom: 4 }}>Cash · ${grandTotal}</div>
            <div style={{ fontSize: 12, color: t.sub }}>Mark as received manually. No Stripe charge — for your records only.</div>
          </div>
        )}

        {payMethod === "interac" && (
          <div style={{ borderRadius: 14, background: t.greenBg, border: `1px solid ${t.green}20`, padding: "14px 16px", marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: t.greenText, marginBottom: 8 }}>Interac e-Transfer · ${grandTotal}</div>
            <div style={{ fontSize: 12, color: t.sub, marginBottom: 4 }}>Reference: <strong style={{ color: t.text }}>{interacRef}</strong></div>
            <div style={{ fontSize: 12, color: t.sub, marginBottom: 12 }}>Client sends ${grandTotal} to your deposit email with this reference code.</div>
            <button
              onClick={() => { setInteracMarked(true); queueOfflineOp("interac_closeout", { ref: interacRef, amount: grandTotal }); }}
              style={{ width: "100%", padding: "10px 0", borderRadius: 10, background: interacMarked ? t.card : t.green, border: `1px solid ${t.green}`, cursor: "pointer", fontFamily: f, fontSize: 13, fontWeight: 700, color: interacMarked ? t.greenText : "#fff" }}>
              {interacMarked ? "✓ Marked as received" : "Mark as received"}
            </button>
          </div>
        )}

        {/* Receipt SMS toggle */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "13px 16px", borderRadius: 12, background: t.card, border: `1px solid ${t.border}`, marginBottom: 16 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={t.sub} strokeWidth="2" strokeLinecap="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          <span style={{ flex: 1, fontSize: 14, color: t.text }}>Send receipt via SMS</span>
          <Toggle on={sendReceipt} onToggle={() => setSendReceipt(!sendReceipt)} t={t} />
        </div>

        {/* Collect CTA */}
        <button
          onClick={onComplete}
          disabled={!payMethod && payMethod !== "cash"}
          style={{ width: "100%", padding: "17px 0", borderRadius: 14, background: payMethod ? "linear-gradient(135deg,#16A34A,#15803D)" : t.inputBg, color: payMethod ? "#fff" : t.muted, border: "none", fontSize: 16, fontWeight: 700, cursor: payMethod ? "pointer" : "default", fontFamily: f, boxShadow: payMethod ? "0 4px 16px rgba(22,163,74,0.3)" : "none", transition: "all 0.2s" }}>
          {payMethod === "tap" && tapState === "done"
            ? `✓ Payment received · ${grandTotal}`
            : payMethod === "link" && linkSent
            ? `Link sent · mark complete`
            : payMethod === "interac" && interacMarked
            ? `✓ Interac received · mark complete`
            : payMethod
            ? `Complete · Collect $${grandTotal}`
            : "Choose a payment method"}
        </button>
      </div>
    </div>
  );
}


function AppointmentDetail({ t, appointment, onClose, onComplete }) {
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [tipPct, setTipPct] = useState(20);
  const [sendReceipt, setSendReceipt] = useState(true);
  const [completed, setCompleted] = useState(false);
  const isOnline = useOnlineStatus();

  const apt = appointment || {
    client: { name: "Sarah Johnson", initials: "SJ", vip: true, visits: 24, ltv: 4200, color: "#534AB7" },
    service: "Hair Styling",
    duration: "1.5 hrs",
    when: "Today · 10:00 AM",
    staff: "Emma Davis",
    deposit: 25,
    total: 125,
    status: "confirmed",
    notes: "Allergic to sulfates. Prefers cooler temperature water. Likes a specific shade of ash blonde — see last visit photos.",
  };

  const serviceTotal = apt.total;
  const tipAmount = Math.round(serviceTotal * (tipPct / 100));
  const grandTotal = serviceTotal + tipAmount - apt.deposit;

  if (completed) return (
    <div style={{ position: "absolute", inset: 0, zIndex: 300, borderRadius: 41, overflow: "hidden", background: t.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 32px" }}>
      <div style={{ width: 80, height: 80, borderRadius: 40, background: "linear-gradient(135deg,#16A34A,#15803D)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 24, boxShadow: "0 8px 28px rgba(22,163,74,0.35)", animation: "successPop 0.6s cubic-bezier(0.34,1.56,0.64,1) both" }}>
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
      </div>
      <div style={{ fontSize: 24, fontWeight: 800, color: t.text, letterSpacing: -0.5, marginBottom: 8, textAlign: "center", animation: "fadeUp 0.5s ease 0.2s both" }}>
        Appointment complete!
      </div>
      <div style={{ fontSize: 14, color: t.sub, textAlign: "center", lineHeight: 1.6, marginBottom: 28, animation: "fadeUp 0.5s ease 0.3s both" }}>
        Sarah's receipt has been sent via SMS.{"\n"}${grandTotal} collected.
      </div>
      <button onClick={onClose} style={{ width: "100%", padding: "16px 0", borderRadius: 14, background: `linear-gradient(135deg,${t.accent},#6D28D9)`, color: "#fff", border: "none", fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: f, animation: "fadeUp 0.5s ease 0.4s both" }}>
        Back to bookings
      </button>
    </div>
  );

  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 300, borderRadius: 41, overflow: "hidden", background: t.bg, display: "flex", flexDirection: "column", animation: "slideUp 0.32s cubic-bezier(0.32,0.72,0,1) both" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 28px 0", height: 36, flexShrink: 0 }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: t.statusBar }}>9:43 AM</span>
        <div style={{ display: "flex", gap: 5 }}>
          <svg width="15" height="11" viewBox="0 0 15 11" fill={t.statusBar}><path d="M0 7.5h2.5V11H0zM4 5h2.5v6H4zM8 3h2.5v8H8zM12 0h2.5v11H12z"/></svg>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 20px 14px", flexShrink: 0 }}>
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", padding: 4, display: "flex" }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={t.text} strokeWidth="2.5" strokeLinecap="round"><path d="M15 18l-6-6 6-6"/></svg>
        </button>
        <div style={{ fontSize: 17, fontWeight: 700, color: t.text }}>Appointment</div>
        <button style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={t.text} strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/></svg>
        </button>
      </div>

      <div style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch" }}>
        <div style={{ margin: "0 20px 16px", padding: "14px 18px", borderRadius: 14, background: t.greenBg, border: `1px solid ${t.green}20` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={t.greenText} strokeWidth="2.5" strokeLinecap="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1.5, color: t.greenText }}>CONFIRMED · DEPOSIT PAID</span>
          </div>
          <div style={{ fontSize: 13, color: t.greenText, lineHeight: 1.5, fontWeight: 500 }}>
            Sarah confirmed via SMS at 9:14 AM. $25 deposit applied.
          </div>
        </div>

        <div style={{ margin: "0 20px 16px", display: "flex", alignItems: "center", gap: 14, padding: "14px 18px", borderRadius: 14, background: t.card, border: `1px solid ${t.border}`, cursor: "pointer", boxShadow: t.shadow }}>
          <div style={{ width: 46, height: 46, borderRadius: 23, background: apt.client.color, color: "#fff", fontSize: 15, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{apt.client.initials}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: t.text }}>
              {apt.client.vip && <span style={{ color: "#F59E0B" }}>⭐ </span>}{apt.client.name}
            </div>
            <div style={{ fontSize: 12, color: t.sub, marginTop: 2 }}>
              VIP · {apt.client.visits} visits · ${(apt.client.ltv / 1000).toFixed(1)}k LTV
            </div>
          </div>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={t.dim} strokeWidth="2" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
        </div>

        <div style={{ margin: "0 20px 16px", display: "flex", gap: 10 }}>
          <button style={{ flex: 1, padding: "13px 0", borderRadius: 12, background: t.accent, border: "none", cursor: "pointer", fontFamily: f, fontSize: 14, fontWeight: 700, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            Message
          </button>
          <button style={{ flex: 1, padding: "13px 0", borderRadius: 12, background: "transparent", border: `1.5px solid ${t.border}`, cursor: "pointer", fontFamily: f, fontSize: 14, fontWeight: 600, color: t.text, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={t.text} strokeWidth="2" strokeLinecap="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.11 12 19.79 19.79 0 0 1 1.04 3.4 2 2 0 0 1 3 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
            Call
          </button>
        </div>

        <div style={{ margin: "0 20px 16px", borderRadius: 14, background: t.card, border: `1px solid ${t.border}`, overflow: "hidden", boxShadow: t.shadow }}>
          {[
            { label: "Service", value: `${apt.service} · ${apt.duration}` },
            { label: "When", value: apt.when },
            { label: "With", value: apt.staff },
            { label: "Deposit", value: `$${apt.deposit} paid`, green: true },
            { label: "Total", value: `$${apt.total}`, bold: true },
          ].map((row, i, arr) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 18px", borderBottom: i < arr.length - 1 ? `1px solid ${t.border}` : "none" }}>
              <span style={{ fontSize: 14, color: t.sub }}>{row.label}</span>
              <span style={{ fontSize: 14, fontWeight: row.bold ? 800 : row.green ? 600 : 500, color: row.green ? t.greenText : row.bold ? t.text : t.text }}>{row.value}</span>
            </div>
          ))}
        </div>

        <div style={{ margin: "0 20px 16px", padding: "16px 18px", borderRadius: 14, background: t.yellowBg, border: `1px solid ${t.yellow}20` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={t.yellowText} strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1.2, color: t.yellowText }}>CLIENT NOTES</span>
          </div>
          <div style={{ fontSize: 13, color: t.text, lineHeight: 1.65 }}>{apt.notes}</div>
        </div>

        <div style={{ margin: "0 20px 14px", display: "flex", gap: 10 }}>
          <button style={{ flex: 1, padding: "13px 0", borderRadius: 12, background: "transparent", border: `1.5px solid ${t.border}`, cursor: "pointer", fontFamily: f, fontSize: 14, fontWeight: 600, color: t.text }}>Reschedule</button>
          <button style={{ flex: 1, padding: "13px 0", borderRadius: 12, background: "transparent", border: `1.5px solid ${t.pink}`, cursor: "pointer", fontFamily: f, fontSize: 14, fontWeight: 600, color: t.pinkText }}>Cancel</button>
        </div>

        <div style={{ margin: "0 20px 28px" }}>
          <button onClick={() => setShowCompleteModal(true)} style={{ width: "100%", padding: "17px 0", borderRadius: 14, background: "linear-gradient(135deg,#16A34A,#15803D)", color: "#fff", border: "none", fontSize: 16, fontWeight: 700, cursor: "pointer", fontFamily: f, boxShadow: "0 4px 16px rgba(22,163,74,0.35)" }}>
            Mark as completed
          </button>
        </div>
      </div>

      {showCompleteModal && (
        <CloseOutModal
          t={t}
          apt={apt}
          tipPct={tipPct} setTipPct={setTipPct}
          tipAmount={tipAmount} grandTotal={grandTotal}
          sendReceipt={sendReceipt} setSendReceipt={setSendReceipt}
          onComplete={() => { setShowCompleteModal(false); setCompleted(true); }}
          onClose={() => setShowCompleteModal(false)}
          isOnline={isOnline}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// CLIENT BOOKING FLOW
// ═══════════════════════════════════════════════════════════════════
const BSTAFF_L = [
  { id: "marcus", initials: "MJ", name: "Marcus", color: "#16A34A" },
  { id: "david", initials: "DK", name: "David", color: "#534AB7" },
  { id: "anyone", initials: "★", name: "Anyone", color: "#64748B" },
];
const BDAYS_L = [
  { day: "WED", date: 7, status: "full", label: "Full" },
  { day: "THU", date: 8, status: "limited", label: "5 left" },
  { day: "FRI", date: 9, status: "open", label: "Open" },
  { day: "SAT", date: 10, status: "limited", label: "3 left" },
  { day: "SUN", date: 11, status: "closed", label: "Closed" },
];
const BTIMES_L = ["9:00 AM", "10:30 AM", "11:30 AM", "2:00 PM", "3:30 PM", "5:00 PM"];

const CLIENT_SVCS = [
  { id: "sig", icon: "✂️", name: "Signature Cut", duration: "45 min", price: 45, badge: "Most popular" },
  { id: "beard", icon: "🪒", name: "Cut + Beard", duration: "60 min", price: 65, badge: null },
  { id: "kids", icon: "🧒", name: "Kids Cut (under 12)", duration: "30 min", price: 30, badge: null },
  { id: "shave", icon: "💆", name: "Hot Towel Shave", duration: "45 min", price: 55, badge: "Premium" },
];

function BStep1({ t, onNext }) {
  const [sel, setSel] = useState(null);
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: t.bg }}>
      <div style={{ height: 148, flexShrink: 0, position: "relative", background: "linear-gradient(135deg,#2D1B69 0%,#534AB7 50%,#8B5A2B 100%)", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, opacity: 0.06, backgroundImage: "radial-gradient(circle,#fff 1px,transparent 1px)", backgroundSize: "24px 24px" }} />
      </div>
      <div style={{ padding: "0 20px", flexShrink: 0 }}>
        <div style={{ width: 54, height: 54, borderRadius: 27, background: t.bg, border: `3px solid ${t.bg}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 800, color: "#1E293B", marginTop: -27, marginBottom: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.12)" }}>SC</div>
        <div style={{ fontSize: 22, fontWeight: 800, color: t.text, letterSpacing: -0.5, marginBottom: 4 }}>Stride Cuts</div>
        <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 3 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={t.muted} strokeWidth="2" strokeLinecap="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
          <span style={{ fontSize: 13, color: t.sub }}>Whyte Ave, Edmonton</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14, paddingBottom: 14, borderBottom: `1px solid ${t.border}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: t.text }}>4.9</span>
            <span style={{ fontSize: 11, color: "#F59E0B" }}>★★★★★</span>
            <span style={{ fontSize: 12, color: t.muted }}>(287)</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={t.muted} strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
            <span style={{ fontSize: 13, color: t.sub }}>Open until 7 PM</span>
          </div>
        </div>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "0 20px 100px" }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color: t.muted, marginTop: 14, marginBottom: 12 }}>CHOOSE A SERVICE</div>
        {CLIENT_SVCS.map((svc) => {
          const on = sel?.id === svc.id;
          return (
            <div key={svc.id} onClick={() => setSel(svc)} style={{ display: "flex", alignItems: "center", gap: 14, padding: "15px 16px", borderRadius: 14, background: on ? t.accentSoft : t.card, border: `${on ? 2 : 1}px solid ${on ? t.accent : t.border}`, marginBottom: 8, cursor: "pointer", boxShadow: t.shadow, transition: "all 0.2s" }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, flexShrink: 0, background: on ? t.accentSoft : t.inputBg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>{svc.icon}</div>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 15, fontWeight: 700, color: t.text }}>{svc.name}</span>
                  {svc.badge && <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 5, background: on ? `${t.accent}20` : t.inputBg, color: on ? t.accentText : t.muted }}>{svc.badge}</span>}
                </div>
                <div style={{ fontSize: 12, color: t.sub, marginTop: 2 }}>{svc.duration}</div>
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, color: t.text }}>${svc.price}</div>
            </div>
          );
        })}
      </div>
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "12px 20px 20px", background: `linear-gradient(to top,${t.bg} 70%,transparent)` }}>
        <button onClick={() => sel && onNext(sel)} style={{ width: "100%", padding: "17px 0", borderRadius: 14, background: sel ? "#1E293B" : t.inputBg, color: sel ? "#fff" : t.muted, border: "none", fontSize: 15, fontWeight: 700, cursor: sel ? "pointer" : "default", fontFamily: f, transition: "all 0.25s" }}>Pick a time →</button>
      </div>
    </div>
  );
}

function BStep2({ t, service, onNext, onBack }) {
  const [selStaff, setSelStaff] = useState(BSTAFF_L[0]);
  const [selDay, setSelDay] = useState(BDAYS_L[1]);
  const [selTime, setSelTime] = useState("11:30 AM");
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: t.bg }}>
      <div style={{ padding: "10px 20px 12px", borderBottom: `1px solid ${t.border}`, flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", padding: 4, display: "flex" }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={t.text} strokeWidth="2.5" strokeLinecap="round"><path d="M15 18l-6-6 6-6"/></svg></button>
          <div><div style={{ fontSize: 16, fontWeight: 700, color: t.text }}>{service.name} · ${service.price}</div><div style={{ fontSize: 12, color: t.sub }}>{service.duration} · Stride Cuts</div></div>
        </div>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "0 20px 100px" }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color: t.muted, marginTop: 18, marginBottom: 12 }}>CHOOSE YOUR BARBER</div>
        <div style={{ display: "flex", gap: 10, marginBottom: 24 }}>
          {BSTAFF_L.map(s => {
            const on = selStaff.id === s.id;
            return <div key={s.id} onClick={() => setSelStaff(s)} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "12px 16px", borderRadius: 14, cursor: "pointer", border: `${on ? 2 : 1}px solid ${on ? t.accent : t.border}`, background: on ? t.accentSoft : t.card, boxShadow: t.shadow, transition: "all 0.2s", minWidth: 72 }}>
              <div style={{ width: 44, height: 44, borderRadius: 22, background: on ? t.accent : s.color, color: "#fff", fontSize: 14, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>{s.initials}</div>
              <span style={{ fontSize: 12, fontWeight: on ? 700 : 500, color: on ? t.accentText : t.text }}>{s.name}</span>
            </div>;
          })}
        </div>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color: t.muted, marginBottom: 12 }}>PICK A DAY</div>
        <div style={{ display: "flex", gap: 8, marginBottom: 24, overflowX: "auto", paddingBottom: 4 }}>
          {BDAYS_L.map(d => {
            const on = selDay.date === d.date;
            const disabled = d.status === "full" || d.status === "closed";
            return <div key={d.date} onClick={() => !disabled && setSelDay(d)} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "10px 14px", borderRadius: 12, cursor: disabled ? "default" : "pointer", border: `${on ? 2 : 1}px solid ${on ? t.accent : t.border}`, background: on ? "#1E293B" : disabled ? t.inputBg : t.card, opacity: disabled ? 0.45 : 1, transition: "all 0.2s", flexShrink: 0, minWidth: 58 }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, color: on ? "#fff" : t.muted }}>{d.day}</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: on ? "#fff" : t.text }}>{d.date}</div>
              <div style={{ fontSize: 10, fontWeight: 600, color: d.status === "limited" && !on ? t.accent : d.status === "open" && !on ? t.greenText : on ? "rgba(255,255,255,0.7)" : t.muted }}>{d.label}</div>
            </div>;
          })}
        </div>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color: t.muted, marginBottom: 12 }}>AVAILABLE TIMES · THU MAY 8</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
          {BTIMES_L.map(time => {
            const on = selTime === time;
            return <div key={time} onClick={() => setSelTime(time)} style={{ padding: "13px 0", borderRadius: 12, textAlign: "center", cursor: "pointer", border: `${on ? 2 : 1}px solid ${on ? t.accent : t.border}`, background: on ? "#1E293B" : t.card, fontSize: 13, fontWeight: on ? 700 : 500, color: on ? "#fff" : t.text, transition: "all 0.2s" }}>{time}</div>;
          })}
        </div>
      </div>
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "12px 20px 20px", background: `linear-gradient(to top,${t.bg} 70%,transparent)` }}>
        <button onClick={() => onNext({ staff: selStaff, day: selDay, time: selTime })} style={{ width: "100%", padding: "17px 0", borderRadius: 14, background: "#1E293B", color: "#fff", border: "none", fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: f }}>Continue → Thu {selTime}</button>
      </div>
    </div>
  );
}

function BStep3({ t, service, booking, onConfirm, onBack }) {
  // ── Personal info ──
  const [name, setName]   = useState("Tomi Adebayo");
  const [phone, setPhone] = useState("+1 587 222 1947");
  const [email, setEmail] = useState("tomi@example.com");

  // ── Tip ──
  const [tipPct, setTipPct] = useState(0);

  // ── Toggles ──
  const [requireDeposit,   setRequireDeposit]   = useState(true);
  const [sendConfirmation, setSendConfirmation] = useState(true);
  const [saveCard,         setSaveCard]         = useState(false);
  const [depositMethod,    setDepositMethod]    = useState("card"); // "card" | "interac"
  const [interacSent,      setInteracSent]      = useState(false);
  const bookingRef = useState(() => `FPF-${Math.random().toString(36).slice(2,10).toUpperCase()}`)[0];

  // ── Payment ──
  const [cardType,    setCardType]    = useState(null);   // auto-detected from card number
  const [cardHolder,  setCardHolder]  = useState("");
  const [billingAddr, setBillingAddr] = useState("");
  const [billingCity, setBillingCity] = useState("");
  const [billingZip,  setBillingZip]  = useState("");
  const [rawNum,      setRawNum]      = useState("");        // digits only
  const [expiry,      setExpiry]      = useState("");
  const [cvc,         setCvc]         = useState("");
  const [focusField,  setFocusField]  = useState(null);

  // ── Derived ──
  const depositAmt  = requireDeposit ? 10 : 0;
  const tipAmt      = Math.round(service.price * tipPct / 100);
  const balanceDue  = service.price + tipAmt - depositAmt;

  // ── Card network detection ──
  const detectNetwork = (digits) => {
    if (!digits) return null;
    if (/^4/.test(digits))                      return "visa";
    if (/^(51|52|53|54|55|2[2-7])/.test(digits)) return "mastercard";
    if (/^3[47]/.test(digits))                  return "amex";
    if (/^(6011|65|64[4-9])/.test(digits))      return "discover";
    if (/^35/.test(digits))                     return "jcb";
    if (/^(300|301|302|303|36|38)/.test(digits)) return "diners";
    if (/^62/.test(digits))                     return "unionpay";
    return null;
  };

  const network = detectNetwork(rawNum);

  // Format card number with spaces: AMEX = 4-6-5, others = 4-4-4-4
  const formatCardNum = (digits) => {
    if (!digits) return "";
    if (network === "amex" || (digits.length >= 1 && digits[0] === "3" && ["4","7"].includes(digits[1]))) {
      return digits.replace(/(\d{4})(\d{0,6})(\d{0,5})/, (_, a, b, c) => [a, b, c].filter(Boolean).join(" "));
    }
    return digits.replace(/(\d{4})(?=\d)/g, "$1 ");
  };

  const handleCardNumChange = (val) => {
    const digits = val.replace(/\D/g, "").slice(0, 16);
    setRawNum(digits);
  };

  const handleExpiryChange = (val) => {
    const digits = val.replace(/\D/g, "").slice(0, 4);
    if (digits.length >= 3) {
      setExpiry(digits.slice(0,2) + "/" + digits.slice(2));
    } else {
      setExpiry(digits);
    }
  };

  // ── Network logos ──
  const NetworkLogo = ({ net }) => {
    if (!net) return null;
    const logos = {
      visa:       { bg: "#1A1F71", color: "#fff", text: "VISA",      style: { fontStyle: "italic", fontWeight: 900, letterSpacing: 1 } },
      mastercard: { bg: null,      color: null,   text: null,         style: {} },
      amex:       { bg: "#2E77BC", color: "#fff", text: "AMEX",      style: { fontWeight: 900, letterSpacing: 0.5 } },
      discover:   { bg: "#FF6600", color: "#fff", text: "DISCOVER",  style: { fontWeight: 800, fontSize: 9 } },
      jcb:        { bg: "#003087", color: "#fff", text: "JCB",       style: { fontWeight: 900 } },
      diners:     { bg: "#004B87", color: "#fff", text: "Diners",    style: { fontWeight: 700 } },
      unionpay:   { bg: "#C0392B", color: "#fff", text: "UnionPay",  style: { fontWeight: 700, fontSize: 9 } },
    };
    const logo = logos[net];
    if (!logo) return null;

    if (net === "mastercard") {
      return (
        <div style={{ display: "flex", alignItems: "center", gap: -6, flexShrink: 0 }}>
          <div style={{ width: 22, height: 22, borderRadius: "50%", background: "#EB001B", opacity: 0.9 }} />
          <div style={{ width: 22, height: 22, borderRadius: "50%", background: "#F79E1B", marginLeft: -10 }} />
        </div>
      );
    }
    return (
      <div style={{ padding: "3px 8px", borderRadius: 5, background: logo.bg, flexShrink: 0 }}>
        <span style={{ fontSize: 10, color: logo.color, fontFamily: f, ...logo.style }}>{logo.text}</span>
      </div>
    );
  };

  const inp = (extra = {}) => ({
    width: "100%", background: "transparent", border: "none", outline: "none",
    fontSize: 15, color: t.text, fontFamily: f, ...extra,
  });

  const fieldBox = (focused) => ({
    borderRadius: 12, background: t.card,
    border: `1.5px solid ${focused ? t.accent : t.border}`,
    padding: "12px 14px", marginBottom: 8,
    transition: "border-color 0.18s",
  });

  const Toggle = ({ on, onToggle }) => (
    <div onClick={onToggle} style={{ width: 46, height: 26, borderRadius: 13, background: on ? t.accent : t.inputBg, border: `1.5px solid ${on ? t.accent : t.border}`, position: "relative", cursor: "pointer", flexShrink: 0, transition: "all 0.25s" }}>
      <div style={{ width: 20, height: 20, borderRadius: 10, background: on ? "#fff" : t.muted, position: "absolute", top: 2, left: on ? 22 : 2, transition: "left 0.25s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
    </div>
  );

  const canPay = depositMethod === "interac"
    ? interacSent
    : rawNum.length >= 15 && expiry.length >= 4 && cvc.length >= 3 && cardHolder.length > 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: t.bg }}>

      {/* ── Header ── */}
      <div style={{ padding: "10px 20px 12px", borderBottom: `1px solid ${t.border}`, flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", padding: 4, display: "flex" }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={t.text} strokeWidth="2.5" strokeLinecap="round"><path d="M15 18l-6-6 6-6"/></svg>
          </button>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700, color: t.text }}>Confirm & pay</div>
            <div style={{ fontSize: 12, color: t.sub }}>
              {service.name} · {booking.staff.name === "Anyone" ? "First available" : booking.staff.name} · Thu {booking.time}
            </div>
          </div>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "0 20px 130px" }}>

        {/* ── Booking summary ── */}
        <div style={{ borderRadius: 14, border: `1px solid ${t.border}`, background: t.card, overflow: "hidden", marginTop: 16, marginBottom: 20, boxShadow: t.shadow }}>
          {[
            { label: "Service",       value: service.name },
            { label: "With",          value: booking.staff.name === "Anyone" ? "First available" : booking.staff.name },
            { label: "When",          value: `Thu May 8 · ${booking.time}` },
            { label: "Duration",      value: service.duration },
            { label: "Service total", value: `$${service.price}`, bold: true },
          ].map((row, i, arr) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "12px 16px", borderBottom: i < arr.length - 1 ? `1px solid ${t.border}` : "none" }}>
              <span style={{ fontSize: 13, color: t.sub }}>{row.label}</span>
              <span style={{ fontSize: 13, fontWeight: row.bold ? 800 : 600, color: t.text }}>{row.value}</span>
            </div>
          ))}
        </div>

        {/* ── Contact info ── */}
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color: t.muted, marginBottom: 10 }}>YOUR INFO</div>
        <input value={name}  onChange={e => setName(e.target.value)}  placeholder="Full name"      style={{ ...fieldBox(focusField==="name"),  ...inp() }} onFocus={()=>setFocusField("name")}  onBlur={()=>setFocusField(null)} />
        <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="Phone number"   type="tel"   style={{ ...fieldBox(focusField==="phone"), ...inp() }} onFocus={()=>setFocusField("phone")} onBlur={()=>setFocusField(null)} />
        <input value={email} onChange={e => setEmail(e.target.value)} placeholder="Email address"  type="email" style={{ ...fieldBox(focusField==="email"), ...inp(), marginBottom: 20 }} onFocus={()=>setFocusField("email")} onBlur={()=>setFocusField(null)} />

        {/* ── Gratuity ── */}
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color: t.muted, marginBottom: 10 }}>
          GRATUITY <span style={{ fontWeight: 500, color: t.dim }}>(OPTIONAL)</span>
        </div>
        <div style={{ display: "flex", gap: 6, marginBottom: tipPct > 0 ? 8 : 20 }}>
          {[0, 15, 18, 20, 25].map(pct => (
            <button key={pct} onClick={() => setTipPct(pct)} style={{ flex: 1, padding: "11px 0", borderRadius: 10, border: `${tipPct===pct?2:1}px solid ${tipPct===pct?t.accent:t.border}`, background: tipPct===pct?t.accentSoft:t.card, color: tipPct===pct?t.accentText:t.text, fontSize: 12, fontWeight: tipPct===pct?700:500, cursor: "pointer", fontFamily: f }}>
              {pct === 0 ? "None" : `${pct}%`}
            </button>
          ))}
        </div>
        {tipPct > 0 && (
          <div style={{ fontSize: 13, color: t.sub, marginBottom: 20 }}>
            Tip: <strong style={{ color: t.text }}>${tipAmt}</strong>
            &nbsp;·&nbsp; Total charged: <strong style={{ color: t.text }}>${depositAmt + tipAmt}</strong>
            &nbsp;·&nbsp; Balance at apt: <strong style={{ color: t.text }}>${balanceDue}</strong>
          </div>
        )}

        {/* ── Deposit + SMS toggles ── */}
        <div style={{ borderRadius: 14, background: t.card, border: `1px solid ${t.border}`, overflow: "hidden", marginBottom: 20 }}>
          {[
            {
              icon: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={t.sub} strokeWidth="2" strokeLinecap="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>,
              title: "Require $10 deposit",
              sub: "Applied to final bill · refundable 24 hrs before",
              val: requireDeposit, onToggle: () => setRequireDeposit(!requireDeposit),
            },
            {
              icon: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={t.sub} strokeWidth="2" strokeLinecap="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
              title: "Send confirmation SMS",
              sub: "Booking details + 24-hr reminder",
              val: sendConfirmation, onToggle: () => setSendConfirmation(!sendConfirmation),
            },
          ].map((row, i, arr) => (
            <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 14, padding: "14px 16px", borderBottom: i < arr.length-1 ? `1px solid ${t.border}` : "none" }}>
              <div style={{ marginTop: 1, flexShrink: 0 }}>{row.icon}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: t.text, marginBottom: 2 }}>{row.title}</div>
                <div style={{ fontSize: 12, color: t.sub }}>{row.sub}</div>
              </div>
              <Toggle on={row.val} onToggle={row.onToggle} />
            </div>
          ))}
        </div>

        {/* ── PAYMENT METHOD SELECTOR ── */}
        {requireDeposit && (
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            {[{ id: "card", label: "💳 Card" }, { id: "interac", label: "🏦 Interac" }].map(m => (
              <button key={m.id} onClick={() => setDepositMethod(m.id)} style={{ flex: 1, padding: "10px 0", borderRadius: 12, border: `${depositMethod===m.id?2:1}px solid ${depositMethod===m.id?t.accent:t.border}`, background: depositMethod===m.id?t.accentSoft:t.card, color: depositMethod===m.id?t.accentText:t.text, fontSize: 13, fontWeight: depositMethod===m.id?700:500, cursor: "pointer", fontFamily: f }}>
                {m.label}
              </button>
            ))}
          </div>
        )}

        {requireDeposit && depositMethod === "interac" ? (
          <div style={{ padding: "16px", borderRadius: 14, background: t.greenBg, border: `1px solid ${t.green}20`, marginBottom: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: t.greenText, marginBottom: 8 }}>Send ${depositAmt} via Interac e-Transfer</div>
            <div style={{ fontSize: 12, color: t.sub, lineHeight: 1.7, marginBottom: 12 }}>
              1. Send to <strong style={{ color: t.text }}>deposits@yoursalon.com</strong><br/>
              2. Reference: <strong style={{ color: t.text }}>{bookingRef}</strong><br/>
              3. Your slot is held for 2 hours after you confirm
            </div>
            <button onClick={() => setInteracSent(true)} style={{ width: "100%", padding: "11px 0", borderRadius: 12, background: interacSent ? t.card : t.green, border: `1px solid ${t.green}`, cursor: "pointer", fontFamily: f, fontSize: 13, fontWeight: 700, color: interacSent ? t.greenText : "#fff" }}>
              {interacSent ? "✓ Transfer sent — slot held" : "I've sent the transfer →"}
            </button>
          </div>
        ) : (
          <div>

        {/* ── PAYMENT ── */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color: t.muted }}>PAYMENT</div>
          {/* Card type auto-detected from number */}
          {network && (
            <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 20, background: t.greenBg, border: `1px solid ${t.green}20` }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={t.greenText} strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
              <span style={{ fontSize: 11, fontWeight: 700, color: t.greenText }}>
                {network.charAt(0).toUpperCase() + network.slice(1)} detected
              </span>
            </div>
          )}
        </div>

        {/* Cardholder name */}
        <div style={{ ...fieldBox(focusField==="holder") }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: t.muted, marginBottom: 5, letterSpacing: 1 }}>CARDHOLDER NAME</div>
          <input
            value={cardHolder}
            onChange={e => setCardHolder(e.target.value)}
            onFocus={() => setFocusField("holder")}
            onBlur={() => setFocusField(null)}
            placeholder="Name as it appears on card"
            style={{ ...inp() }}
          />
        </div>

        {/* Card number — full row with network logo */}
        <div style={{ ...fieldBox(focusField==="num"), display: "flex", alignItems: "center", gap: 10 }}>
          {network ? (
            <NetworkLogo net={network} />
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={t.muted} strokeWidth="1.8" strokeLinecap="round">
              <rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/>
            </svg>
          )}
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: t.muted, marginBottom: 4, letterSpacing: 1 }}>CARD NUMBER</div>
            <input
              value={formatCardNum(rawNum)}
              onChange={e => handleCardNumChange(e.target.value)}
              onFocus={() => setFocusField("num")}
              onBlur={() => setFocusField(null)}
              placeholder="0000 0000 0000 0000"
              inputMode="numeric"
              style={{ ...inp({ fontFamily: "monospace", letterSpacing: 1.5, fontSize: 15 }) }}
            />
          </div>
          {network && rawNum.length >= 4 && (
            <div style={{ fontSize: 10, color: t.sub, flexShrink: 0, fontWeight: 600, background: t.inputBg, padding: "2px 6px", borderRadius: 6 }}>
              {network.charAt(0).toUpperCase() + network.slice(1)}
            </div>
          )}
        </div>

        {/* Expiry + CVC + Billing zip — row */}
        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <div style={{ ...fieldBox(focusField==="exp"), flex: 1, marginBottom: 0 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: t.muted, marginBottom: 4, letterSpacing: 1 }}>EXPIRY</div>
            <input
              value={expiry}
              onChange={e => handleExpiryChange(e.target.value)}
              onFocus={() => setFocusField("exp")}
              onBlur={() => setFocusField(null)}
              placeholder="MM/YY"
              inputMode="numeric"
              style={{ ...inp({ fontFamily: "monospace", letterSpacing: 1 }) }}
            />
          </div>
          <div style={{ ...fieldBox(focusField==="cvc"), flex: 1, marginBottom: 0 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: t.muted, marginBottom: 4, letterSpacing: 1 }}>CVC</div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <input
                value={cvc}
                onChange={e => setCvc(e.target.value.replace(/\D/g,"").slice(0, network==="amex"?4:3))}
                onFocus={() => setFocusField("cvc")}
                onBlur={() => setFocusField(null)}
                placeholder={network==="amex"?"4 digits":"3 digits"}
                inputMode="numeric"
                style={{ ...inp({ fontFamily: "monospace", letterSpacing: 1 }) }}
              />
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={t.muted} strokeWidth="1.5" strokeLinecap="round">
                <rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="10" y2="10"/>
                <rect x="3" y="13" width="4" height="3" rx="0.5" fill={t.muted} stroke="none"/>
              </svg>
            </div>
          </div>
        </div>

        {/* Billing address */}
        <div style={{ ...fieldBox(focusField==="addr") }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: t.muted, marginBottom: 5, letterSpacing: 1 }}>BILLING ADDRESS</div>
          <input
            value={billingAddr}
            onChange={e => setBillingAddr(e.target.value)}
            onFocus={() => setFocusField("addr")}
            onBlur={() => setFocusField(null)}
            placeholder="Street address"
            style={{ ...inp(), marginBottom: 8 }}
          />
          <div style={{ display: "flex", gap: 8 }}>
            <input
              value={billingCity}
              onChange={e => setBillingCity(e.target.value)}
              onFocus={() => setFocusField("addr")}
              onBlur={() => setFocusField(null)}
              placeholder="City"
              style={{ ...inp(), flex: 2 }}
            />
            <input
              value={billingZip}
              onChange={e => setBillingZip(e.target.value)}
              onFocus={() => setFocusField("addr")}
              onBlur={() => setFocusField(null)}
              placeholder="Postal code"
              inputMode="numeric"
              style={{ ...inp(), flex: 1 }}
            />
          </div>
        </div>

        {/* Save card on file */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 14, padding: "14px 16px", borderRadius: 13, background: t.card, border: `1px solid ${t.border}`, marginBottom: 12 }}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={t.sub} strokeWidth="2" strokeLinecap="round" style={{ marginTop: 1, flexShrink: 0 }}>
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
            <polyline points="17 21 17 13 7 13 7 21"/>
            <polyline points="7 3 7 8 15 8"/>
          </svg>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: t.text, marginBottom: 2 }}>Save card on file</div>
            <div style={{ fontSize: 12, color: t.sub, lineHeight: 1.5 }}>
              Securely stored via Stripe. Use for future bookings without re-entering details.
            </div>
          </div>
          <Toggle on={saveCard} onToggle={() => setSaveCard(!saveCard)} />
        </div>

        {/* Security badge */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: 10, background: t.inputBg, marginBottom: 4 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={t.green} strokeWidth="2.5" strokeLinecap="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          </svg>
          <span style={{ fontSize: 12, color: t.sub }}>
            Secured by <strong style={{ color: t.text }}>Stripe</strong> · 256-bit SSL encryption · PCI compliant
          </span>
        </div>
          </div>
        )}
      </div>

      {/* ── Pay CTA ── */}
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "12px 20px 22px", background: `linear-gradient(to top,${t.bg} 65%,transparent)` }}>
        {/* Order summary line */}
        {(requireDeposit || tipPct > 0) && (
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: t.sub, marginBottom: 10, padding: "0 2px" }}>
            <span>
              {requireDeposit ? `$${depositAmt} deposit` : "No deposit"}
              {tipPct > 0 ? ` + $${tipAmt} tip` : ""}
            </span>
            <span>Balance at apt: <strong style={{ color: t.text }}>${balanceDue}</strong></span>
          </div>
        )}
        <button
          onClick={() => onConfirm({ name, phone, email, tip: tipAmt, deposit: depositAmt, sendConfirmation, savedCard: saveCard })}
          disabled={!canPay}
          style={{ width: "100%", padding: "17px 0", borderRadius: 14, background: canPay ? `linear-gradient(135deg,#534AB7,#6D28D9)` : t.inputBg, color: canPay ? "#fff" : t.muted, border: "none", fontSize: 15, fontWeight: 700, cursor: canPay ? "pointer" : "default", fontFamily: f, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, transition: "all 0.2s" }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={canPay?"#fff":t.muted} strokeWidth="2.5" strokeLinecap="round">
            <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
          {!canPay
            ? "Enter card details to continue"
            : requireDeposit
              ? `Pay $${depositAmt + tipAmt} & book`
              : "Book appointment"
          }
        </button>
        {canPay && (
          <div style={{ textAlign: "center", fontSize: 11, color: t.dim, marginTop: 7 }}>
            {requireDeposit
              ? `$${balanceDue} balance due at your appointment`
              : "No charge today · pay at appointment"}
            {saveCard ? " · Card saved securely" : ""}
          </div>
        )}
      </div>
    </div>
  );
}

function BStep4({ t, service, booking, customer, onClose }) {
  const [shown, setShown] = useState(false);
  useEffect(() => { const tm = setTimeout(() => setShown(true), 600); return () => clearTimeout(tm); }, []);
  const depositAmt = customer.deposit || 10;
  const tipAmt = customer.tip || 0;
  const balanceDue = service.price + tipAmt - depositAmt;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: t.bg }}>
      <div style={{ flex: 1, overflowY: "auto", padding: "0 24px 110px" }}>
        {/* Success hero */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 44, paddingBottom: 28, animation: "successPop 0.6s cubic-bezier(0.34,1.56,0.64,1) both" }}>
          <div style={{ width: 76, height: 76, borderRadius: 38, background: "linear-gradient(135deg,#22C55E,#15803D)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 8px 28px rgba(34,197,94,0.35)", marginBottom: 22 }}>
            <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, color: t.text, textAlign: "center", marginBottom: 8, letterSpacing: -0.5 }}>
            You're booked, {customer.name.split(" ")[0]}!
          </div>
          <div style={{ fontSize: 14, color: t.sub, textAlign: "center", lineHeight: 1.6 }}>
            See you Thursday at {booking.time}.
          </div>
        </div>

        {shown && (
          <>
            {/* Booking details card */}
            <div style={{ borderRadius: 16, background: t.card, border: `1px solid ${t.border}`, overflow: "hidden", marginBottom: 14, boxShadow: t.shadow, animation: "fadeUp 0.4s ease 0.1s both" }}>
              {[
                { label: "Service", value: `${service.name} · ${service.duration}` },
                { label: "Barber", value: booking.staff.name === "Anyone" ? "First available" : booking.staff.name },
                { label: "When", value: `Thu May 8 · ${booking.time}` },
                { label: "Deposit paid", value: `$${depositAmt} ✓`, green: true },
                ...(tipAmt > 0 ? [{ label: "Gratuity", value: `$${tipAmt}`, green: true }] : []),
                { label: "Balance due at apt.", value: `$${balanceDue}`, bold: true },
              ].map((row, i, arr) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "13px 18px", borderBottom: i < arr.length - 1 ? `1px solid ${t.border}` : "none" }}>
                  <span style={{ fontSize: 13, color: t.sub }}>{row.label}</span>
                  <span style={{ fontSize: 13, fontWeight: row.bold ? 800 : 700, color: row.green ? t.greenText : t.text }}>{row.value}</span>
                </div>
              ))}
            </div>

            {/* Confirmation sent */}
            {customer.sendConfirmation && (
              <div style={{ padding: "14px 16px", borderRadius: 14, background: t.greenBg, border: `1px solid ${t.green}20`, marginBottom: 14, display: "flex", alignItems: "flex-start", gap: 12, animation: "fadeUp 0.4s ease 0.2s both" }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={t.greenText} strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0, marginTop: 1 }}>
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: t.greenText, marginBottom: 3 }}>Confirmation sent</div>
                  <div style={{ fontSize: 12, color: t.greenText, lineHeight: 1.5 }}>
                    SMS sent to {customer.phone}.<br/>Reminder 24hrs before your appointment.
                  </div>
                </div>
              </div>
            )}

            {/* Email receipt */}
            <div style={{ padding: "14px 16px", borderRadius: 14, background: t.accentSoft, border: `1px solid ${t.accent}20`, marginBottom: 14, animation: "fadeUp 0.4s ease 0.25s both" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={t.accentText} strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0 }}>
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
                </svg>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: t.accentText }}>Receipt emailed</div>
                  <div style={{ fontSize: 12, color: t.accentText, opacity: 0.8 }}>{customer.email}</div>
                </div>
              </div>
            </div>

            {/* Add to calendar */}
            <div style={{ padding: "14px 16px", borderRadius: 14, background: t.card, border: `1px solid ${t.border}`, marginBottom: 4, cursor: "pointer", display: "flex", alignItems: "center", gap: 12, animation: "fadeUp 0.4s ease 0.3s both" }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: t.accentSoft, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={t.accentText} strokeWidth="2" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: t.text }}>Add to calendar</div>
                <div style={{ fontSize: 12, color: t.sub }}>Thu May 8 · {booking.time}</div>
              </div>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={t.dim} strokeWidth="2.5" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
            </div>
          </>
        )}
      </div>

      {shown && (
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "12px 20px 20px", background: `linear-gradient(to top,${t.bg} 70%,transparent)`, animation: "fadeUp 0.4s ease 0.4s both" }}>
          <button onClick={onClose} style={{ width: "100%", padding: "17px 0", borderRadius: 14, background: `linear-gradient(135deg,${t.accent},#6D28D9)`, color: "#fff", border: "none", fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: f }}>Done</button>
        </div>
      )}
    </div>
  );
}

function ClientBookingFlow({ t, onClose }) {
  const [step, setStep] = useState(1);
  const [service, setService] = useState(null);
  const [booking, setBooking] = useState(null);
  const [customer, setCustomer] = useState(null);
  const times = ["2:14 PM", "2:15 PM", "2:16 PM", "2:16 PM"];
  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 200, borderRadius: 41, overflow: "hidden", background: t.bg, display: "flex", flexDirection: "column", animation: "slideOverlay 0.3s ease both" }}>
      <div style={{ display: "flex", justifyContent: "space-between", padding: "14px 28px 0", height: 36, flexShrink: 0, position: step === 1 ? "absolute" : "relative", top: 0, left: 0, right: 0, zIndex: 10 }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: step === 1 ? "#fff" : t.statusBar }}>{times[step - 1]}</span>
      </div>
      {step < 4 && (
        <div style={{ display: "flex", justifyContent: "center", gap: 6, padding: step === 1 ? "52px 0 0" : "10px 0 4px", position: step === 1 ? "absolute" : "relative", top: 0, left: 0, right: 0, zIndex: 10, flexShrink: 0 }}>
          {[1, 2, 3].map(n => <div key={n} style={{ height: 3, borderRadius: 2, width: n === step ? 20 : 8, background: step === 1 ? (n <= step ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.3)") : (n <= step ? t.accent : t.border), transition: "all 0.3s" }} />)}
        </div>
      )}
      <button onClick={onClose} style={{ position: "absolute", top: 50, right: 16, zIndex: 20, width: 30, height: 30, borderRadius: 15, background: step === 1 ? "rgba(255,255,255,0.2)" : t.inputBg, border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={step === 1 ? "#fff" : t.text} strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
      <div style={{ flex: 1, position: "relative", overflow: "hidden", marginTop: step === 1 ? 0 : 8 }}>
        {step === 1 && <BStep1 t={t} onNext={svc => { setService(svc); setStep(2); }} />}
        {step === 2 && <BStep2 t={t} service={service} onBack={() => setStep(1)} onNext={bk => { setBooking(bk); setStep(3); }} />}
        {step === 3 && <BStep3 t={t} service={service} booking={booking} onBack={() => setStep(2)} onConfirm={cust => { setCustomer(cust); setStep(4); }} />}
        {step === 4 && <BStep4 t={t} service={service} booking={booking} customer={customer} onClose={onClose} />}
      </div>
    </div>
  );
}

function BookingLinkCard({ t, onPreview }) {
  const [copied, setCopied] = useState(false);
  const [sentTo, setSentTo] = useState(null);

  const shareActions = [
    { id: "ig",      label: "Instagram bio", icon: "📸", action: () => setSentTo("ig") },
    { id: "sms",     label: "SMS blast",     icon: "💬", action: () => setSentTo("sms") },
    { id: "email",   label: "Email sig",     icon: "✉️", action: () => setSentTo("email") },
    { id: "preview", label: "Preview",       icon: "👁",  action: onPreview, accent: true },
  ];

  return (
    <div style={{ margin: "0 20px 14px", padding: "16px 16px 14px", borderRadius: 16, background: t.card, border: `1px solid ${t.border}`, boxShadow: t.shadow }}>
      {/* Label */}
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 10 }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={t.accentText} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
        </svg>
        <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1.5, color: t.accentText }}>YOUR BOOKING LINK</span>
      </div>

      {/* Link row — URL + Copy button */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderRadius: 10, background: t.inputBg, border: `1px solid ${t.border}`, marginBottom: 10 }}>
        <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: t.accentText, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          stridcuts.flatpurse.app/book
        </span>
        <button
          onClick={() => { setCopied(true); setTimeout(() => setCopied(false), 2000); }}
          style={{ padding: "5px 12px", borderRadius: 7, background: copied ? t.greenBg : t.accentSoft, border: "none", cursor: "pointer", fontFamily: f, fontSize: 12, fontWeight: 700, color: copied ? t.greenText : t.accentText, flexShrink: 0, transition: "all 0.2s" }}>
          {copied ? "✓ Copied" : "Copy"}
        </button>
      </div>

      {/* Share actions — 4-col grid, each button contained */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6 }}>
        {shareActions.map(btn => (
          <button
            key={btn.id}
            onClick={() => { btn.action(); }}
            style={{
              padding: "9px 4px 8px",
              borderRadius: 10,
              border: `1px solid ${sentTo === btn.id ? t.accent + "40" : btn.accent ? t.accent + "20" : t.border}`,
              background: sentTo === btn.id ? t.greenBg : btn.accent ? t.accentSoft : t.inputBg,
              cursor: "pointer", fontFamily: f,
              display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
              transition: "all 0.15s",
              minWidth: 0,
            }}>
            <span style={{ fontSize: 16, lineHeight: 1 }}>{sentTo === btn.id ? "✓" : btn.icon}</span>
            <span style={{ fontSize: 10, fontWeight: btn.accent ? 700 : 600, color: sentTo === btn.id ? t.greenText : btn.accent ? t.accentText : t.sub, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%" }}>
              {btn.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── HOME ──────────────────────────────────────────────────────────
function HomeEmpty({ t }) {
  const [pulse, setPulse] = useState(true);
  useEffect(() => { const i = setInterval(() => { setPulse(false); setTimeout(() => setPulse(true), 80); }, 3000); return () => clearInterval(i); }, []);
  return (
    <div style={{ padding: "0 20px 20px" }}>
      <div style={{ borderRadius: 20, padding: "22px 24px 20px", marginBottom: 14, background: t.card, border: `1px solid ${t.border}`, boxShadow: t.shadow }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <div style={{ width: 12, height: 12, position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ width: 8, height: 8, borderRadius: 4, background: "#22C55E", position: "relative", zIndex: 2 }} />
            <div style={{ position: "absolute", width: 8, height: 8, borderRadius: 4, background: "#22C55E", animation: "pulseRing 2.5s ease-out infinite", zIndex: 1, opacity: pulse ? 1 : 0 }} />
          </div>
          <span style={{ fontSize: 11, fontWeight: 700, color: "#22C55E", letterSpacing: 1.5 }}>AUTOPILOT IS WATCHING</span>
        </div>
        <div style={{ fontSize: 32, fontWeight: 800, lineHeight: 1.1, letterSpacing: -1, marginBottom: 10, whiteSpace: "pre-line", color: t.text }}>Ready to earn{"\n"}for you</div>
        <div style={{ fontSize: 14, color: t.sub, lineHeight: 1.55 }}>First booking arrives, AutoPilot kicks in.</div>
      </div>
      {[
        { icon: "📅", bg: t.accentSoft, title: "Today's bookings", meta: "Calendar is open" },
        { icon: "👥", bg: t.blueBg, title: "Add your team", meta: "Stylists, barbers, therapists" },
        { icon: "🏠", bg: t.greenBg, title: "Family Hours active", meta: "Tonight 6–8 PM · Day 1" },
      ].map((r, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px 18px", borderRadius: 16, border: `1px solid ${t.border}`, background: t.card, cursor: "pointer", marginBottom: 8, boxShadow: t.shadow }}>
          <div style={{ width: 42, height: 42, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", background: r.bg, flexShrink: 0 }}><span style={{ fontSize: 18 }}>{r.icon}</span></div>
          <div style={{ flex: 1 }}><div style={{ fontSize: 15, fontWeight: 600, color: t.text, marginBottom: 2 }}>{r.title}</div><div style={{ fontSize: 13, color: t.sub }}>{r.meta}</div></div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={t.dim} strokeWidth="2.5" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
        </div>
      ))}
    </div>
  );
}

function HomePopulated({ t }) {
  const [pulse, setPulse] = useState(true);
  useEffect(() => { const i = setInterval(() => { setPulse(false); setTimeout(() => setPulse(true), 80); }, 3000); return () => clearInterval(i); }, []);
  return (
    <div style={{ padding: "0 20px 20px" }}>
      <div style={{ borderRadius: 20, padding: "22px 24px 20px", marginBottom: 14, background: t.card, border: `1px solid ${t.border}`, boxShadow: t.shadow }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <div style={{ width: 12, height: 12, position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ width: 8, height: 8, borderRadius: 4, background: "#22C55E", position: "relative", zIndex: 2 }} />
            <div style={{ position: "absolute", width: 8, height: 8, borderRadius: 4, background: "#22C55E", animation: "pulseRing 2.5s ease-out infinite", zIndex: 1, opacity: pulse ? 1 : 0 }} />
          </div>
          <span style={{ fontSize: 11, fontWeight: 700, color: "#22C55E", letterSpacing: 1.5 }}>AUTOPILOT IS ON</span>
        </div>
        <div style={{ fontSize: 48, fontWeight: 700, letterSpacing: -2, lineHeight: 1, marginBottom: 6, color: t.text }}>$<AnimCount target={8240} /></div>
        <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 20, color: t.sub }}>recovered this month while you were off</div>
        <div style={{ display: "flex", alignItems: "center", borderTop: `1px solid ${t.border}`, paddingTop: 16 }}>
          {[{ v: "+$340", l: "Today" }, { v: "3", l: "Slots filled" }, { v: "2", l: "No-shows saved" }].map((s, i) => (
            <div key={i} style={{ display: "contents" }}>
              {i > 0 && <div style={{ width: 1, height: 28, margin: "0 4px", background: t.border }} />}
              <div style={{ flex: 1 }}><div style={{ fontSize: 16, fontWeight: 700, color: t.text, marginBottom: 2 }}>{s.v}</div><div style={{ fontSize: 11, color: t.muted }}>{s.l}</div></div>
            </div>
          ))}
        </div>
      </div>
      {/* ── Trust badge — marketplace-free promise ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 14, padding: "10px 16px", borderRadius: 12, background: t.inputBg, border: `1px solid ${t.border}`, marginBottom: 12 }}>
        {["No marketplace", "No commission", "Your clients, always"].map((txt, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 4 }}>
            {i > 0 && <div style={{ width: 3, height: 3, borderRadius: "50%", background: t.muted, opacity: 0.4 }} />}
            <span style={{ fontSize: 10, fontWeight: 700, color: t.muted, whiteSpace: "nowrap" }}>{txt}</span>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
        <button style={{ padding: "16px 12px", border: `1.5px solid ${t.border}`, borderRadius: 16, fontSize: 14, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontFamily: f, background: t.card, color: t.text, boxShadow: t.shadow }}>
          <span style={{ color: t.accent }}>✦</span>Fill 4 slots (+$280)
        </button>
        <button
          onClick={() => queueOfflineOp("cash_mode_open", { ts: Date.now() })}
          style={{ padding: "16px 12px", border: "2px solid #D97706", borderRadius: 16, fontSize: 14, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontFamily: f, background: "#FEF3C7", color: "#D97706", boxShadow: t.shadow }}>
          💵 Cash Mode
        </button>
      </div>
      {[
        { icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={t.accentText} strokeWidth="2.2" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>, bg: t.accentSoft, title: "Today's bookings", meta: "14 of 18 · next at 10:00 AM", badge: null },
        { icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={t.yellowText} strokeWidth="2.2" strokeLinecap="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>, bg: t.yellowBg, title: "Needs your eyes", meta: "2 things · Marcus, Lisa", badge: 2 },
        { icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={t.greenText} strokeWidth="2.2" strokeLinecap="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>, bg: t.greenBg, title: "Family Hours active", meta: "Tonight 6–8 PM · 12-day streak", badge: null },
        { icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#7C5CFC" strokeWidth="2.2" strokeLinecap="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>, bg: "rgba(124,92,252,0.08)", title: "This month", meta: "$12,458 · +8.2%", badge: null },
      ].map((r, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px 18px", borderRadius: 16, border: `1px solid ${t.border}`, background: t.card, cursor: "pointer", marginBottom: 8, boxShadow: t.shadow }}>
          <div style={{ width: 42, height: 42, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", background: r.bg, flexShrink: 0 }}>{r.icon}</div>
          <div style={{ flex: 1 }}><div style={{ fontSize: 15, fontWeight: 600, color: t.text, marginBottom: 2 }}>{r.title}</div><div style={{ fontSize: 13, color: t.sub }}>{r.meta}</div></div>
          {r.badge && <div style={{ width: 22, height: 22, borderRadius: 11, background: t.accent, color: "#fff", fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>{r.badge}</div>}
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={t.dim} strokeWidth="2.5" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
        </div>
      ))}
    </div>
  );
}

// ─── BOOKINGS SCREEN ───────────────────────────────────────────────
function BookingsScreen({ t, isSetup, onPreviewBooking, onNewAppointment, onViewAppointment, onViewClient }) {
  const [viewMode, setViewMode] = useState("Day");
  const [activeSlot, setActiveSlot] = useState("11:00");
  const slots = [
    { time: "10:00", type: "booking", name: "Sarah Johnson", service: "Hair styling · Emma · $125", sColor: "green", vip: true, aptData: true },
    { time: "11:00", type: "open", lost: 70 },
    { time: "12:30", type: "booking", name: "Michael Chen", service: "Massage · John · $95", sColor: "green" },
    { time: "2:00", type: "booking", name: "Emma Wilson", service: "Facial · Emma · $85", sColor: "yellow" },
    { time: "3:00", type: "open", lost: 70 },
    { time: "4:00", type: "booking", name: "James Brown", service: "Training · Mike · $75", sColor: "green" },
    { time: "6:00", type: "family" },
  ];

  return (
    <div style={{ padding: "0 20px 24px" }}>
      {!isSetup && <BookingLinkCard t={t} onPreview={onPreviewBooking} />}
      <div style={{ display: "flex", borderRadius: 10, padding: 3, marginBottom: 14, background: t.inputBg, border: `1px solid ${t.border}` }}>
        {["Day", "Week", "List"].map((m) => <button key={m} onClick={() => setViewMode(m)} style={{ flex: 1, padding: "9px 0", borderRadius: 8, fontSize: 13, border: "none", cursor: "pointer", fontFamily: f, background: viewMode === m ? t.card : "transparent", color: viewMode === m ? t.text : t.muted, fontWeight: viewMode === m ? 700 : 500 }}>{m}</button>)}
      </div>

      {isSetup ? (
        <>
          <div style={{ textAlign: "center", padding: "40px 20px 28px" }}>
            <div style={{ width: 64, height: 64, borderRadius: 20, background: t.accentSoft, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={t.accent} strokeWidth="1.8" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="10" y1="14" x2="14" y2="14"/><line x1="12" y1="12" x2="12" y2="16"/></svg>
            </div>
            <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 10, color: t.text, margin: "0 0 10px" }}>Calendar's wide open</h3>
            <p style={{ fontSize: 14, color: t.sub, lineHeight: 1.6, maxWidth: 280, margin: "0 auto" }}>Share your booking link or add an appointment manually.</p>
          </div>
          <button onClick={onPreviewBooking} style={{ width: "100%", padding: "16px 0", borderRadius: 14, color: "#fff", border: "none", fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: f, marginBottom: 10, background: t.accent }}>Copy my booking link</button>
          <button onClick={onNewAppointment} style={{ width: "100%", padding: "14px 0", borderRadius: 14, background: "transparent", border: `1.5px solid ${t.border}`, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: f, color: t.text }}>+ Add manual booking</button>
        </>
      ) : (
        <>
          {/* AI fill banner */}
          <button style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", borderRadius: 14, background: t.accentSoft, border: `1px solid ${t.accent}20`, cursor: "pointer", fontFamily: f, marginBottom: 14 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={t.accent} strokeWidth="2.5" strokeLinecap="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
            <div style={{ flex: 1, textAlign: "left" }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: t.text }}>14 of 18 booked · 4 gaps left</div>
              <div style={{ fontSize: 12, color: t.accentText, fontWeight: 600 }}>Fill all with AI + Payment</div>
            </div>
          </button>

          {/* ─── DAY VIEW ─── */}
          {viewMode === "Day" && slots.map((slot, i) => (
            <div key={i} style={{ display: "flex", alignItems: "flex-start", minHeight: 54, marginBottom: 4 }}>
              <div style={{ width: 48, fontSize: 12, fontWeight: 600, paddingTop: 4, flexShrink: 0, textAlign: "right", paddingRight: 12, color: t.muted }}>{slot.time}</div>
              <div style={{ width: 1, background: t.border, alignSelf: "stretch", flexShrink: 0, marginTop: 4 }} />
              {slot.type === "booking" && (
                <div style={{ flex: 1, marginLeft: 12, padding: "10px 12px", borderRadius: 10, borderLeft: `3px solid ${slot.sColor === "green" ? t.green : t.yellow}`, background: slot.sColor === "green" ? t.greenBg : t.yellowBg, marginTop: 2 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div onClick={() => slot.aptData && onViewAppointment && onViewAppointment()} style={{ fontSize: 13, fontWeight: 700, color: t.text, cursor: slot.aptData ? "pointer" : "default" }}>{slot.vip ? "⭐ " : ""}{slot.name}</div>
                    <button onClick={() => onViewClient && onViewClient(slot.name)} style={{ background: "none", border: "none", cursor: "pointer", padding: "2px 4px", fontSize: 10, fontWeight: 700, color: t.accentText, fontFamily: f }}>Profile →</button>
                  </div>
                  <div style={{ fontSize: 11, color: t.sub, marginTop: 2 }}>{slot.service}</div>
                </div>
              )}
              {slot.type === "open" && (
                <div onClick={() => setActiveSlot(slot.time)} style={{ flex: 1, marginLeft: 12, padding: slot.time === activeSlot ? "14px 16px" : "12px 14px", borderRadius: 12, border: slot.time === activeSlot ? `2px solid ${t.pink}` : `1.5px dashed ${t.pink}50`, background: `${t.pinkBg}80`, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", marginTop: 2 }}>
                  <span style={{ fontSize: 13, color: t.pinkText, fontWeight: 600 }}>Open · ${slot.lost} lost</span>
                </div>
              )}
              {slot.type === "family" && (
                <div style={{ flex: 1, marginLeft: 12, padding: "12px 14px", borderRadius: 10, borderLeft: `3px solid ${t.green}`, background: t.greenBg, marginTop: 2 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: t.greenText }}>🏠 Family Time</div>
                  <div style={{ fontSize: 11, color: t.sub, marginTop: 2 }}>Until 8:00 PM</div>
                </div>
              )}
            </div>
          ))}

          {/* ─── WEEK VIEW ─── */}
          {viewMode === "Week" && (() => {
            const days = [
              { day: "Mon", date: 5, bookings: 12, total: 18, rev: "$960" },
              { day: "Tue", date: 6, bookings: 15, total: 18, rev: "$1,125" },
              { day: "Wed", date: 7, bookings: 14, total: 18, rev: "$1,050", today: true },
              { day: "Thu", date: 8, bookings: 10, total: 18, rev: "$750" },
              { day: "Fri", date: 9, bookings: 16, total: 18, rev: "$1,280" },
              { day: "Sat", date: 10, bookings: 8, total: 14, rev: "$640" },
              { day: "Sun", date: 11, bookings: 0, total: 0, rev: "$0", closed: true },
            ];
            return (
              <div>
                {/* Day column headers */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, marginBottom: 10 }}>
                  {days.map(d => (
                    <div key={d.day} style={{ textAlign: "center", padding: "10px 2px", borderRadius: 12, background: d.today ? t.accent : d.closed ? t.inputBg : t.card, border: `1px solid ${d.today ? t.accent : t.border}`, opacity: d.closed ? 0.45 : 1 }}>
                      <div style={{ fontSize: 9, fontWeight: 700, color: d.today ? "rgba(255,255,255,0.75)" : t.muted, marginBottom: 3 }}>{d.day}</div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: d.today ? "#fff" : t.text }}>{d.date}</div>
                      {!d.closed && (
                        <div style={{ fontSize: 9, color: d.today ? "rgba(255,255,255,0.8)" : t.sub, marginTop: 3 }}>{d.bookings}/{d.total}</div>
                      )}
                    </div>
                  ))}
                </div>
                {/* Revenue summary */}
                <div style={{ borderRadius: 14, background: t.card, border: `1px solid ${t.border}`, padding: "14px 16px", marginBottom: 10 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.2, color: t.muted, marginBottom: 10 }}>WEEK REVENUE</div>
                  {days.filter(d => !d.closed).map((d, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 7 }}>
                      <div style={{ width: 28, fontSize: 11, fontWeight: d.today ? 700 : 500, color: d.today ? t.accentText : t.muted }}>{d.day}</div>
                      <div style={{ flex: 1, height: 6, borderRadius: 3, background: t.inputBg, overflow: "hidden" }}>
                        <div style={{ width: `${(d.bookings / d.total) * 100}%`, height: "100%", borderRadius: 3, background: d.today ? t.accent : t.green }} />
                      </div>
                      <div style={{ width: 44, fontSize: 11, fontWeight: 600, color: t.text, textAlign: "right" }}>{d.rev}</div>
                    </div>
                  ))}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                  {[["Week total", "$5,805"], ["Avg/day", "$967"], ["Open slots", "12 left"]].map(([l, v], i) => (
                    <div key={i} style={{ padding: "12px 12px", borderRadius: 12, background: t.card, border: `1px solid ${t.border}`, textAlign: "center" }}>
                      <div style={{ fontSize: 9, color: t.muted, fontWeight: 600, marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.8 }}>{l}</div>
                      <div style={{ fontSize: 15, fontWeight: 800, color: t.text }}>{v}</div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* ─── LIST VIEW ─── */}
          {viewMode === "List" && (() => {
            const listSlots = slots.filter(s => s.type === "booking");
            return (
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.2, color: t.muted, marginBottom: 10 }}>ALL BOOKINGS · WED MAY 7</div>
                {listSlots.map((slot, i) => (
                  <div key={i} onClick={() => slot.aptData && onViewAppointment && onViewAppointment()} style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 14px", borderRadius: 14, background: t.card, border: `1px solid ${t.border}`, marginBottom: 8, cursor: slot.aptData ? "pointer" : "default", boxShadow: t.shadow }}>
                    <div style={{ width: 40, height: 40, borderRadius: 12, background: slot.sColor === "green" ? t.greenBg : t.yellowBg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <span style={{ fontSize: 9, fontWeight: 700, color: slot.sColor === "green" ? t.greenText : t.yellowText }}>{slot.time}</span>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: t.text, marginBottom: 2 }}>{slot.vip ? "⭐ " : ""}{slot.name}</div>
                      <div style={{ fontSize: 12, color: t.sub }}>{slot.service}</div>
                    </div>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={t.dim} strokeWidth="2.5" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
                  </div>
                ))}
                {/* Open slots in list view */}
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.2, color: t.muted, marginBottom: 10, marginTop: 6 }}>OPEN SLOTS</div>
                {slots.filter(s => s.type === "open").map((slot, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 14px", borderRadius: 14, background: t.pinkBg, border: `1.5px dashed ${t.pink}50`, marginBottom: 8 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 12, background: `${t.pinkBg}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <span style={{ fontSize: 9, fontWeight: 700, color: t.pinkText }}>{slot.time}</span>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: t.pinkText }}>Open slot</div>
                      <div style={{ fontSize: 12, color: t.pinkText, opacity: 0.7 }}>${slot.lost} potential revenue</div>
                    </div>
                    <button style={{ padding: "6px 12px", borderRadius: 8, background: t.accent, border: "none", cursor: "pointer", fontFamily: f, fontSize: 11, fontWeight: 700, color: "#fff" }}>Fill →</button>
                  </div>
                ))}
              </div>
            );
          })()}
        </>
      )}
    </div>
  );
}

// ─── TEAM ──────────────────────────────────────────────────────────
function TeamScreen({ t, isSetup }) {
  const [staffDetail, setStaffDetail] = useState(null);
  const [period, setPeriod] = useState("This week");
  const staff = [
    { initials: "MJ", name: "Marcus Johnson", role: "Stylist", color: "#16A34A", bookings: 19, revenue: "$1,483", noShows: 2, alert: "Rebook rate dropped 26 pts" },
    { initials: "EW", name: "Emma Wilson", role: "Esthetician", color: "#534AB7", bookings: 22, revenue: "$1,870", noShows: 0, alert: null },
    { initials: "JT", name: "John Torres", role: "Massage Therapist", color: "#0891B2", bookings: 16, revenue: "$1,520", noShows: 1, alert: null },
    { initials: "LK", name: "Lisa Kim", role: "Stylist", color: "#DB2777", bookings: 24, revenue: "$2,040", noShows: 0, alert: null },
  ];

  if (staffDetail) {
    const trendData = [76, 78, 80, 78, 77, 74, 65, 52];
    const trendW = 300; const trendH = 80;
    return (
      <div style={{ padding: "0 20px 20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 14 }}>
          <div style={{ width: 56, height: 56, borderRadius: 28, background: "#16A34A", color: "#fff", fontSize: 20, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>MJ</div>
          <div><div style={{ fontSize: 20, fontWeight: 800, color: t.text }}>Marcus Johnson</div><div style={{ fontSize: 13, color: t.sub }}>Stylist · 60% commission</div></div>
        </div>
        <div style={{ padding: "16px 18px", borderRadius: 14, background: t.pinkBg, border: `1px solid ${t.pink}30`, marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, color: t.pinkText, marginBottom: 8 }}>⚠ NEEDS ATTENTION</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: t.text, marginBottom: 4 }}>Rebook rate dropped 26 points</div>
          <div style={{ fontSize: 13, color: t.sub }}>From 78% avg to 52% this week.</div>
        </div>
        <div style={{ display: "flex", borderRadius: 10, padding: 3, marginBottom: 14, background: t.inputBg, border: `1px solid ${t.border}` }}>
          {["This week", "Month", "Quarter"].map((p) => <button key={p} onClick={() => setPeriod(p)} style={{ flex: 1, padding: "9px 0", borderRadius: 8, fontSize: 13, border: "none", cursor: "pointer", fontFamily: f, background: period === p ? t.card : "transparent", color: period === p ? t.text : t.muted, fontWeight: period === p ? 700 : 500 }}>{p}</button>)}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
          {[{ label: "Commissions", val: "$890", delta: "−14%", dColor: t.pinkText }, { label: "Revenue", val: "$1,483", delta: "−14%", dColor: t.pinkText }, { label: "Bookings", val: "19", delta: "22 last wk", dColor: t.sub }, { label: "Tips", val: "$142", delta: "7.5% avg", dColor: t.sub }].map((m, i) => (
            <div key={i} style={{ padding: "14px 16px", background: t.card, borderRadius: 14, border: `1px solid ${t.border}`, boxShadow: t.shadow }}>
              <div style={{ fontSize: 11, color: t.muted, marginBottom: 6 }}>{m.label}</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: t.text }}>{m.val}</div>
              <div style={{ fontSize: 11, color: m.dColor, fontWeight: 600, marginTop: 3 }}>{m.delta}</div>
            </div>
          ))}
        </div>
        <div style={{ padding: "18px 16px", background: t.card, borderRadius: 14, border: `1px solid ${t.border}` }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.2, color: t.muted, marginBottom: 10 }}>REBOOK TREND · 8 WEEKS</div>
          <svg width={trendW} height={trendH + 20} viewBox={`0 0 ${trendW} ${trendH + 20}`} style={{ width: "100%", height: "auto" }}>
            <line x1="0" y1={trendH - 0.78 * trendH} x2={trendW} y2={trendH - 0.78 * trendH} stroke={t.green} strokeWidth="1.5" strokeDasharray="6 4" opacity="0.5" />
            <text x="4" y={trendH - 0.78 * trendH - 4} fill={t.green} fontSize="10" fontWeight="600">78% avg</text>
            <polyline fill="none" stroke={t.accent} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" points={trendData.map((v, i) => `${(i / 7) * (trendW - 20) + 10},${trendH - (v / 100) * trendH}`).join(" ")} />
            <circle cx={(trendW - 20) + 10} cy={trendH - 0.52 * trendH} r="5" fill="#EF4444" stroke={t.card} strokeWidth="2" />
            <text x={(trendW - 20) + 10} y={trendH - 0.52 * trendH + 16} fill="#EF4444" fontSize="10" fontWeight="700" textAnchor="middle">52%</text>
          </svg>
        </div>
      </div>
    );
  }

  if (isSetup) return (
    <div style={{ padding: "0 20px 20px" }}>
      <div style={{ textAlign: "center", padding: "48px 20px 28px" }}>
        <div style={{ width: 64, height: 64, borderRadius: 20, background: "rgba(219,39,119,0.08)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#DB2777" strokeWidth="1.8" strokeLinecap="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="17" y1="11" x2="23" y2="11"/></svg>
        </div>
        <h3 style={{ fontSize: 20, fontWeight: 700, color: t.text, margin: "0 0 10px" }}>Add your team when ready</h3>
        <p style={{ fontSize: 14, color: t.sub, lineHeight: 1.6, maxWidth: 280, margin: "0 auto" }}>Each member gets their own calendar column.</p>
      </div>
      <button style={{ width: "100%", padding: "16px 0", borderRadius: 14, color: "#fff", border: "none", fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: f, background: t.accent }}>Add a team member</button>
    </div>
  );

  return (
    <div style={{ padding: "0 20px 20px" }}>
      {staff.map((s, i) => (
        <div key={i} onClick={() => setStaffDetail(s.name)} style={{ padding: "16px 18px", background: t.card, borderRadius: 16, border: `1px solid ${t.border}`, marginBottom: 8, cursor: "pointer", boxShadow: t.shadow }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: s.alert ? 10 : 0 }}>
            <div style={{ width: 46, height: 46, borderRadius: 23, background: s.color, color: "#fff", fontSize: 15, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{s.initials}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: t.text }}>{s.name}</div>
              <div style={{ fontSize: 12, color: t.sub, marginTop: 2 }}>{s.role} · {s.bookings} bookings · {s.revenue}</div>
              <div style={{ fontSize: 11, color: s.noShows > 0 ? "#D97706" : t.muted, marginTop: 2, fontWeight: s.noShows > 0 ? 600 : 400 }}>
                No-show rate: {s.bookings > 0 ? Math.round(s.noShows / s.bookings * 100) : 0}% ({s.noShows} of {s.bookings})
              </div>
            </div>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={t.dim} strokeWidth="2.5" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
          </div>
          {s.alert && <div style={{ padding: "8px 12px", borderRadius: 8, background: t.pinkBg, fontSize: 12, fontWeight: 600, color: t.pinkText }}>⚠️ {s.alert}</div>}
        </div>
      ))}
    </div>
  );
}

// ─── AUTOPILOT ─────────────────────────────────────────────────────
// ── Shared Lisa data — used by AutoPilotWinBack + DailyBrief ──────
const LISA_BRIEF = {
  name: "Lisa Park",
  phone: "+1 587 444 9102",
  ltv: 4800,
  daysSince: 67,
  lastService: "Balayage",
};

// ── SMS send helper — wire your Twilio credentials here ──────────
// In production: move ACCOUNT_SID + AUTH_TOKEN to a server-side
// edge function (Vercel/Azure Function) so they're never in the client.
// For now this calls your backend endpoint which proxies to Twilio.
async function sendWinBackSMS(toPhone, message) {
  console.log("📱 Sending win-back SMS to", toPhone);
  console.log("   Message:", message);
  try {
    // ── Option A: backend endpoint (Twilio via server) ──
    const res = await fetch("/api/messaging/sms/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to: toPhone, body: message }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "SMS send failed");
    console.log("✅ SMS sent:", data.sid);
    return data.sid;
  } catch (err) {
    console.error("❌ SMS send failed:", err);
    throw err;
  }
}

// ── AutoPilotWinBack — standalone card rendered inside AutoPilotScreen ──
function AutoPilotWinBack({ t }) {
  const [state, setState] = useState("idle"); // idle | sending | sent | error
  const [previewMsg, setPreviewMsg] = useState(null);

  const handleSend = async () => {
    if (state !== "idle") return;
    setState("sending");
    try {
      const res = await fetch("/api/ai/winback/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${localStorage.getItem("access_token") || ""}` },
        body: JSON.stringify({
          client_id: "00000000-0000-0000-0000-000000000000",
          client_name: LISA_BRIEF.name,
          last_service: LISA_BRIEF.lastService,
          days_since: LISA_BRIEF.daysSince,
          ltv: LISA_BRIEF.ltv,
        }),
      });
      const data = await res.json();
      const msg = data.message_draft || "We'd love to see you back, Lisa!";
      console.log("✅ AutoPilot win-back generated:", msg);
      await sendWinBackSMS(LISA_BRIEF.phone, msg);
      setPreviewMsg(msg);
      setState("sent");
    } catch (err) {
      console.error("AutoPilot win-back failed:", err);
      setState("error");
    }
  };

  const metrics = [
    { label: "Upsell prob.",    val: "High 🔥",    color: t.greenText,  bg: t.greenBg  },
    { label: "Churn risk",      val: "High 🔴",    color: t.pinkText,   bg: t.pinkBg   },
    { label: "Opportunity",     val: "$185/visit", color: t.accentText, bg: t.accentSoft },
    { label: "Win-back score",  val: "Act now",    color: t.yellowText, bg: t.yellowBg  },
  ];

  return (
    <div style={{ borderRadius: 16, background: t.card, border: `1.5px solid ${t.accent}30`, marginBottom: 12, overflow: "hidden", boxShadow: t.shadow }}>
      {/* Header */}
      <div style={{ padding: "12px 16px 10px", borderBottom: `1px solid ${t.border}`, display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 36, height: 36, borderRadius: 18, background: "#DB2777", color: "#fff", fontSize: 12, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>LP</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: t.text }}>{LISA_BRIEF.name} — {LISA_BRIEF.daysSince} days gone</div>
          <div style={{ fontSize: 11, color: t.sub }}>VIP · ${LISA_BRIEF.ltv.toLocaleString()} LTV · Last: {LISA_BRIEF.lastService}</div>
        </div>
        <div style={{ fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 20, background: t.pinkBg, color: t.pinkText }}>Churn risk</div>
      </div>

      {/* 2×2 metric tiles */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1, background: t.border }}>
        {metrics.map((m, i) => (
          <div key={i} style={{ padding: "10px 14px", background: t.bg }}>
            <div style={{ fontSize: 10, color: t.muted, marginBottom: 3, fontWeight: 600 }}>{m.label}</div>
            <div style={{ fontSize: 14, fontWeight: 800, color: m.color }}>{m.val}</div>
          </div>
        ))}
      </div>

      {/* Generated preview */}
      {previewMsg && (
        <div style={{ margin: "10px 14px 0", padding: "10px 12px", borderRadius: 10, background: t.accentSoft, border: `1px solid ${t.accent}20` }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: t.accentText, marginBottom: 4, letterSpacing: 0.8 }}>AI DRAFTED</div>
          <div style={{ fontSize: 13, color: t.text, lineHeight: 1.55 }}>{previewMsg}</div>
        </div>
      )}

      {/* CTA */}
      <div style={{ padding: "10px 14px 14px" }}>
        <button
          onClick={handleSend}
          disabled={state !== "idle"}
          style={{
            width: "100%", padding: "12px 0", borderRadius: 12, border: "none",
            background: state === "sent" ? t.greenBg : state === "sending" ? t.inputBg : state === "error" ? t.pinkBg : `linear-gradient(135deg,${t.accent},#6D28D9)`,
            color: state === "sent" ? t.greenText : state === "error" ? t.pinkText : state === "sending" ? t.muted : "#fff",
            cursor: state === "idle" ? "pointer" : "default",
            fontFamily: f, fontSize: 13, fontWeight: 700,
            transition: "all 0.2s",
          }}>
          {state === "sent"    ? "✓ Win-back sent to Lisa"
           : state === "sending" ? "Generating with AI…"
           : state === "error"   ? "Failed — tap to retry"
           : "Send AI win-back →"}
        </button>
      </div>
    </div>
  );
}


function AutoPilotScreen({ t, isSetup }) {
  const [frontDesk, setFrontDesk] = useState(null);
  const [livePulse, setLivePulse] = useState(true);
  useEffect(() => { const i = setInterval(() => { setLivePulse(false); setTimeout(() => setLivePulse(true), 150); }, 2000); return () => clearInterval(i); }, []);

  if (isSetup) return (
    <div style={{ padding: "0 20px 20px" }}>
      <div style={{ borderRadius: 20, padding: "22px 24px 20px", marginBottom: 14, background: t.accentSoft, border: `1px solid ${t.accent}20` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}><div style={{ width: 8, height: 8, borderRadius: 4, background: t.muted }} /><span style={{ fontSize: 11, fontWeight: 700, color: t.muted, letterSpacing: 1.5 }}>AUTOPILOT IS WAITING</span></div>
        <div style={{ fontSize: 28, fontWeight: 800, color: t.text, lineHeight: 1.15, letterSpacing: -0.5, marginBottom: 8 }}>Your AI team is{"\n"}ready to work</div>
        <div style={{ fontSize: 14, color: t.sub, lineHeight: 1.55 }}>Connect Stripe and get your first booking — AutoPilot activates automatically.</div>
      </div>
      {[{ icon: "🔄", title: "No-show recovery", desc: "Rebooks cancelled slots automatically" }, { icon: "📲", title: "Slot filler", desc: "Sends payment links to your waitlist" }, { icon: "💬", title: "AI Front Desk", desc: "Answers DMs, books 24/7" }, { icon: "🔁", title: "30-day reactivation", desc: "Brings back lapsed clients" }].map((ftr, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 18px", background: t.card, borderRadius: 14, border: `1px solid ${t.border}`, marginBottom: 8, boxShadow: t.shadow }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: t.accentSoft, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>{ftr.icon}</div>
          <div><div style={{ fontSize: 14, fontWeight: 600, color: t.text }}>{ftr.title}</div><div style={{ fontSize: 12, color: t.sub, marginTop: 1 }}>{ftr.desc}</div></div>
        </div>
      ))}
      <button style={{ width: "100%", padding: "16px 0", borderRadius: 14, color: "#fff", border: "none", fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: f, background: t.accent, marginTop: 8 }}>Connect Stripe to activate</button>
    </div>
  );

  const liveEvents = [
    { icon: "⚡", bg: t.accentSoft, text: "Filled 3:00 PM slot — Lisa Park", amount: "+$70", time: "2m" },
    { icon: "💬", bg: t.blueBg, text: "Replied to 4 Instagram DMs", amount: null, time: "8m" },
    { icon: "🔄", bg: t.yellowBg, text: "Win-back sent — Sarah K. (60d gone)", amount: null, time: "14m" },
  ];
  const flows = [
    { icon: "🔄", bg: "linear-gradient(135deg,#EDE9FE,#DDD6FE)", title: "No-show recovery", stat: "+$340 today · 67% conversion" },
    { icon: "📲", bg: "linear-gradient(135deg,#FCE7F3,#FBCFE8)", title: "30-day reactivation", stat: "+$140 today · 34% conversion" },
    { icon: "⚡", bg: "linear-gradient(135deg,#FEF3C7,#FDE68A)", title: "Last-minute slot filler", stat: "+$70 today · 55% conversion" },
    { icon: "💬", bg: "linear-gradient(135deg,#FFE4E6,#FECDD3)", title: "AI Front Desk", stat: "12 messages handled today", onClick: () => setFrontDesk("list") },
  ];

  if (frontDesk === "list") return (
    <div style={{ padding: "0 20px 20px" }}>
      {[
        { init: "JT", name: "Jamie T.", ch: "SMS", preview: '"Want to talk to the manager..."', time: "3m", color: "#DC2626", badge: "AI escalated", badgeBg: t.pinkBg, badgeColor: t.pinkText, needsYou: true },
        { init: "SP", name: "Sarah P.", ch: "Instagram", preview: "Booked balayage with Emma...", time: "12m", color: "#534AB7", badge: "AI booked · $185", badgeBg: t.greenBg, badgeColor: t.greenText, needsYou: false },
        { init: "MR", name: "Mike R.", ch: "SMS", preview: "Moved Saturday cut to next Wed...", time: "28m", color: "#0891B2", badge: "AI handled", badgeBg: t.greenBg, badgeColor: t.greenText, needsYou: false },
      ].map((conv, i) => (
        <div key={i} style={{ padding: "16px 18px", background: t.card, borderRadius: 16, border: `1px solid ${t.border}`, marginBottom: 8, borderLeft: conv.needsYou ? `4px solid ${t.pink}` : `1px solid ${t.border}`, boxShadow: t.shadow, cursor: "pointer" }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
            <div style={{ width: 44, height: 44, borderRadius: 22, background: conv.color, color: "#fff", fontSize: 14, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>{conv.init}</div>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}><span style={{ fontSize: 15, fontWeight: 700, color: t.text }}>{conv.name}</span><span style={{ fontSize: 12, color: t.dim }}>{conv.time}</span></div>
              <div style={{ fontSize: 13, color: t.sub, marginBottom: 8 }}>{conv.preview}</div>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 10px", borderRadius: 6, background: conv.badgeBg, color: conv.badgeColor, fontSize: 11, fontWeight: 700 }}>{conv.needsYou ? "⚠" : "✓"} {conv.badge}</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div style={{ padding: "0 20px 20px" }}>
      <div style={{ borderRadius: 20, padding: "20px 22px 18px", marginBottom: 14, background: t.accentSoft, border: `1px solid ${t.accent}15` }}>
        <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1.8, color: t.accentText, marginBottom: 8 }}>RECOVERED THIS MONTH</div>
        <div style={{ fontSize: 44, fontWeight: 800, color: t.text, letterSpacing: -2, lineHeight: 1, marginBottom: 16 }}>$<AnimCount target={8240} /></div>
        <div style={{ display: "flex" }}>
          {[{ v: "487", l: "Actions" }, { v: "312", l: "Customers" }, { v: "39%", l: "Conversion" }].map((s, i) => (
            <div key={i} style={{ flex: 1 }}><div style={{ fontSize: 18, fontWeight: 800, color: t.text }}>{s.v}</div><div style={{ fontSize: 11, color: t.sub }}>{s.l}</div></div>
          ))}
        </div>
      </div>
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.2, color: t.muted }}>LIVE — JUST NOW</span>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ position: "relative", width: 8, height: 8 }}>
              <div style={{ width: 8, height: 8, borderRadius: 4, background: "#EF4444", position: "relative", zIndex: 2 }} />
              {livePulse && <div style={{ position: "absolute", top: 0, left: 0, width: 8, height: 8, borderRadius: 4, background: "#EF4444", animation: "pulseRing 1.5s ease-out" }} />}
            </div>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#EF4444" }}>LIVE</span>
          </div>
        </div>
        {liveEvents.map((ev, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 16px", background: t.card, borderRadius: 14, border: `1px solid ${t.border}`, marginBottom: 6, boxShadow: t.shadow }}>
            <div style={{ width: 32, height: 32, borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, background: ev.bg, flexShrink: 0 }}>{ev.icon}</div>
            <div style={{ flex: 1 }}><span style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{ev.text}{ev.amount && <span style={{ color: t.greenText, fontWeight: 700 }}> {ev.amount}</span>}</span></div>
            <span style={{ fontSize: 12, color: t.dim }}>{ev.time}</span>
          </div>
        ))}
      </div>
      <AutoPilotWinBack t={t} />
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.2, color: t.muted, marginBottom: 12 }}>ACTIVE FLOWS</div>
      {flows.map((flow, i) => (
        <div key={i} onClick={flow.onClick} style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px 16px", background: t.card, borderRadius: 16, border: `1px solid ${t.border}`, marginBottom: 8, boxShadow: t.shadow, cursor: flow.onClick ? "pointer" : "default" }}>
          <div style={{ width: 42, height: 42, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, background: flow.bg, flexShrink: 0 }}>{flow.icon}</div>
          <div style={{ flex: 1 }}><div style={{ fontSize: 15, fontWeight: 700, color: t.text, marginBottom: 2 }}>{flow.title}</div><div style={{ fontSize: 12, color: t.sub }}>{flow.stat}</div></div>
          <div style={{ padding: "5px 12px", borderRadius: 8, background: t.greenBg, color: t.greenText, fontSize: 11, fontWeight: 700 }}>Running</div>
        </div>
      ))}
    </div>
  );
}

// ─── OPERATIONS ────────────────────────────────────────────────────
function OperationsScreen({ t }) {
  const [activeModule, setActiveModule] = useState("overview");
  const [expandedInsight, setExpandedInsight] = useState(null);

  // ── Score sub-metrics ──
  const scoreMetrics = [
    { label: "Utilization",  pct: 84, color: t.green  },
    { label: "Retention",    pct: 72, color: t.yellow  },
    { label: "Efficiency",   pct: 88, color: t.green  },
    { label: "AI Capture",   pct: 61, color: t.orange  },
  ];

  // ── Top KPIs ──
  const kpis = [
    { label: "Utilization",    val: "84%",   sub: "+6% vs last mo",  valColor: t.greenText,  bg: t.greenBg,   border: t.green  },
    { label: "Revenue Growth", val: "+12%",  sub: "vs last month",   valColor: t.accentText, bg: t.accentSoft,border: t.accent },
    { label: "Rebooking Rate", val: "71%",   sub: "↓ from 78%",      valColor: t.yellowText, bg: t.yellowBg,  border: t.yellow },
    { label: "Avg Ticket",     val: "$119",  sub: "+$8 this week",   valColor: t.greenText,  bg: t.greenBg,   border: t.green  },
  ];

  // ── AI Insights — revenue-focused, AI-native ──
  const insights = [
    {
      id: "sats",
      category: "Missed Revenue",
      icon: "📅",
      iconBg: t.pinkBg,
      iconColor: t.pinkText,
      title: "Saturday afternoons underbooked by 34%",
      body: "5 open slots every Saturday 2–5 PM. At $75 avg ticket, that's ~$375 left on the table weekly.",
      impact: "+$1,500/mo",
      impactColor: t.greenText,
      impactBg: t.greenBg,
      action: "Fill with AutoPilot",
    },
    {
      id: "rebook",
      category: "Client Retention",
      icon: "🔁",
      iconBg: t.yellowBg,
      iconColor: t.yellowText,
      title: "12 clients overdue for rebooking",
      body: "Average LTV $320. If 8 rebook this month, that's $2,560 in recovered revenue. Win-back ready to send.",
      impact: "12 clients",
      impactColor: t.yellowText,
      impactBg: t.yellowBg,
      action: "Send win-backs",
    },
    {
      id: "marcus",
      category: "Team Performance",
      icon: "⭐",
      iconBg: t.accentSoft,
      iconColor: t.accentText,
      title: "Marcus generates 28% more upsells than team average",
      body: "His avg ticket is $138 vs team's $108. Scheduling him for premium slots on Fri–Sat could add $480/month.",
      impact: "+$480/mo",
      impactColor: t.greenText,
      impactBg: t.greenBg,
      action: "Optimize schedule",
    },
    {
      id: "combo",
      category: "Revenue Leakage",
      icon: "💡",
      iconBg: t.blueBg,
      iconColor: t.blueText,
      title: "Cut + Beard combo increases ticket size by 19%",
      body: "Clients who add a beard trim spend $19 more on avg. 23 solo-cut bookings this week could have been upsold.",
      impact: "+$437 missed",
      impactColor: t.pinkText,
      impactBg: t.pinkBg,
      action: "Enable upsell prompt",
    },
    {
      id: "cancel",
      category: "Operational Efficiency",
      icon: "⚡",
      iconBg: t.greenBg,
      iconColor: t.greenText,
      title: "3 cancelled bookings could be recovered today",
      body: "Cancellations at 10 AM, 2 PM, and 4 PM. Waitlist has 5 clients. AutoPilot can fill all 3 in the next 30 min.",
      impact: "+$225 today",
      impactColor: t.greenText,
      impactBg: t.greenBg,
      action: "Recover now",
    },
  ];

  // ── Service performance ──
  const services = [
    { name: "Signature Cut", bookings: 86, rev: "$3,870", util: 94, trend: "up"   },
    { name: "Cut + Beard",   bookings: 34, rev: "$2,210", util: 72, trend: "up"   },
    { name: "Balayage",      bookings: 22, rev: "$4,070", util: 58, trend: "flat" },
    { name: "Hot Towel Shave",bookings:14, rev: "$770",   util: 38, trend: "down" },
  ];

  // ── Payout data ──
  const payouts = [
    { label: "Today's payout",  amount: "$842",   sub: "Arriving tomorrow",  color: t.greenText,  bg: t.greenBg,   border: t.green  },
    { label: "Pending balance", amount: "$1,420", sub: "Processing 1–2 days", color: t.yellowText, bg: t.yellowBg,  border: t.yellow },
    { label: "Last payout",     amount: "$3,240", sub: "Deposited May 12",    color: t.accentText, bg: t.accentSoft,border: t.accent },
  ];

  const payoutHistory = [
    { date: "May 12", amount: "$3,240", status: "Deposited",  statusColor: t.greenText  },
    { date: "May 5",  amount: "$2,980", status: "Deposited",  statusColor: t.greenText  },
    { date: "Apr 28", amount: "$3,510", status: "Deposited",  statusColor: t.greenText  },
    { date: "Apr 21", amount: "$1,240", status: "Failed",     statusColor: t.pinkText   },
    { date: "Apr 14", amount: "$3,090", status: "Deposited",  statusColor: t.greenText  },
  ];

  // ── Module nav ──
  const modules = [
    { id: "overview",  icon: "⚡", label: "Overview"  },
    { id: "revenue",   icon: "💰", label: "Revenue"   },
    { id: "team",      icon: "👥", label: "Team"      },
    { id: "clients",   icon: "🔁", label: "Clients"   },
    { id: "insights",  icon: "✦",  label: "AI"        },
    { id: "finance",   icon: "🏦", label: "Finance"   },
  ];

  const CategoryTag = ({ label, color, bg }) => (
    <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 20, background: bg, color, letterSpacing: 0.3, flexShrink: 0 }}>
      {label.toUpperCase()}
    </span>
  );

  const SectionLabel = ({ children, style }) => (
    <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color: t.muted, marginBottom: 12, marginTop: 4, ...style }}>
      {children}
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>

      {/* ── Module nav strip ── */}
      <div style={{ display: "flex", gap: 0, borderBottom: `1px solid ${t.border}`, background: t.bg, flexShrink: 0, overflowX: "auto" }}>
        {modules.map(m => {
          const active = activeModule === m.id;
          return (
            <button key={m.id} onClick={() => setActiveModule(m.id)} style={{
              display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
              padding: "10px 0 9px", flex: 1, minWidth: 52,
              background: "none", border: "none", cursor: "pointer", fontFamily: f,
              borderBottom: active ? `2.5px solid ${t.accent}` : "2.5px solid transparent",
              transition: "all 0.15s",
            }}>
              <span style={{ fontSize: 15 }}>{m.icon}</span>
              <span style={{ fontSize: 9, fontWeight: active ? 700 : 500, color: active ? t.accentText : t.muted, whiteSpace: "nowrap" }}>
                {m.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Scrollable content ── */}
      <div style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch", padding: "16px 16px 28px" }}>

        {/* ═══ OVERVIEW ═══ */}
        {activeModule === "overview" && (
          <>
            {/* Score ring + sub-metrics */}
            <div style={{ borderRadius: 18, background: t.card, border: `1px solid ${t.border}`, padding: "18px 18px 16px", marginBottom: 14, boxShadow: t.shadow }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ flex: 1, paddingRight: 8 }}>
                  <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1.5, color: t.muted, marginBottom: 3 }}>OPERATIONS SCORE</div>
                  <div style={{ fontSize: 13, color: t.sub, marginBottom: 10 }}>Strong. Two areas to improve.</div>
                  <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 8, background: t.greenBg, marginBottom: 14 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: t.greenText }}>↑ +4 pts this month</span>
                  </div>
                  {scoreMetrics.map((m, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 7 }}>
                      <div style={{ width: 68, fontSize: 11, color: t.muted, flexShrink: 0 }}>{m.label}</div>
                      <div style={{ flex: 1, height: 5, borderRadius: 3, background: t.inputBg, overflow: "hidden" }}>
                        <div style={{ width: `${m.pct}%`, height: "100%", borderRadius: 3, background: m.color, transition: "width 1s ease" }} />
                      </div>
                      <div style={{ width: 28, fontSize: 11, fontWeight: 700, color: t.text, textAlign: "right", flexShrink: 0 }}>{m.pct}%</div>
                    </div>
                  ))}
                </div>
                <CircularScore score={86} t={t} />
              </div>
            </div>

            {/* KPI 2×2 */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
              {kpis.map((kpi, i) => (
                <div key={i} style={{ padding: "13px 14px", borderRadius: 14, background: kpi.bg, borderLeft: `4px solid ${kpi.border}` }}>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, color: t.sub, marginBottom: 5 }}>{kpi.label.toUpperCase()}</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: kpi.valColor, letterSpacing: -0.5, marginBottom: 2 }}>{kpi.val}</div>
                  <div style={{ fontSize: 11, color: t.muted }}>{kpi.sub}</div>
                </div>
              ))}
            </div>

            {/* Top 2 AI insights preview */}
            <SectionLabel>TOP AI OPPORTUNITIES</SectionLabel>
            {insights.slice(0, 2).map((ins) => (
              <div key={ins.id} style={{ padding: "14px 14px", borderRadius: 14, background: t.card, border: `1px solid ${t.border}`, marginBottom: 8, boxShadow: t.shadow }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 11 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: ins.iconBg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>{ins.icon}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4, flexWrap: "wrap" }}>
                      <CategoryTag label={ins.category} color={ins.iconColor} bg={ins.iconBg} />
                      <span style={{ fontSize: 11, fontWeight: 700, color: ins.impactColor, background: ins.impactBg, padding: "2px 7px", borderRadius: 20 }}>{ins.impact}</span>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 3, lineHeight: 1.3 }}>{ins.title}</div>
                    <button onClick={() => setActiveModule("insights")} style={{ fontSize: 12, fontWeight: 700, color: ins.iconColor, background: "none", border: "none", cursor: "pointer", fontFamily: f, padding: 0 }}>
                      {ins.action} →
                    </button>
                  </div>
                </div>
              </div>
            ))}
            <button onClick={() => setActiveModule("insights")} style={{ width: "100%", padding: "13px 0", borderRadius: 12, background: t.accentSoft, border: `1px solid ${t.accent}20`, fontSize: 13, fontWeight: 700, color: t.accentText, cursor: "pointer", fontFamily: f }}>
              View all {insights.length} AI insights →
            </button>
          </>
        )}

        {/* ═══ REVENUE ═══ */}
        {activeModule === "revenue" && (
          <>
            <SectionLabel>REVENUE PERFORMANCE</SectionLabel>

            {/* Revenue trend sparkline */}
            <div style={{ borderRadius: 16, background: t.card, border: `1px solid ${t.border}`, padding: "16px 16px 14px", marginBottom: 14, boxShadow: t.shadow }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.2, color: t.muted, marginBottom: 4 }}>THIS MONTH</div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: t.text, letterSpacing: -1 }}>$12,458</div>
                  <div style={{ fontSize: 13, color: t.greenText, fontWeight: 600, marginTop: 2 }}>↑ +8.2% vs last month</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 11, color: t.muted, marginBottom: 4 }}>AUTOPILOT</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: t.accentText }}>+$2,840</div>
                  <div style={{ fontSize: 11, color: t.accentText, fontWeight: 600 }}>22.8% of total</div>
                </div>
              </div>
              {/* Simple bar chart */}
              <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 56, marginBottom: 4 }}>
                {[42, 55, 48, 62, 58, 71, 65, 78, 74, 82, 68, 90, 85, 100].map((v, i) => (
                  <div key={i} style={{ flex: 1, borderRadius: "3px 3px 0 0", height: `${v}%`, background: i === 13 ? t.accent : `${t.accent}35`, transition: "height 0.5s ease" }} />
                ))}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: t.dim }}>
                <span>May 1</span><span>Today</span>
              </div>
            </div>

            <SectionLabel>SERVICE PERFORMANCE</SectionLabel>
            {services.map((svc, i) => (
              <div key={i} style={{ padding: "13px 14px", borderRadius: 14, background: t.card, border: `1px solid ${t.border}`, marginBottom: 8, boxShadow: t.shadow }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: t.text, marginBottom: 2 }}>{svc.name}</div>
                    <div style={{ fontSize: 12, color: t.sub }}>{svc.bookings} bookings · {svc.rev} revenue</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: svc.util >= 70 ? t.greenText : svc.util >= 50 ? t.yellowText : t.pinkText }}>{svc.util}%</div>
                    <div style={{ fontSize: 10, color: t.muted }}>utilization</div>
                  </div>
                </div>
                <div style={{ height: 4, borderRadius: 2, background: t.inputBg, overflow: "hidden" }}>
                  <div style={{ width: `${svc.util}%`, height: "100%", borderRadius: 2, background: svc.util >= 70 ? t.green : svc.util >= 50 ? t.yellow : t.pink, transition: "width 0.8s ease" }} />
                </div>
              </div>
            ))}

            <SectionLabel>MISSED REVENUE</SectionLabel>
            {[
              { label: "Unfilled slots this week", val: "$840", color: t.pinkText, bg: t.pinkBg },
              { label: "Missed upsells (est.)", val: "$437", color: t.pinkText, bg: t.pinkBg },
              { label: "Recoverable today",  val: "$225", color: t.yellowText, bg: t.yellowBg },
            ].map((item, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "13px 16px", borderRadius: 12, background: t.card, border: `1px solid ${t.border}`, marginBottom: 8 }}>
                <span style={{ fontSize: 13, color: t.sub }}>{item.label}</span>
                <span style={{ fontSize: 14, fontWeight: 800, color: item.color, background: item.bg, padding: "3px 10px", borderRadius: 20 }}>{item.val}</span>
              </div>
            ))}
          </>
        )}

        {/* ═══ TEAM ═══ */}
        {activeModule === "team" && (
          <>
            <SectionLabel>TEAM EFFICIENCY</SectionLabel>

            {/* Team comparison bars */}
            {[
              { name: "Marcus", initials: "MJ", color: "#16A34A", rev: "$4,230", util: 91, upsell: 38, tickets: 138 },
              { name: "Emma",   initials: "ED", color: "#534AB7", rev: "$3,870", util: 88, upsell: 24, tickets: 125 },
              { name: "John",   initials: "JT", color: "#0891B2", rev: "$2,960", util: 74, upsell: 18, tickets: 108 },
              { name: "Lisa",   initials: "LK", color: "#DB2777", rev: "$3,310", util: 82, upsell: 21, tickets: 119 },
            ].map((staff, i) => (
              <div key={i} style={{ padding: "14px 14px", borderRadius: 14, background: t.card, border: `1px solid ${t.border}`, marginBottom: 8, boxShadow: t.shadow }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                  <div style={{ width: 38, height: 38, borderRadius: 19, background: staff.color, color: "#fff", fontSize: 12, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{staff.initials}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: t.text }}>{staff.name}</div>
                    <div style={{ fontSize: 12, color: t.sub }}>{staff.rev} · avg ticket ${staff.tickets}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: staff.util >= 80 ? t.greenText : t.yellowText }}>{staff.util}%</div>
                    <div style={{ fontSize: 10, color: t.muted }}>utilized</div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  {[["Utilization", staff.util, t.green], ["Upsell rate", staff.upsell, t.accent]].map(([label, val, color], j) => (
                    <div key={j} style={{ flex: 1 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                        <span style={{ fontSize: 10, color: t.muted }}>{label}</span>
                        <span style={{ fontSize: 10, fontWeight: 700, color: t.text }}>{val}%</span>
                      </div>
                      <div style={{ height: 4, borderRadius: 2, background: t.inputBg, overflow: "hidden" }}>
                        <div style={{ width: `${val}%`, height: "100%", borderRadius: 2, background: color }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            <SectionLabel>BOOKING CONVERSION</SectionLabel>
            {[
              { label: "Booking link clicks", val: "284", sub: "this week" },
              { label: "Completed bookings",  val: "89",  sub: "31.3% conversion" },
              { label: "Drop-off at payment",  val: "23",  sub: "opportunity to reduce" },
            ].map((row, i, arr) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", borderRadius: i === 0 ? "12px 12px 0 0" : i === arr.length-1 ? "0 0 12px 12px" : 0, background: t.card, borderLeft: `1px solid ${t.border}`, borderRight: `1px solid ${t.border}`, borderTop: `1px solid ${t.border}`, borderBottom: i === arr.length-1 ? `1px solid ${t.border}` : "none" }}>
                <span style={{ fontSize: 13, color: t.sub }}>{row.label}</span>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: t.text }}>{row.val}</div>
                  <div style={{ fontSize: 11, color: t.muted }}>{row.sub}</div>
                </div>
              </div>
            ))}
          </>
        )}

        {/* ═══ CLIENTS ═══ */}
        {activeModule === "clients" && (
          <>
            <SectionLabel>CLIENT RETENTION</SectionLabel>

            {/* Retention ring */}
            <div style={{ borderRadius: 16, background: t.card, border: `1px solid ${t.border}`, padding: "18px 16px", marginBottom: 14, boxShadow: t.shadow }}>
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <CircularScore score={71} t={t} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.2, color: t.muted, marginBottom: 4 }}>REBOOKING RATE</div>
                  <div style={{ fontSize: 24, fontWeight: 800, color: t.text, marginBottom: 4 }}>71%</div>
                  <div style={{ fontSize: 12, color: t.yellowText, fontWeight: 600, marginBottom: 8 }}>↓ from 78% last month</div>
                  <div style={{ fontSize: 12, color: t.sub, lineHeight: 1.5 }}>Target is 80%+. Main drop is in Signature Cut clients rebooking within 5 weeks.</div>
                </div>
              </div>
            </div>

            {[
              { label: "Churn risk",          val: "8 clients", sub: "No visit in 45+ days", color: t.pinkText,   bg: t.pinkBg,   border: t.pink   },
              { label: "Overdue for rebook",  val: "12 clients",sub: "Past their usual interval",color: t.yellowText,bg: t.yellowBg, border: t.yellow },
              { label: "Loyal (5+ visits)",   val: "94 clients",sub: "High retention segment", color: t.greenText, bg: t.greenBg,  border: t.green  },
              { label: "VIP (LTV $500+)",     val: "23 clients",sub: "Top revenue segment",    color: t.accentText,bg: t.accentSoft,border:t.accent  },
            ].map((item, i) => (
              <div key={i} style={{ padding: "13px 16px", borderRadius: 14, background: item.bg, borderLeft: `4px solid ${item.border}`, marginBottom: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 2 }}>{item.label}</div>
                    <div style={{ fontSize: 11, color: t.sub }}>{item.sub}</div>
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: item.color }}>{item.val}</div>
                </div>
              </div>
            ))}

            <SectionLabel>REPEAT VISIT TRENDS</SectionLabel>
            {[
              { label: "Avg visits per client / yr", val: "6.2" },
              { label: "Avg days between visits",    val: "31 days" },
              { label: "First-visit → rebook rate",  val: "58%" },
              { label: "3-visit → loyal rate",       val: "84%" },
            ].map((row, i, arr) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "12px 16px", borderRadius: i===0?"12px 12px 0 0":i===arr.length-1?"0 0 12px 12px":0, background: t.card, border: `1px solid ${t.border}`, borderTop: i===0?`1px solid ${t.border}`:"none" }}>
                <span style={{ fontSize: 13, color: t.sub }}>{row.label}</span>
                <span style={{ fontSize: 13, fontWeight: 800, color: t.text }}>{row.val}</span>
              </div>
            ))}
          </>
        )}

        {/* ═══ AI INSIGHTS ═══ */}
        {activeModule === "insights" && (
          <>
            <div style={{ padding: "12px 14px", borderRadius: 14, background: t.accentSoft, border: `1px solid ${t.accent}20`, marginBottom: 16, display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 16 }}>✦</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: t.accentText, marginBottom: 2 }}>5 AI insights ready</div>
                <div style={{ fontSize: 12, color: t.accentText, opacity: 0.8 }}>Estimated revenue impact: +$3,100/mo if actioned</div>
              </div>
            </div>

            {insights.map((ins) => {
              const expanded = expandedInsight === ins.id;
              return (
                <div key={ins.id} style={{ borderRadius: 16, background: t.card, border: `1px solid ${t.border}`, marginBottom: 10, boxShadow: t.shadow, overflow: "hidden" }}>
                  <div onClick={() => setExpandedInsight(expanded ? null : ins.id)} style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "14px 14px", cursor: "pointer" }}>
                    <div style={{ width: 38, height: 38, borderRadius: 11, background: ins.iconBg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, flexShrink: 0 }}>{ins.icon}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5, flexWrap: "wrap" }}>
                        <CategoryTag label={ins.category} color={ins.iconColor} bg={ins.iconBg} />
                        <span style={{ fontSize: 11, fontWeight: 700, color: ins.impactColor, background: ins.impactBg, padding: "2px 7px", borderRadius: 20 }}>{ins.impact}</span>
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: t.text, lineHeight: 1.35 }}>{ins.title}</div>
                    </div>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={t.dim} strokeWidth="2.5" strokeLinecap="round" style={{ flexShrink: 0, marginTop: 2, transform: expanded ? "rotate(90deg)" : "none", transition: "transform 0.2s" }}>
                      <path d="M9 18l6-6-6-6"/>
                    </svg>
                  </div>
                  {expanded && (
                    <div style={{ padding: "0 14px 14px", borderTop: `1px solid ${t.border}`, paddingTop: 12 }}>
                      <div style={{ fontSize: 13, color: t.sub, lineHeight: 1.65, marginBottom: 12 }}>{ins.body}</div>
                      <button style={{ padding: "9px 18px", borderRadius: 10, background: ins.iconBg, border: "none", cursor: "pointer", fontFamily: f, fontSize: 13, fontWeight: 700, color: ins.iconColor }}>
                        {ins.action} →
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </>
        )}

        {/* ═══ FINANCE ═══ */}
        {activeModule === "finance" && (
          <>
            <SectionLabel>PAYOUTS</SectionLabel>

            {/* Payout cards */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 18 }}>
              {payouts.map((p, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 16px", borderRadius: 14, background: p.bg, borderLeft: `4px solid ${p.border}` }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: t.sub, marginBottom: 2 }}>{p.label.toUpperCase()}</div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: p.color, letterSpacing: -0.5 }}>{p.amount}</div>
                    <div style={{ fontSize: 12, color: t.muted, marginTop: 2 }}>{p.sub}</div>
                  </div>
                  <div style={{ width: 40, height: 40, borderRadius: 12, background: "rgba(255,255,255,0.5)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>
                    {i === 0 ? "🚀" : i === 1 ? "⏳" : "✅"}
                  </div>
                </div>
              ))}
            </div>

            {/* Bank connected notice */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderRadius: 12, background: t.greenBg, border: `1px solid ${t.green}20`, marginBottom: 18 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={t.greenText} strokeWidth="2" strokeLinecap="round">
                <rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/>
              </svg>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: t.greenText }}>TD Bank ···· 4821 connected</div>
                <div style={{ fontSize: 11, color: t.greenText, opacity: 0.8 }}>2-day transfer · Secured by Stripe</div>
              </div>
            </div>

            <SectionLabel>PAYOUT HISTORY</SectionLabel>
            <div style={{ borderRadius: 14, background: t.card, border: `1px solid ${t.border}`, overflow: "hidden", boxShadow: t.shadow }}>
              {payoutHistory.map((row, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "13px 16px", borderBottom: i < payoutHistory.length-1 ? `1px solid ${t.border}` : "none" }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: t.text }}>{row.amount}</div>
                    <div style={{ fontSize: 11, color: t.muted, marginTop: 1 }}>{row.date}</div>
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 700, color: row.statusColor, padding: "3px 10px", borderRadius: 20, background: row.statusColor === t.greenText ? t.greenBg : t.pinkBg }}>
                    {row.status}
                  </span>
                </div>
              ))}
            </div>

            <SectionLabel style={{ marginTop: 16 }}>REPORTS</SectionLabel>
            {[
              { icon: "📊", label: "Monthly revenue report", sub: "May 2026 · PDF" },
              { icon: "📋", label: "Staff payout breakdown",  sub: "Commission details" },
              { icon: "🧾", label: "Tax summary",             sub: "YTD · for accountant" },
            ].map((rep, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 14px", borderRadius: 13, background: t.card, border: `1px solid ${t.border}`, marginBottom: 8, cursor: "pointer" }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: t.accentSoft, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, flexShrink: 0 }}>{rep.icon}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: t.text }}>{rep.label}</div>
                  <div style={{ fontSize: 11, color: t.muted, marginTop: 1 }}>{rep.sub}</div>
                </div>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={t.dim} strokeWidth="2.5" strokeLinecap="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

// ─── LOCK SCREEN + DAILY BRIEF ─────────────────────────────────────
function LockScreen({ onTap }) {
  const glass = {
    padding: "14px 16px", borderRadius: 20,
    background: "rgba(255,255,255,0.14)",
    border: "1px solid rgba(255,255,255,0.12)",
    marginBottom: 10,
  };
  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 100, borderRadius: 44, overflow: "hidden", cursor: "pointer" }} onClick={onTap}>
      <div style={{ width: "100%", height: "100%", background: "linear-gradient(165deg,#1A0D4E 0%,#3B2090 35%,#6040C0 65%,#7B5FDF 100%)", display: "flex", flexDirection: "column", padding: "0 18px" }}>
        {/* Status bar */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 6px 0" }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: "#fff" }}>7:00 AM</span>
          <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
            <svg width="16" height="11" viewBox="0 0 16 11" fill="none"><path d="M8 9.5a1 1 0 100 2 1 1 0 000-2z" fill="rgba(255,255,255,0.8)"/><path d="M5.2 7.3a4 4 0 015.6 0" stroke="rgba(255,255,255,0.8)" strokeWidth="1.4" strokeLinecap="round"/><path d="M2.5 4.6a7.5 7.5 0 0111 0" stroke="rgba(255,255,255,0.8)" strokeWidth="1.4" strokeLinecap="round"/></svg>
            <svg width="26" height="13" viewBox="0 0 26 13" fill="none"><rect x="0.5" y="0.5" width="21" height="12" rx="3.5" stroke="rgba(255,255,255,0.35)"/><rect x="2" y="2" width="16" height="9" rx="2" fill="rgba(255,255,255,0.85)"/><path d="M22.5 4.5v4a2 2 0 000-4z" fill="rgba(255,255,255,0.35)"/></svg>
          </div>
        </div>
        {/* Clock */}
        <div style={{ textAlign: "center", paddingTop: 42, marginBottom: 28 }}>
          <div style={{ fontSize: 14, fontWeight: 500, color: "rgba(255,255,255,0.65)", marginBottom: 3 }}>Wednesday, May 7</div>
          <div style={{ fontSize: 76, fontWeight: 300, color: "#fff", letterSpacing: -3, lineHeight: 1 }}>7:01</div>
        </div>
        {/* FlatPurse notification — the strategic surface */}
        <div style={{ ...glass }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <div style={{ width: 24, height: 24, borderRadius: 7, background: "#534AB7", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
            </div>
            <span style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.85)", letterSpacing: 0.8, flex: 1 }}>FLATPURSE FLOW</span>
            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>now</span>
          </div>
          {/* Greeting */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <span style={{ fontSize: 16 }}>☀️</span>
            <span style={{ fontSize: 16, fontWeight: 700, color: "#fff" }}>Good morning, George</span>
          </div>
          {/* Three bullet rows */}
          {[
            { path: "M22 12h-4l-3 9L9 3l-3 9H2", text: "+$340 recovered by AutoPilot yesterday" },
            { path: "M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z", text: "Today is 78% booked (14/18)" },
            { path: "M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9", text: "2 items need your attention" },
          ].map((row, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: i < 2 ? 8 : 14 }}>
              <div style={{ width: 26, height: 26, borderRadius: "50%", background: "rgba(83,74,183,0.6)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round"><path d={row.path}/></svg>
              </div>
              <span style={{ fontSize: 13, color: "rgba(255,255,255,0.85)" }}>{row.text}</span>
            </div>
          ))}
          {/* Divider */}
          <div style={{ height: 1, background: "rgba(255,255,255,0.12)", marginBottom: 12 }} />
          {/* CTA button */}
          <div style={{ width: "100%", padding: "13px 0", borderRadius: 14, background: "#4338CA", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: "#fff" }}>Open Daily Brief</span>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
          </div>
        </div>
        {/* Context notification — Maxwell's message for realism */}
        <div style={{ ...glass, opacity: 0.55 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
            <div style={{ width: 22, height: 22, borderRadius: 6, background: "rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12 }}>💬</div>
            <span style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.8)", flex: 1 }}>Messages</span>
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>7m</span>
          </div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.65)" }}>Maxwell: Don't forget Zara's pick-up at 3 🙏</div>
        </div>
        <div style={{ flex: 1 }} />
        {/* Bottom lock affordance */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: 28, paddingTop: 8 }}>
          <div style={{ width: 44, height: 44, borderRadius: "50%", background: "rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="1.8" strokeLinecap="round"><path d="M9 18l-2 3H4a2 2 0 01-2-2v-1a2 2 0 012-2h.5M9 18l3-9 3 9M15 18l2 3h3a2 2 0 002-2v-1a2 2 0 00-2-2h-.5"/></svg>
          </div>
          <span style={{ fontSize: 13, color: "rgba(255,255,255,0.4)" }}>Swipe up to open</span>
          <div style={{ width: 44, height: 44, borderRadius: "50%", background: "rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="1.8" strokeLinecap="round"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>
          </div>
        </div>
        <div style={{ width: 120, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.45)", margin: "0 auto 10px" }} />
      </div>
    </div>
  );
}

function DailyBrief({ t, onClose, onOpenDashboard }) {
  const [winBackSent, setWinBackSent] = useState(false); // false | "sending" | true
  const [marcusViewed, setMarcusViewed] = useState(false);
  const metricCard = (label, value, delta, deltaColor, bg, borderColor) => (
    <div style={{ flex: 1, padding: "14px 16px", borderRadius: 14, background: bg, borderLeft: `4px solid ${borderColor}` }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.2, color: deltaColor, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: t.text, letterSpacing: -0.5, marginBottom: 3 }}>{value}</div>
      <div style={{ fontSize: 11, color: deltaColor, fontWeight: 600 }}>{delta}</div>
    </div>
  );
  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 100, borderRadius: 44, overflow: "hidden", background: t.bg, display: "flex", flexDirection: "column" }}>
      {/* Status */}
      <div style={{ display: "flex", justifyContent: "space-between", padding: "14px 28px 0", flexShrink: 0 }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: t.statusBar }}>7:01 AM</span>
      </div>
      {/* Nav */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 24px 8px", flexShrink: 0 }}>
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", width: 28 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={t.text} strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
        <span style={{ fontSize: 16, fontWeight: 700, color: t.text }}>Daily brief</span>
        <div style={{ width: 28 }} />
      </div>

      <div style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch", padding: "0 20px 24px" }}>
        {/* Greeting + AI summary — evaluative voice, not data dump */}
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color: t.muted, marginBottom: 6 }}>WEDNESDAY, MAY 7</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: t.text, letterSpacing: -0.5, marginBottom: 12 }}>Good morning, George</div>
          <div style={{ padding: "16px 18px", borderRadius: 14, background: t.accentSoft, border: `1px solid ${t.accent}15` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill={t.accent}><path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/></svg>
              <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1.5, color: t.accentText }}>AI SUMMARY</span>
            </div>
            <div style={{ fontSize: 14, color: t.text, lineHeight: 1.65 }}>
              Solid day yesterday — $2,140, with $340 recovered by AutoPilot. Today: 14 of 18 booked, two VIPs in.
            </div>
          </div>
        </div>

        {/* YESTERDAY — 2×2 metric grid */}
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color: t.muted, marginBottom: 10 }}>YESTERDAY</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 20 }}>
          {metricCard("REVENUE", "$2,140", "+12% vs Mon", t.greenText, t.greenBg, t.green)}
          {metricCard("AUTOPILOT", "+$340", "3 slots filled", t.accentText, t.accentSoft, t.accent)}
          {metricCard("SERVICES", "18", "of 20 completed", t.sub, t.card, t.border)}
          {metricCard("AVG TICKET", "$119", "+$8 vs last wk", t.greenText, t.greenBg, t.green)}
        </div>

        {/* TODAY */}
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color: t.muted, marginBottom: 10 }}>TODAY</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 20 }}>
          {metricCard("BOOKED", "14 of 18", "4 slots open", t.accentText, t.accentSoft, t.accent)}
          {metricCard("NEXT UP", "Sarah J.", "10:00 AM · Emma", t.sub, t.card, t.border)}
          {metricCard("VIPS TODAY", "2", "Sarah, Lisa", t.yellowText, t.yellowBg, t.yellow)}
          {metricCard("OPEN SLOTS", "$280", "potential missed", t.pinkText, t.pinkBg, t.pink)}
        </div>

        {/* SMS stats */}
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color: t.muted, marginBottom: 10 }}>SMS YESTERDAY</div>
        <div style={{ padding: "14px 16px", borderRadius: 14, background: t.card, border: `1px solid ${t.border}`, marginBottom: 20, boxShadow: t.shadow }}>
          <div style={{ display: "flex" }}>
            {[{ v: "24", l: "Reminders sent" }, { v: "21", l: "Delivered" }, { v: "3", l: "Failed" }].map((s, i) => (
              <div key={i} style={{ display: "contents" }}>
                {i > 0 && <div style={{ width: 1, background: t.border, margin: "0 4px" }} />}
                <div style={{ flex: 1, textAlign: "center" }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: i === 2 ? t.pinkText : t.text }}>{s.v}</div>
                  <div style={{ fontSize: 10, color: t.muted, marginTop: 2, lineHeight: 1.4 }}>{s.l}</div>
                </div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 11, color: t.sub, marginTop: 10, paddingTop: 10, borderTop: `1px solid ${t.border}` }}>87.5% delivery rate · 3 failed due to carrier filter</div>
        </div>

        {/* NEEDS YOU — interactive action cards, not static info */}
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color: t.muted, marginBottom: 10 }}>NEEDS YOU</div>

        {/* Marcus card — tappable to open staff */}
        <div style={{ padding: "14px 16px", borderRadius: 14, background: t.card, border: `1px solid ${t.border}`, marginBottom: 10, boxShadow: t.shadow }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 20, background: "#16A34A", color: "#fff", fontSize: 13, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>MJ</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: t.text, marginBottom: 3 }}>Marcus's rebook rate dropped</div>
              <div style={{ fontSize: 13, color: t.sub, marginBottom: 10, lineHeight: 1.5 }}>52% this week vs 78% avg. Three regulars haven't come back.</div>
              <button
                onClick={() => setMarcusViewed(true)}
                style={{ padding: "8px 16px", borderRadius: 10, background: marcusViewed ? t.greenBg : t.accentSoft, border: "none", fontSize: 12, fontWeight: 700, color: marcusViewed ? t.greenText : t.accentText, cursor: "pointer", fontFamily: f }}>
                {marcusViewed ? "✓ Viewed" : "View staff page →"}
              </button>
            </div>
          </div>
        </div>

        {/* Lisa win-back — one tap fires the message */}
        <div style={{ padding: "14px 16px", borderRadius: 14, background: t.card, border: `1px solid ${t.border}`, marginBottom: 20, boxShadow: t.shadow }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.2, color: t.accentText, marginBottom: 6 }}>WIN-BACK READY</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: t.text, marginBottom: 3 }}>Lisa hasn't been back in 67 days</div>
          <div style={{ fontSize: 13, color: t.sub, marginBottom: 10 }}>VIP · $4.2k LTV · AutoPilot drafted a message</div>
          <div style={{ display: "flex", gap: 8 }}>
            {winBackSent === true
              ? <div style={{ padding: "8px 16px", borderRadius: 10, background: t.greenBg, color: t.greenText, fontSize: 13, fontWeight: 700 }}>✓ Win-back sent to Lisa</div>
              : <>
                  <button
                    onClick={async () => {
                      if (winBackSent) return;
                      setWinBackSent("sending");
                      try {
                        const res = await fetch("/api/ai/winback/generate", {
                          method: "POST",
                          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${localStorage.getItem("access_token") || ""}` },
                          body: JSON.stringify({
                            client_id: "00000000-0000-0000-0000-000000000000",
                            client_name: LISA_BRIEF.name,
                            last_service: LISA_BRIEF.lastService,
                            days_since: LISA_BRIEF.daysSince,
                            ltv: LISA_BRIEF.ltv,
                          }),
                        });
                        const data = await res.json();
                        const msg = data.message_draft || "We'd love to see you back, Lisa!";
                        console.log("✅ Daily Brief win-back generated:", msg);
                        await sendWinBackSMS(LISA_BRIEF.phone, msg);
                      } catch (err) {
                        console.error("Daily Brief win-back failed:", err);
                      }
                      setWinBackSent(true);
                    }}
                    style={{ padding: "8px 16px", borderRadius: 10, background: winBackSent === "sending" ? t.inputBg : t.accent, color: winBackSent === "sending" ? t.muted : "#fff", border: "none", fontSize: 13, fontWeight: 700, cursor: winBackSent ? "default" : "pointer", fontFamily: f, transition: "all 0.2s" }}>
                    {winBackSent === "sending" ? "Generating…" : "Send win-back"}
                  </button>
                  <button onClick={() => setWinBackSent(true)} style={{ padding: "8px 16px", borderRadius: 10, background: "transparent", color: t.text, border: `1px solid ${t.border}`, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: f }}>Skip</button>
                </>
            }
          </div>
        </div>

        {/* Family Hours streak — emotional close, the Duolingo pattern */}
        <div style={{ padding: "16px 18px", borderRadius: 14, background: t.greenBg, border: `1px solid ${t.green}20`, marginBottom: 20, display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 44, height: 44, borderRadius: 22, background: t.greenText, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 22 }}>🏠</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.3, color: t.greenText, marginBottom: 3 }}>FAMILY HOURS STREAK</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: t.text, marginBottom: 1 }}>12 days</div>
            <div style={{ fontSize: 12, color: t.greenText, fontWeight: 600 }}>Tonight 6–8 PM protected</div>
          </div>
        </div>

        {/* CTA + footer */}
        <button onClick={onOpenDashboard} style={{ width: "100%", padding: "16px 0", borderRadius: 14, background: `linear-gradient(135deg,#534AB7,#6D28D9)`, color: "#fff", border: "none", fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: f, marginBottom: 10 }}>Open dashboard</button>
        <div style={{ textAlign: "center", fontSize: 12, color: t.dim }}>60-second read · AutoPilot is on</div>
      </div>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════
// NOTIFICATIONS SCREEN
// ═══════════════════════════════════════════════════════════════════
const NOTIFS = {
  needsYou: [
    { id: "n1", icon: "alert", title: "Jamie T. wants the manager", body: 'AI escalated to you. "Want to talk to the manager about my last visit"', time: "3m", read: false },
    { id: "n2", icon: "warning", title: "Marcus's rebook rate dropped", body: "52% this week vs 78% avg. Three regulars haven't rebooked.", time: "2h", read: false },
  ],
  aiWins: [
    { id: "w1", icon: "lightning", title: "$340 recovered today", body: "3 slots filled · Lisa P., Diana K., Roberto S.", time: "1h" },
    { id: "w2", icon: "message", title: "AI handled 12 messages", body: "2 booked, 4 rescheduled, 6 questions answered", time: "3h" },
    { id: "w3", icon: "refresh", title: "3 win-backs sent", body: "Sarah K., Marcus B., Elena V. · 30-day reactivation", time: "5h" },
  ],
  updates: [
    { id: "u1", icon: "calendar", title: "Sarah Johnson booked Friday", body: "Hair Styling · Emma · 2 PM · $25 deposit", time: "6h" },
    { id: "u2", icon: "payout", title: "Payout sent · $1,240", body: "Emma Davis · weekly commission", time: "8h" },
  ],
};

function NotifIcon({ type, t, isWin, isAlert }) {
  const bg = isAlert ? t.pinkBg : isWin ? t.greenBg : t.inputBg;
  const stroke = isAlert ? t.pinkText : isWin ? t.greenText : t.sub;
  const icon = {
    alert: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2.2" strokeLinecap="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/><line x1="12" y1="2" x2="12" y2="4"/></svg>,
    warning: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2.2" strokeLinecap="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
    lightning: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2.2" strokeLinecap="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>,
    message: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2.2" strokeLinecap="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
    refresh: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2.2" strokeLinecap="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>,
    calendar: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2.2" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
    payout: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2.2" strokeLinecap="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>,
  }[type] || null;
  return <div style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0, background: bg, display: "flex", alignItems: "center", justifyContent: "center" }}>{icon}</div>;
}

function NotificationsScreen({ t, onClose }) {
  const [activeFilter, setActiveFilter] = useState("All");
  const [readIds, setReadIds] = useState(new Set());
  const [allRead, setAllRead] = useState(false);
  const needsYouCount = allRead ? 0 : NOTIFS.needsYou.filter(n => !readIds.has(n.id)).length;
  const markAllRead = () => { setAllRead(true); setReadIds(new Set([...NOTIFS.needsYou.map(n=>n.id),...NOTIFS.aiWins.map(n=>n.id),...NOTIFS.updates.map(n=>n.id)])); };
  const markRead = (id) => setReadIds(prev => new Set([...prev, id]));
  const filters = [
    { id: "All", label: "All", badge: allRead ? 0 : (NOTIFS.needsYou.length + NOTIFS.aiWins.length + NOTIFS.updates.length) },
    { id: "Needs you", label: "Needs you", badge: needsYouCount },
    { id: "AI wins", label: "AI wins", badge: 0 },
  ];
  const showNeedsYou = activeFilter === "All" || activeFilter === "Needs you";
  const showWins = activeFilter === "All" || activeFilter === "AI wins";
  const showUpdates = activeFilter === "All";
  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 300, borderRadius: 41, overflow: "hidden", background: t.bg, display: "flex", flexDirection: "column", animation: "slideUp 0.32s cubic-bezier(0.32,0.72,0,1) both" }}>
      <div style={{ display: "flex", justifyContent: "space-between", padding: "14px 28px 0", height: 36, flexShrink: 0 }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: t.statusBar }}>1:42 PM</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 20px 14px", flexShrink: 0 }}>
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", padding: 4, display: "flex" }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={t.text} strokeWidth="2.5" strokeLinecap="round"><path d="M15 18l-6-6 6-6"/></svg>
        </button>
        <div style={{ fontSize: 17, fontWeight: 700, color: t.text }}>Notifications</div>
        <button onClick={markAllRead} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 700, color: allRead ? t.muted : t.accent, fontFamily: f, padding: "4px 0" }}>{allRead ? "All read" : "Mark all read"}</button>
      </div>
      <div style={{ padding: "0 20px 16px", flexShrink: 0 }}>
        <div style={{ display: "flex", borderRadius: 12, padding: 3, background: t.inputBg, border: `1px solid ${t.border}`, gap: 2 }}>
          {filters.map((fl) => {
            const active = activeFilter === fl.id;
            return (
              <button key={fl.id} onClick={() => setActiveFilter(fl.id)} style={{ flex: 1, padding: "9px 6px", borderRadius: 10, fontSize: 12, border: "none", cursor: "pointer", fontFamily: f, background: active ? t.card : "transparent", color: active ? t.text : t.muted, fontWeight: active ? 700 : 500, display: "flex", alignItems: "center", justifyContent: "center", gap: 5, transition: "all 0.18s" }}>
                {fl.label}
                {fl.badge > 0 && <span style={{ minWidth: 18, height: 18, borderRadius: 9, padding: "0 5px", background: fl.id === "Needs you" ? "#EF4444" : t.accent, color: "#fff", fontSize: 10, fontWeight: 800, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>{fl.badge}</span>}
              </button>
            );
          })}
        </div>
      </div>
      <div style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch", padding: "0 20px 16px" }}>
        {showNeedsYou && NOTIFS.needsYou.length > 0 && (
          <>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color: t.muted, marginBottom: 10 }}>NEEDS YOUR EYES</div>
            {NOTIFS.needsYou.map((n) => {
              const isRead = readIds.has(n.id) || allRead;
              return (
                <div key={n.id} onClick={() => markRead(n.id)} style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "14px 14px", borderRadius: 14, background: isRead ? t.card : t.pinkBg, border: `1px solid ${isRead ? t.border : t.pink}50`, marginBottom: 8, cursor: "pointer", transition: "all 0.25s", borderLeft: isRead ? `1px solid ${t.border}` : `3px solid ${t.pink}` }}>
                  <NotifIcon type={n.icon} t={t} isAlert={!isRead} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 3 }}>
                      <div style={{ fontSize: 14, fontWeight: isRead ? 600 : 700, color: t.text, lineHeight: 1.3 }}>{n.title}</div>
                      <div style={{ fontSize: 11, color: t.muted, flexShrink: 0 }}>{n.time}</div>
                    </div>
                    <div style={{ fontSize: 13, color: t.sub, lineHeight: 1.5 }}>{n.body}</div>
                  </div>
                </div>
              );
            })}
          </>
        )}
        {showWins && (
          <>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color: t.muted, marginBottom: 10, marginTop: showNeedsYou ? 8 : 0 }}>AUTOPILOT WINS · TODAY</div>
            {NOTIFS.aiWins.map((n) => {
              const isWin = n.icon === "lightning";
              return (
                <div key={n.id} style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "14px 14px", borderRadius: 14, background: isWin ? t.greenBg : t.card, border: `1px solid ${isWin ? t.green + "30" : t.border}`, marginBottom: 8 }}>
                  <NotifIcon type={n.icon} t={t} isWin />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 3 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: isWin ? t.greenText : t.text, lineHeight: 1.3 }}>{n.title}</div>
                      <div style={{ fontSize: 11, color: t.muted, flexShrink: 0 }}>{n.time}</div>
                    </div>
                    <div style={{ fontSize: 13, color: isWin ? t.greenText : t.sub, lineHeight: 1.5, fontWeight: isWin ? 600 : 400 }}>{n.body}</div>
                  </div>
                </div>
              );
            })}
          </>
        )}
        {showUpdates && (
          <>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color: t.muted, marginBottom: 10, marginTop: 8 }}>UPDATES</div>
            {NOTIFS.updates.map((n) => (
              <div key={n.id} style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "14px 14px", borderRadius: 14, background: t.card, border: `1px solid ${t.border}`, marginBottom: 8 }}>
                <NotifIcon type={n.icon} t={t} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 3 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: t.text, lineHeight: 1.3 }}>{n.title}</div>
                    <div style={{ fontSize: 11, color: t.muted, flexShrink: 0 }}>{n.time}</div>
                  </div>
                  <div style={{ fontSize: 13, color: t.sub, lineHeight: 1.5 }}>{n.body}</div>
                </div>
              </div>
            ))}
          </>
        )}
        {showUpdates && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "13px 16px", borderRadius: 14, marginTop: 4, background: t.accentSoft, border: `1px solid ${t.accent}20` }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={t.accentText} strokeWidth="2" strokeLinecap="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
            <span style={{ fontSize: 13, color: t.accentText, fontWeight: 600, lineHeight: 1.4 }}>Family Hours active until 8 PM. Notifications quiet.</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// SETTINGS — BUSINESS PROFILE
// ═══════════════════════════════════════════════════════════════════
const THEMES = [
  { id: "midnight", label: "Midnight Gold", gradient: "linear-gradient(135deg,#2D1B69 0%,#534AB7 50%,#8B6A2E 100%)" },
  { id: "blush", label: "Blush Studio", gradient: "linear-gradient(135deg,#F9A8C4 0%,#EC4899 100%)" },
  { id: "sage", label: "Sage & Stone", gradient: "linear-gradient(135deg,#86EFAC 0%,#16A34A 100%)" },
  { id: "terracotta", label: "Terracotta", gradient: "linear-gradient(135deg,#FED7AA 0%,#F97316 100%)" },
  { id: "charcoal", label: "Charcoal Fade", gradient: "linear-gradient(135deg,#374151 0%,#111827 100%)" },
  { id: "ocean", label: "Ocean Fresh", gradient: "linear-gradient(135deg,#BAE6FD 0%,#1D4ED8 100%)" },
];

function BusinessProfileScreen({ t, onClose }) {
  const [shopName, setShopName] = useState("Stride Cuts");
  const [address, setAddress] = useState("10328 Whyte Ave, Edmonton");
  const [activeTheme, setActiveTheme] = useState("midnight");
  const [instagram, setInstagram] = useState("@stridecuts.yeg");
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const inp = { width: "100%", padding: "13px 14px", borderRadius: 10, background: t.card, border: `1px solid ${t.border}`, fontSize: 15, color: t.text, fontFamily: f, outline: "none", boxSizing: "border-box" };
  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 400, borderRadius: 41, overflow: "hidden", background: t.bg, display: "flex", flexDirection: "column", animation: "slideOverlay 0.28s ease both" }}>
      <div style={{ display: "flex", justifyContent: "space-between", padding: "14px 28px 0", height: 36, flexShrink: 0 }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: t.statusBar }}>9:44 AM</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 20px 14px", flexShrink: 0 }}>
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", display: "flex" }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={t.text} strokeWidth="2.5" strokeLinecap="round"><path d="M15 18l-6-6 6-6"/></svg>
        </button>
        <div style={{ fontSize: 17, fontWeight: 700, color: t.text }}>Business profile</div>
        <button onClick={() => { setSaved(true); setTimeout(() => { setSaved(false); onClose(); }, 900); }} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 15, fontWeight: 700, color: saved ? t.greenText : t.accent, fontFamily: f }}>{saved ? "✓ Saved" : "Save"}</button>
      </div>
      <div style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch", padding: "0 20px 28px" }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color: t.muted, marginBottom: 8 }}>SHOP NAME</div>
        <input value={shopName} onChange={e => setShopName(e.target.value)} style={{ ...inp, marginBottom: 16 }} />
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color: t.muted, marginBottom: 8 }}>ADDRESS</div>
        <input value={address} onChange={e => setAddress(e.target.value)} style={{ ...inp, marginBottom: 16 }} />
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color: t.muted, marginBottom: 8 }}>BOOKING LINK</div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "13px 14px", borderRadius: 10, background: t.card, border: `1px solid ${t.border}`, marginBottom: 20 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={t.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
          <span style={{ flex: 1, fontSize: 14, color: t.accentText, fontWeight: 600 }}>flatpurse.flow/stridecuts</span>
          <button onClick={() => { setCopied(true); setTimeout(() => setCopied(false), 2000); }} style={{ padding: "4px 10px", borderRadius: 7, background: copied ? t.greenBg : t.accentSoft, border: "none", cursor: "pointer", fontFamily: f, fontSize: 12, fontWeight: 700, color: copied ? t.greenText : t.accentText }}>{copied ? "✓ Copied" : "Copy"}</button>
        </div>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color: t.muted, marginBottom: 12 }}>BOOKING PAGE THEME</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 16 }}>
          {THEMES.map((th) => {
            const on = activeTheme === th.id;
            return (
              <div key={th.id} onClick={() => setActiveTheme(th.id)} style={{ cursor: "pointer" }}>
                <div style={{ height: 56, borderRadius: 10, background: th.gradient, border: `${on ? 2.5 : 1.5}px solid ${on ? t.accent : t.border}`, position: "relative", marginBottom: 5, transition: "border-color 0.2s" }}>
                  {on && <div style={{ position: "absolute", top: 5, right: 5, width: 18, height: 18, borderRadius: 9, background: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={t.accent} strokeWidth="3.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg></div>}
                </div>
                <div style={{ fontSize: 10, fontWeight: on ? 700 : 500, color: on ? t.text : t.sub, textAlign: "center", lineHeight: 1.3 }}>{th.label}</div>
              </div>
            );
          })}
        </div>
        <button style={{ width: "100%", padding: "14px 0", borderRadius: 12, background: t.accentSoft, border: `1px solid ${t.accent}30`, cursor: "pointer", fontFamily: f, fontSize: 14, fontWeight: 700, color: t.accentText, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 24 }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={t.accentText} strokeWidth="2" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          Preview booking page
        </button>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color: t.muted, marginBottom: 10 }}>SOCIAL LINKS</div>
        <div style={{ borderRadius: 14, background: t.card, border: `1px solid ${t.border}`, overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", borderBottom: `1px solid ${t.border}` }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={t.sub} strokeWidth="2" strokeLinecap="round"><rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill={t.sub}/></svg>
            <input value={instagram} onChange={e => setInstagram(e.target.value)} placeholder="@yourhandle" style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontSize: 14, color: t.text, fontFamily: f }} />
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={t.dim} strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", cursor: "pointer" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={t.muted} strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
            <span style={{ flex: 1, fontSize: 14, color: t.muted }}>Add website</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={t.muted} strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// SETTINGS — SERVICES & PRICING
// ═══════════════════════════════════════════════════════════════════
const SERVICES_DATA = [
  { id: "s1", name: "Hair Styling", duration: "1.5 hrs", who: "all stylists", price: 125, booked30d: 86, badge: "Most booked" },
  { id: "s2", name: "Balayage", duration: "2.5 hrs", who: "Emma only", price: 185, booked30d: 22, badge: null },
  { id: "s3", name: "Hair Treatment", duration: "45 min", who: "all stylists", price: 65, booked30d: 14, badge: null },
  { id: "s4", name: "Signature Cut", duration: "45 min", who: "all stylists", price: 45, booked30d: 31, badge: null },
  { id: "s5", name: "Cut + Beard", duration: "60 min", who: "Marcus, John", price: 65, booked30d: 18, badge: null },
];
const SVC_CATS = ["All (12)", "Hair", "Color", "Treatments"];

function ServicesPricingScreen({ t, onClose }) {
  const [search, setSearch] = useState("");
  const [activecat, setActivecat] = useState("All (12)");
  const filtered = SERVICES_DATA.filter(s => search.length === 0 || s.name.toLowerCase().includes(search.toLowerCase()));
  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 400, borderRadius: 41, overflow: "hidden", background: t.bg, display: "flex", flexDirection: "column", animation: "slideOverlay 0.28s ease both" }}>
      <div style={{ display: "flex", justifyContent: "space-between", padding: "14px 28px 0", height: 36, flexShrink: 0 }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: t.statusBar }}>9:43 AM</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 20px 12px", flexShrink: 0 }}>
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", display: "flex" }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={t.text} strokeWidth="2.5" strokeLinecap="round"><path d="M15 18l-6-6 6-6"/></svg>
        </button>
        <div style={{ fontSize: 17, fontWeight: 700, color: t.text }}>Services & pricing</div>
        <button style={{ background: "none", border: "none", cursor: "pointer", display: "flex", padding: 2 }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={t.accent} strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        </button>
      </div>
      <div style={{ padding: "0 20px 12px", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", borderRadius: 12, background: t.inputBg, border: `1px solid ${t.border}` }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={t.muted} strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search services" style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontSize: 14, color: t.text, fontFamily: f }} />
        </div>
      </div>
      <div style={{ padding: "0 20px 14px", display: "flex", gap: 8, overflowX: "auto", flexShrink: 0 }}>
        {SVC_CATS.map(cat => {
          const on = activecat === cat;
          return <button key={cat} onClick={() => setActivecat(cat)} style={{ padding: "7px 14px", borderRadius: 20, border: `${on ? 2 : 1}px solid ${on ? t.accent : t.border}`, background: on ? t.accent : t.card, color: on ? "#fff" : t.text, fontSize: 13, fontWeight: on ? 700 : 500, cursor: "pointer", fontFamily: f, flexShrink: 0 }}>{cat}</button>;
        })}
      </div>
      <div style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch", padding: "0 20px 20px" }}>
        {filtered.map((svc) => (
          <div key={svc.id} style={{ borderRadius: 14, background: t.card, border: `1px solid ${t.border}`, padding: "14px 16px", marginBottom: 10, boxShadow: t.shadow }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1 }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: t.text }}>{svc.name}</span>
                {svc.badge && <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 5, background: t.accentSoft, color: t.accentText }}>{svc.badge}</span>}
              </div>
              <span style={{ fontSize: 16, fontWeight: 800, color: t.text, marginLeft: 8 }}>${svc.price}</span>
            </div>
            <div style={{ fontSize: 12, color: t.sub, marginBottom: 10 }}>{svc.duration} · {svc.who}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 12px", borderRadius: 8, background: t.inputBg, border: `1px solid ${t.border}`, cursor: "pointer", fontFamily: f, fontSize: 12, fontWeight: 600, color: t.text }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={t.sub} strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>Edit
              </button>
              <button style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 12px", borderRadius: 8, background: t.inputBg, border: `1px solid ${t.border}`, cursor: "pointer", fontFamily: f, fontSize: 12, fontWeight: 600, color: t.text }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={t.sub} strokeWidth="2" strokeLinecap="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>Duplicate
              </button>
              <div style={{ flex: 1, textAlign: "right", fontSize: 12, fontWeight: 700, color: t.accentText }}>{svc.booked30d} booked / 30d</div>
            </div>
          </div>
        ))}
        <div style={{ padding: "14px 16px", borderRadius: 14, background: t.yellowBg, border: `1px solid ${t.yellow}20`, display: "flex", gap: 10, alignItems: "flex-start" }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill={t.yellow} style={{ flexShrink: 0, marginTop: 1 }}><path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/></svg>
          <div style={{ fontSize: 13, color: t.text, lineHeight: 1.6 }}>Hair Styling generates <strong>68%</strong> of your revenue. Consider a premium tier at $150 for senior stylists.</div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// SETTINGS HUB
// ═══════════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════
// INTEGRATIONS SCREEN — SMS bundle · A2P 10DLC · Interac settings
// ═══════════════════════════════════════════════════════════════════
function IntegrationsScreen({ t, onClose }) {
  const [smsUsed] = useState(247);
  const [smsTotal] = useState(1000);
  const [a2pStatus, setA2pStatus] = useState("unregistered");
  const [showRegForm, setShowRegForm] = useState(false);
  const [regForm, setRegForm] = useState({ legalName: "", ein: "", sampleMsg: "Hi [Name], your appointment at [Salon] is confirmed for [Date] at [Time]. Reply STOP to opt out." });
  const [regSubmitting, setRegSubmitting] = useState(false);
  const [interacEnabled, setInteracEnabled] = useState(true);
  const [interacEmail, setInteracEmail] = useState("deposits@yoursalon.com");
  const smsPct = Math.round(smsUsed / smsTotal * 100);

  const handleRegSubmit = async () => {
    setRegSubmitting(true);
    try {
      await fetch("/api/messaging/sms/register-10dlc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ legalName: regForm.legalName, ein: regForm.ein }),
      });
      setA2pStatus("pending");
      setShowRegForm(false);
    } catch {}
    setRegSubmitting(false);
  };

  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 360, borderRadius: 41, overflow: "hidden", background: t.bg, display: "flex", flexDirection: "column", animation: "slideUp 0.32s cubic-bezier(0.32,0.72,0,1) both" }}>
      <div style={{ display: "flex", justifyContent: "space-between", padding: "14px 28px 0", height: 36, flexShrink: 0 }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: t.statusBar }}>9:42 AM</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", padding: "10px 20px 14px", flexShrink: 0 }}>
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", marginRight: 12 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={t.text} strokeWidth="2.5" strokeLinecap="round"><path d="M15 18l-6-6 6-6"/></svg>
        </button>
        <div style={{ fontSize: 22, fontWeight: 800, color: t.text, letterSpacing: -0.5 }}>Integrations</div>
      </div>
      <div style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch", padding: "0 20px 28px" }}>

        {/* ── SMS Bundle ── */}
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color: t.muted, marginBottom: 10 }}>SMS PLAN</div>
        <div style={{ padding: "16px 18px", borderRadius: 16, background: t.card, border: `1px solid ${t.border}`, marginBottom: 20, boxShadow: t.shadow }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: t.text }}>1,000 SMS / month included</div>
            <div style={{ fontSize: 13, color: smsPct >= 80 ? "#D97706" : t.greenText, fontWeight: 700 }}>{smsPct}% used</div>
          </div>
          <div style={{ height: 8, borderRadius: 4, background: t.inputBg, overflow: "hidden", marginBottom: 8 }}>
            <div style={{ height: "100%", width: `${smsPct}%`, borderRadius: 4, background: smsPct >= 80 ? "#F59E0B" : t.green, transition: "width 0.5s" }} />
          </div>
          <div style={{ fontSize: 12, color: t.sub }}>{smsUsed} sent · {smsTotal - smsUsed} remaining this month</div>
          {smsPct >= 80 && (
            <button style={{ marginTop: 12, width: "100%", padding: "10px 0", borderRadius: 10, background: "#FEF3C7", border: "1px solid #F59E0B", color: "#D97706", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: f }}>
              Top up SMS credits →
            </button>
          )}
        </div>

        {/* ── A2P 10DLC ── */}
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color: t.muted, marginBottom: 10 }}>CARRIER REGISTRATION (A2P 10DLC)</div>
        <div style={{ padding: "16px 18px", borderRadius: 16, background: t.card, border: `1px solid ${t.border}`, marginBottom: 12, boxShadow: t.shadow }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: a2pStatus === "registered" ? t.green : a2pStatus === "pending" ? "#F59E0B" : "#EF4444", flexShrink: 0 }} />
            <div style={{ fontSize: 14, fontWeight: 700, color: t.text, textTransform: "capitalize" }}>{a2pStatus}</div>
          </div>
          {a2pStatus === "unregistered" && (
            <>
              <div style={{ padding: "10px 12px", borderRadius: 10, background: "#FEE2E2", border: "1px solid #FECACA", marginBottom: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#991B1B", marginBottom: 2 }}>⚠ SMS delivery may fail without carrier registration</div>
                <div style={{ fontSize: 11, color: "#7F1D1D", lineHeight: 1.5 }}>US/Canadian carriers require businesses to register before sending marketing SMS.</div>
              </div>
              <button onClick={() => setShowRegForm(!showRegForm)} style={{ width: "100%", padding: "11px 0", borderRadius: 12, background: t.accent, color: "#fff", border: "none", cursor: "pointer", fontFamily: f, fontSize: 13, fontWeight: 700 }}>
                Register now →
              </button>
            </>
          )}
          {a2pStatus === "pending" && <div style={{ fontSize: 13, color: t.sub }}>Registration submitted — carrier approval takes 1–3 business days.</div>}
          {a2pStatus === "registered" && <div style={{ fontSize: 13, color: t.greenText, fontWeight: 600 }}>✓ Fully registered — SMS delivery optimized</div>}
        </div>

        {showRegForm && a2pStatus === "unregistered" && (
          <div style={{ padding: "16px 18px", borderRadius: 16, background: t.accentSoft, border: `1px solid ${t.accent}20`, marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: t.accentText, marginBottom: 14 }}>Brand Registration</div>
            {[{ label: "Business legal name", key: "legalName", ph: "George's Barbershop Inc." }, { label: "EIN / Business Number", key: "ein", ph: "12-3456789" }].map(field => (
              <div key={field.key} style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: t.muted, marginBottom: 6 }}>{field.label.toUpperCase()}</div>
                <input value={regForm[field.key]} onChange={e => setRegForm(fr => ({ ...fr, [field.key]: e.target.value }))} placeholder={field.ph} style={{ width: "100%", padding: "11px 14px", borderRadius: 10, background: t.card, border: `1px solid ${t.border}`, fontSize: 14, color: t.text, fontFamily: f, outline: "none", boxSizing: "border-box" }} />
              </div>
            ))}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: t.muted, marginBottom: 6 }}>SAMPLE MESSAGE</div>
              <textarea value={regForm.sampleMsg} onChange={e => setRegForm(fr => ({ ...fr, sampleMsg: e.target.value }))} style={{ width: "100%", padding: "11px 14px", borderRadius: 10, background: t.card, border: `1px solid ${t.border}`, fontSize: 12, color: t.sub, fontFamily: f, outline: "none", resize: "none", minHeight: 68, boxSizing: "border-box", lineHeight: 1.5 }} />
            </div>
            <button onClick={handleRegSubmit} disabled={regSubmitting || !regForm.legalName || !regForm.ein} style={{ width: "100%", padding: "12px 0", borderRadius: 12, background: regSubmitting || !regForm.legalName || !regForm.ein ? t.inputBg : t.accent, color: regSubmitting || !regForm.legalName || !regForm.ein ? t.muted : "#fff", border: "none", cursor: "pointer", fontFamily: f, fontSize: 14, fontWeight: 700 }}>
              {regSubmitting ? "Submitting…" : "Submit registration"}
            </button>
          </div>
        )}

        {/* ── Interac deposits ── */}
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color: t.muted, marginBottom: 10 }}>INTERAC E-TRANSFER DEPOSITS</div>
        <div style={{ padding: "16px 18px", borderRadius: 16, background: t.card, border: `1px solid ${t.border}`, marginBottom: 20, boxShadow: t.shadow }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: interacEnabled ? 12 : 0 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: t.text }}>Accept Interac deposits</div>
              <div style={{ fontSize: 12, color: t.sub, marginTop: 2 }}>Zero processing fee — clients e-Transfer directly</div>
            </div>
            <Toggle on={interacEnabled} onToggle={() => setInteracEnabled(!interacEnabled)} t={t} />
          </div>
          {interacEnabled && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: t.muted, marginBottom: 6 }}>DEPOSIT EMAIL</div>
              <input value={interacEmail} onChange={e => setInteracEmail(e.target.value)} style={{ width: "100%", padding: "11px 14px", borderRadius: 10, background: t.inputBg, border: `1px solid ${t.border}`, fontSize: 14, color: t.text, fontFamily: f, outline: "none", boxSizing: "border-box" }} />
            </div>
          )}
        </div>

        {/* ── Stripe ── */}
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color: t.muted, marginBottom: 10 }}>PAYMENTS</div>
        <div style={{ padding: "14px 18px", borderRadius: 16, background: t.card, border: `1px solid ${t.border}`, boxShadow: t.shadow, display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: "#635BFF", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: "#fff" }}>S</span>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: t.text }}>Stripe</div>
            <div style={{ fontSize: 12, color: t.greenText, fontWeight: 600 }}>✓ Connected</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SettingsRow({ icon, title, sub, t, onClick }) {
  return (
    <div onClick={onClick} style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 16px", cursor: onClick ? "pointer" : "default", borderBottom: `1px solid ${t.border}` }}>
      <div style={{ width: 38, height: 38, borderRadius: 10, background: t.inputBg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{icon}</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: t.text, marginBottom: 2 }}>{title}</div>
        <div style={{ fontSize: 12, color: t.sub }}>{sub}</div>
      </div>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={t.dim} strokeWidth="2.5" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
    </div>
  );
}

function SettingsHubScreen({ t, onClose, onOpenBusiness, onOpenServices }) {
  const [showSupport, setShowSupport] = useState(false);
  const [showIntegrations, setShowIntegrations] = useState(false);
  const shopRows = [
    { title: "Business profile", sub: "Name, address, booking page brand", onClick: onOpenBusiness, icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={t.orangeText} strokeWidth="2" strokeLinecap="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg> },
    { title: "Services & pricing", sub: "12 services · edit anytime", onClick: onOpenServices, icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={t.pinkText} strokeWidth="2" strokeLinecap="round"><line x1="19" y1="5" x2="5" y2="19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/></svg> },
    { title: "Hours & Family Hours", sub: "Open hrs · 12-day streak", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={t.accentText} strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg> },
    { title: "Staff & permissions", sub: "4 staff · manager mode off", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={t.blueText} strokeWidth="2" strokeLinecap="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg> },
  ];
  const apRows = [
    { title: "Automation rules", sub: "6 flows running · all on", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={t.accentText} strokeWidth="2" strokeLinecap="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg> },
    { title: "AI Front Desk tone", sub: "Warm · 92% handle rate", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={t.greenText} strokeWidth="2" strokeLinecap="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg> },
    { title: "Integrations", sub: "Stripe · Instagram · SMS", onClick: () => setShowIntegrations(true), icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={t.sub} strokeWidth="2" strokeLinecap="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg> },
  ];
  const acctRows = [
    { title: "Billing", sub: "$49/mo · next on Jun 5", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={t.sub} strokeWidth="2" strokeLinecap="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg> },
    { title: "Notifications", sub: "Push, email, SMS", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={t.sub} strokeWidth="2" strokeLinecap="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg> },
    { title: "Help & support", sub: "< 2hr response · Edmonton team", onClick: () => setShowSupport(true), icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={t.sub} strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> },
  ];
  const Section = ({ label, rows }) => (
    <>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color: t.muted, marginBottom: 10 }}>{label}</div>
      <div style={{ borderRadius: 14, background: t.card, border: `1px solid ${t.border}`, overflow: "hidden", marginBottom: 20, boxShadow: t.shadow }}>
        {rows.map((r, i) => (
          <div key={i} style={{ borderBottom: i < rows.length - 1 ? undefined : "none" }}>
            <SettingsRow t={t} {...r} />
          </div>
        ))}
      </div>
    </>
  );
  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 350, borderRadius: 41, overflow: "hidden", background: t.bg, display: "flex", flexDirection: "column", animation: "slideUp 0.32s cubic-bezier(0.32,0.72,0,1) both" }}>
      <div style={{ display: "flex", justifyContent: "space-between", padding: "14px 28px 0", height: 36, flexShrink: 0 }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: t.statusBar }}>9:42 AM</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", padding: "10px 20px 14px", flexShrink: 0 }}>
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", marginRight: 12 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={t.text} strokeWidth="2.5" strokeLinecap="round"><path d="M15 18l-6-6 6-6"/></svg>
        </button>
        <div style={{ fontSize: 22, fontWeight: 800, color: t.text, letterSpacing: -0.5 }}>Settings</div>
      </div>
      <div style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch", padding: "0 20px 28px" }}>
        <div style={{ borderRadius: 16, background: t.accentSoft, border: `1px solid ${t.accent}20`, padding: "16px 18px", marginBottom: 22, display: "flex", alignItems: "center", gap: 14, cursor: "pointer" }}>
          <div style={{ width: 48, height: 48, borderRadius: 24, background: t.accent, color: "#fff", fontSize: 16, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>GO</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: t.text }}>George Ogunbande</div>
            <div style={{ fontSize: 13, color: t.accentText, fontWeight: 600, marginTop: 2 }}>Founders Plan · $49/mo</div>
          </div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={t.dim} strokeWidth="2.5" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
        </div>
        <Section label="YOUR SHOP" rows={shopRows} />
        <Section label="AUTOPILOT" rows={apRows} />
        <Section label="ACCOUNT" rows={acctRows} />
        {/* ── Your data is yours — trust section ── */}
        <div style={{ borderRadius: 14, background: t.accentSoft, border: `1px solid ${t.accent}20`, padding: "14px 16px", marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.4, color: t.accentText, marginBottom: 8 }}>YOUR DATA IS YOURS</div>
          <div style={{ fontSize: 13, color: t.text, lineHeight: 1.65, marginBottom: 10 }}>
            No marketplace. No commission on your clients. FlatPurse Flow never sells your data or shows your clients competing salons.
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => {
                const headers = ["Name","Phone","Email","LTV","Visits","Last Visit","Tags"];
                const rows = CLIENTS_DB.map(c => [c.name, c.phone, c.email, c.ltv, c.visits, c.lastVisit, (c.tags||[]).join("|")]);
                const csv = [headers,...rows].map(r=>r.map(v=>`"${String(v).replace(/"/g,"'")}`).join(",")).join(String.fromCharCode(10));
                const blob = new Blob([csv],{type:"text/csv"});
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href=url; a.download="flatpurse-clients.csv"; a.click();
                URL.revokeObjectURL(url);
              }}
              style={{ flex: 1, padding: "9px 0", borderRadius: 10, background: t.accent, color: "#fff", border: "none", cursor: "pointer", fontFamily: f, fontSize: 12, fontWeight: 700 }}>
              ↓ Export all clients
            </button>
            <button style={{ flex: 1, padding: "9px 0", borderRadius: 10, background: t.card, color: t.text, border: `1px solid ${t.border}`, cursor: "pointer", fontFamily: f, fontSize: 12, fontWeight: 700 }}>
              View privacy policy
            </button>
          </div>
        </div>

        <button style={{ width: "100%", padding: "15px 0", borderRadius: 14, background: t.card, border: `1px solid ${t.border}`, fontSize: 15, fontWeight: 600, color: t.text, cursor: "pointer", fontFamily: f }}>Sign out</button>
      </div>

      {/* ── Support overlay ── */}
      {showSupport && (
        <div style={{ position: "absolute", inset: 0, zIndex: 20, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "flex-end", borderRadius: 41, overflow: "hidden" }}>
          <div style={{ width: "100%", background: t.bg, borderRadius: "22px 22px 0 0", padding: "20px 22px 36px", animation: "slideUp 0.28s cubic-bezier(0.32,0.72,0,1) both" }}>
            <div style={{ width: 40, height: 4, borderRadius: 2, background: t.border, margin: "0 auto 18px" }} />
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
              <div style={{ width: 46, height: 46, borderRadius: 23, background: t.accent, color: "#fff", fontSize: 16, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>GO</div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 800, color: t.text }}>George Ogunbande</div>
                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#22C55E" }} />
                  <span style={{ fontSize: 12, color: t.greenText, fontWeight: 600 }}>Online now · Edmonton, AB</span>
                </div>
              </div>
            </div>
            {/* SLA promise */}
            <div style={{ padding: "12px 16px", borderRadius: 12, background: t.greenBg, border: `1px solid ${t.green}20`, marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: t.greenText, marginBottom: 3 }}>Under 2-hour response · business hours</div>
              <div style={{ fontSize: 12, color: t.sub }}>North American team. No offshore tickets. No chatbots. Real humans who built this product.</div>
            </div>
            {/* Contact options */}
            {[
              { icon: "💬", label: "WhatsApp George", sub: "+1 (780) XXX-XXXX", bg: "#25D366", color: "#fff" },
              { icon: "✉️", label: "Email support", sub: "hello@flatpurse.com", bg: t.accentSoft, color: t.accentText },
              { icon: "📅", label: "Book a 15-min call", sub: "calendly.com/flatpurse", bg: t.card, color: t.text },
            ].map((c, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 16px", borderRadius: 13, background: c.bg, border: `1px solid ${t.border}`, marginBottom: 8, cursor: "pointer" }}>
                <span style={{ fontSize: 20 }}>{c.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: c.color }}>{c.label}</div>
                  <div style={{ fontSize: 12, color: t.sub }}>{c.sub}</div>
                </div>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={t.dim} strokeWidth="2.5" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
              </div>
            ))}
            <button onClick={() => setShowSupport(false)} style={{ width: "100%", marginTop: 10, padding: "13px 0", background: "none", border: "none", cursor: "pointer", fontSize: 14, color: t.muted, fontFamily: f }}>Close</button>
          </div>
        </div>
      )}
      {showIntegrations && <IntegrationsScreen t={t} onClose={() => setShowIntegrations(false)} />}
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════
// CLIENT-FACING BOOKING PAGE (redesigned)
// ═══════════════════════════════════════════════════════════════════
const BOOKING_SERVICES = [
  { id: "sig", emoji: "✂️", bg: "#FFE8E8", name: "Signature Cut", badge: "Most popular", badgeColor: "#534AB7", badgeBg: "rgba(83,74,183,0.1)", duration: "45 min", desc: "Classic cut tailored to your style", price: 45 },
  { id: "beard", emoji: "🪒", bg: "#E8F0FF", name: "Cut + Beard", badge: null, duration: "60 min", desc: "Haircut with beard trim & shape", price: 65 },
  { id: "kids", emoji: "🧒", bg: "#FFF3E0", name: "Kids Cut (under 12)", badge: null, duration: "30 min", desc: "Perfect for our younger clients", price: 30 },
  { id: "shave", emoji: "🏆", bg: "#FFF8E0", name: "Hot Towel Shave", badge: "Premium", badgeColor: "#92400E", badgeBg: "rgba(180,83,9,0.1)", duration: "45 min", desc: "Traditional hot towel shave experience", price: 55 },
];

function BookingPageIcon({ d, size = 18, color = "currentColor", sw = 1.8, children }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
      {d ? <path d={d}/> : children}
    </svg>
  );
}

function BookingPage({ onClose }) {
  const [heroUrl, setHeroUrl] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [selectedSvc, setSelectedSvc] = useState(null);
  const [bookingStep, setBookingStep] = useState(null); // null | 2 | 3 | 4
  const [booking, setBooking] = useState(null);
  const [customer, setCustomer] = useState(null);
  const fileRef = useRef(null);
  const bpf = "'DM Sans','Inter',sans-serif";

  const pickFile = (file) => {
    if (!file || !file.type.startsWith("image/")) return;
    setHeroUrl(URL.createObjectURL(file));
  };

  // When a booking step is active, render just that step full-screen inside BookingPage
  if (bookingStep === 2 && selectedSvc) {
    return (
      <div style={{ position: "absolute", inset: 0, zIndex: 250, borderRadius: 41, overflow: "hidden", background: "#0E0E11", display: "flex", flexDirection: "column" }}>
        {/* Fake dark status bar */}
        <div style={{ padding: "14px 28px 0", flexShrink: 0 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: "#fff" }}>9:41</span>
        </div>
        <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
          {/* BStep2 runs inside here with a dark-themed wrapper */}
          <div style={{ position: "absolute", inset: 0, background: "#FAF8F5", borderRadius: "18px 18px 0 0", top: 10, overflow: "hidden" }}>
            <BStep2
              t={T["light"]}
              service={{ name: selectedSvc.name, price: selectedSvc.price, duration: selectedSvc.duration, id: selectedSvc.id }}
              onBack={() => setBookingStep(null)}
              onNext={bk => { setBooking(bk); setBookingStep(3); }}
            />
          </div>
        </div>
      </div>
    );
  }

  if (bookingStep === 3 && selectedSvc && booking) {
    return (
      <div style={{ position: "absolute", inset: 0, zIndex: 250, borderRadius: 41, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        <BStep3
          t={T["light"]}
          service={{ name: selectedSvc.name, price: selectedSvc.price, duration: selectedSvc.duration, id: selectedSvc.id }}
          booking={booking}
          onBack={() => setBookingStep(2)}
          onConfirm={cust => { setCustomer(cust); setBookingStep(4); }}
        />
      </div>
    );
  }

  if (bookingStep === 4 && selectedSvc && booking && customer) {
    return (
      <div style={{ position: "absolute", inset: 0, zIndex: 250, borderRadius: 41, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        <BStep4
          t={T["light"]}
          service={{ name: selectedSvc.name, price: selectedSvc.price, duration: selectedSvc.duration, id: selectedSvc.id }}
          booking={booking}
          customer={customer}
          onClose={onClose}
        />
      </div>
    );
  }

  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 250, borderRadius: 41, overflow: "hidden", background: "#0E0E11", display: "flex", flexDirection: "column", animation: "slideOverlay 0.28s ease both" }}>
      {/* Status bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 28px 0", flexShrink: 0 }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: "#fff" }}>9:41</span>
        <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
          <svg width="18" height="12" viewBox="0 0 18 12"><rect x="0" y="8" width="3" height="4" rx="0.5" fill="#fff"/><rect x="4.5" y="5.5" width="3" height="6.5" rx="0.5" fill="#fff"/><rect x="9" y="3" width="3" height="9" rx="0.5" fill="#fff"/><rect x="13.5" y="0" width="3" height="12" rx="0.5" fill="#fff"/></svg>
          <svg width="26" height="13" viewBox="0 0 26 13" fill="none"><rect x="0.5" y="0.5" width="21" height="12" rx="3.5" stroke="rgba(255,255,255,0.35)"/><rect x="2" y="2" width="16" height="9" rx="2" fill="rgba(255,255,255,0.85)"/><path d="M22.5 4.5v4a2 2 0 000-4z" fill="rgba(255,255,255,0.35)"/></svg>
        </div>
      </div>
      {/* Nav */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 20px 16px", flexShrink: 0 }}>
        <button onClick={onClose} style={{ width: 38, height: 38, borderRadius: "50%", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.1)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <BookingPageIcon d="M15 18l-6-6 6-6" color="#fff" sw={2.5} />
        </button>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "7px 16px", borderRadius: 24, background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.08)" }}>
          <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#22C55E", boxShadow: "0 0 8px #22C55E88" }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: "#fff", fontFamily: bpf }}>Open until 7 PM</span>
        </div>
        <button style={{ width: 38, height: 38, borderRadius: "50%", background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <BookingPageIcon color="#fff" sw={1.8}><path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></BookingPageIcon>
        </button>
      </div>

      {/* Hero upload zone */}
      <div style={{ margin: "0 16px 18px", flexShrink: 0 }}>
        {heroUrl ? (
          <div style={{ position: "relative", height: 172, borderRadius: 18, overflow: "hidden" }}>
            <img src={heroUrl} alt="Cover" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(0,0,0,0.05), rgba(0,0,0,0.55))" }} />
            <label style={{ position: "absolute", bottom: 10, right: 10, padding: "5px 12px", borderRadius: 20, background: "rgba(0,0,0,0.55)", border: "1px solid rgba(255,255,255,0.18)", cursor: "pointer", fontSize: 11, fontWeight: 700, color: "#fff", fontFamily: bpf }}>
              📷 Change<input type="file" accept="image/*" style={{ display: "none" }} onChange={e => pickFile(e.target.files[0])} />
            </label>
          </div>
        ) : (
          <div
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={e => { e.preventDefault(); setDragging(false); pickFile(e.dataTransfer.files[0]); }}
            onClick={() => fileRef.current && fileRef.current.click()}
            style={{ height: 172, borderRadius: 18, border: `2px dashed ${dragging ? "#6D5FD8" : "rgba(255,255,255,0.14)"}`, background: "rgba(255,255,255,0.025)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, cursor: "pointer", transition: "all 0.2s" }}>
            <input ref={fileRef} type="file" accept="image/png,image/jpeg" style={{ display: "none" }} onChange={e => pickFile(e.target.files[0])} />
            <div style={{ width: 52, height: 52, borderRadius: "50%", background: "#534AB7", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 8px 24px rgba(83,74,183,0.5)" }}>
              <BookingPageIcon color="#fff" sw={2.5}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></BookingPageIcon>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#fff", marginBottom: 5, fontFamily: bpf }}>Add a cover photo</div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.38)", lineHeight: 1.7, fontFamily: bpf }}>Recommended: 1600 × 900<br/>PNG or JPG · Max 5MB</div>
            </div>
          </div>
        )}
      </div>

      {/* Shop identity */}
      <div style={{ padding: "0 20px 16px", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, marginBottom: 8 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
              <span style={{ fontSize: 25, fontWeight: 800, color: "#fff", letterSpacing: -0.8, lineHeight: 1.1, fontFamily: bpf }}>Stride Cuts</span>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 9px", borderRadius: 20, background: "#534AB7" }}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                <span style={{ fontSize: 10, fontWeight: 700, color: "#fff", letterSpacing: 0.5, fontFamily: bpf }}>Verified</span>
              </div>
            </div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", lineHeight: 1.5, fontFamily: bpf }}>Premium barbering. Sharp cuts.</div>
          </div>
          <div style={{ flexShrink: 0, padding: "8px 12px", borderRadius: 12, background: "#1C1C22", border: "1px solid rgba(255,255,255,0.07)", textAlign: "center", minWidth: 80 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 3, marginBottom: 2 }}>
              <span style={{ fontSize: 14, color: "#F59E0B" }}>★</span>
              <span style={{ fontSize: 19, fontWeight: 800, color: "#fff", fontFamily: bpf }}>4.9</span>
            </div>
            <div style={{ fontSize: 10, color: "#F59E0B" }}>★★★★★</div>
            <div style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", marginTop: 1, fontFamily: bpf }}>(287 reviews)</div>
          </div>
        </div>
        {/* Stats strip */}
        <div style={{ display: "flex", borderRadius: 11, background: "#1C1C22", border: "1px solid rgba(255,255,255,0.06)", overflow: "hidden", marginBottom: 10 }}>
          {[["👥","1,200+","Clients"],["⏱","15 min","Response"],["✓","98%","Satisfaction"],["🛡","Verified","Business"]].map(([icon,val,label],i) => (
            <div key={i} style={{ flex: 1, padding: "9px 4px", borderRight: i < 3 ? "1px solid rgba(255,255,255,0.06)" : "none", display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
              <span style={{ fontSize: 12 }}>{icon}</span>
              <div style={{ fontSize: 11, fontWeight: 800, color: "#fff", whiteSpace: "nowrap", fontFamily: bpf }}>{val}</div>
              <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", whiteSpace: "nowrap", fontFamily: bpf }}>{label}</div>
            </div>
          ))}
        </div>
        {/* Contact */}
        <div style={{ display: "flex", alignItems: "center", padding: "9px 14px", borderRadius: 10, background: "#1C1C22", border: "1px solid rgba(255,255,255,0.06)" }}>
          {[["📍","Whyte Ave, Edmonton"],["📞","(587) 123-4567"],["📸","@stridecuts"]].map(([icon,text],i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 4, flex: 1, justifyContent: i===1?"center":i===2?"flex-end":"flex-start", borderRight: i<2?"1px solid rgba(255,255,255,0.07)":"none", paddingRight: i<2?6:0, paddingLeft: i>0?6:0 }}>
              <span style={{ fontSize: 10 }}>{icon}</span>
              <span style={{ fontSize: 10, color: "rgba(255,255,255,0.45)", whiteSpace: "nowrap", fontFamily: bpf }}>{text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Light section — services */}
      <div style={{ flex: 1, background: "#F9F8F6", borderRadius: "20px 20px 0 0", overflowY: "auto", WebkitOverflowScrolling: "touch" }}>
        {/* Trust pills */}
        <div style={{ display: "flex", borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
          {[["🛡️","Top Rated","4.9 ★ on Google"],["📅","Easy Booking","Instant confirm"],["💳","Secure Payments","Safe & encrypted"],["👥","Trusted by","1,200+ clients"]].map(([icon,label,sub],i) => (
            <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "12px 4px 10px", borderRight: i<3?"1px solid rgba(0,0,0,0.06)":"none" }}>
              <span style={{ fontSize: 17 }}>{icon}</span>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#1E293B", whiteSpace: "nowrap", fontFamily: bpf }}>{label}</div>
                <div style={{ fontSize: 9, color: "#94A3B8", whiteSpace: "nowrap", fontFamily: bpf }}>{sub}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Services */}
        <div style={{ padding: "16px 16px 0" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#1E293B", letterSpacing: -0.4, fontFamily: bpf }}>Choose a service</div>
            <button style={{ fontSize: 12, fontWeight: 600, color: "#534AB7", background: "none", border: "none", cursor: "pointer", fontFamily: bpf }}>View all →</button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 10 }}>
            {BOOKING_SERVICES.map((svc) => {
              const on = selectedSvc?.id === svc.id;
              return (
                <div key={svc.id} onClick={() => setSelectedSvc(on ? null : svc)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 14, background: "#fff", border: `${on?2:1}px solid ${on?"#534AB7":"rgba(0,0,0,0.06)"}`, cursor: "pointer", transition: "all 0.15s", boxShadow: on?"0 0 0 4px rgba(83,74,183,0.08)":"0 1px 2px rgba(0,0,0,0.03)" }}>
                  <div style={{ width: 46, height: 46, borderRadius: 13, background: svc.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>{svc.emoji}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: "#1E293B", fontFamily: bpf }}>{svc.name}</span>
                      {svc.badge && <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 20, background: svc.badgeBg, color: svc.badgeColor, fontFamily: bpf }}>{svc.badge}</span>}
                    </div>
                    <div style={{ fontSize: 11, color: "#64748B", fontFamily: bpf }}>{svc.duration} · {svc.desc}</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                    <span style={{ fontSize: 16, fontWeight: 800, color: "#1E293B", fontFamily: bpf }}>${svc.price}</span>
                    <div style={{ width: 28, height: 28, borderRadius: "50%", background: on?"#534AB7":"#F1F0F0", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s" }}>
                      <BookingPageIcon d="M9 18l6-6-6-6" size={13} color={on?"#fff":"#94A3B8"} sw={2.5} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pick a time CTA — now launches real booking flow */}
          <div
            onClick={() => selectedSvc && setBookingStep(2)}
            style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", borderRadius: 14, background: selectedSvc ? "#534AB7" : "#EDEAF8", cursor: selectedSvc ? "pointer" : "default", transition: "all 0.2s", marginBottom: 20 }}>
            <div style={{ width: 38, height: 38, borderRadius: 11, background: selectedSvc ? "rgba(255,255,255,0.18)" : "rgba(83,74,183,0.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <span style={{ fontSize: 18 }}>📅</span>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: selectedSvc ? "#fff" : "#534AB7", marginBottom: 2, fontFamily: bpf }}>
                {selectedSvc ? `Book ${selectedSvc.name} — $${selectedSvc.price}` : "Pick a time that works for you"}
              </div>
              <div style={{ fontSize: 11, color: selectedSvc ? "rgba(255,255,255,0.7)" : "#8B87CC", fontFamily: bpf }}>
                {selectedSvc ? `${selectedSvc.duration} · Choose barber & time →` : "See available barbers & times"}
              </div>
            </div>
            <BookingPageIcon d="M5 12h14M12 5l7 7-7 7" size={16} color={selectedSvc ? "#fff" : "#534AB7"} />
          </div>
        </div>
      </div>
    </div>
  );
}

function EmailBriefScreen({ t, onClose }) {
  const [winBackSent, setWinBackSent] = useState(false);
  const ebf = "'DM Sans','Inter',sans-serif";

  const StatCard = ({ label, value, delta, deltaColor }) => (
    <div style={{ flex: 1, padding: "12px 14px", borderRadius: 12, background: t.card, border: `1px solid ${t.border}` }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.2, color: t.muted, marginBottom: 4, textTransform: "uppercase" }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 800, color: t.text, marginBottom: 2 }}>{value}</div>
      <div style={{ fontSize: 11, fontWeight: 600, color: deltaColor }}>{delta}</div>
    </div>
  );

  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 300, borderRadius: 41, overflow: "hidden", background: t.bg, display: "flex", flexDirection: "column", animation: "slideUp 0.32s cubic-bezier(0.32,0.72,0,1) both" }}>
      {/* Status bar */}
      <div style={{ display: "flex", justifyContent: "space-between", padding: "14px 28px 0", flexShrink: 0 }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: t.statusBar }}>7:00 AM</span>
      </div>

      {/* Email header — dark brand block */}
      <div style={{ background: "#1E1B4B", padding: "16px 20px 20px", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
          <div style={{ width: 24, height: 24, borderRadius: 7, background: "#534AB7", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
          </div>
          <span style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.55)", letterSpacing: 1.2, fontFamily: ebf }}>FLATPURSE FLOW</span>
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginLeft: "auto", fontFamily: ebf }}>Wed, May 7 · 7:00 AM</span>
        </div>
        <div style={{ fontSize: 20, fontWeight: 800, color: "#fff", marginBottom: 4, fontFamily: ebf }}>Good morning, George ☀️</div>
        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", fontFamily: ebf }}>Your business is handled. Here's the story.</div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch" }}>
        {/* 2x2 hero stats */}
        <div style={{ padding: "16px 16px 0", background: "#F0EFFE" }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            <StatCard label="Revenue" value="$2,140" delta="↑ +12% vs Mon" deltaColor={t.greenText} />
            <StatCard label="AutoPilot" value="+$340" delta="3 slots filled" deltaColor={t.accentText} />
          </div>
          <div style={{ display: "flex", gap: 8, paddingBottom: 16 }}>
            <StatCard label="Booked today" value="14/18" delta="78% capacity" deltaColor={t.accentText} />
            <StatCard label="Avg ticket" value="$119" delta="↑ +$8 vs last wk" deltaColor={t.greenText} />
          </div>
        </div>

        <div style={{ padding: "0 16px" }}>
          {/* Needs your eyes */}
          <div style={{ paddingTop: 18, paddingBottom: 4 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.4, color: t.muted, marginBottom: 12, fontFamily: ebf }}>NEEDS YOUR EYES</div>
            <div style={{ padding: "13px 14px", borderRadius: 13, background: t.card, border: `1px solid ${t.border}`, marginBottom: 8 }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#DC2626", marginTop: 5, flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: t.text, marginBottom: 3, fontFamily: ebf }}>Marcus's rebook rate dropped</div>
                  <div style={{ fontSize: 12, color: t.sub, lineHeight: 1.5, fontFamily: ebf }}>52% this week vs 78% avg. Three regulars haven't come back. Worth a 1:1.</div>
                </div>
              </div>
            </div>
            <div style={{ padding: "13px 14px", borderRadius: 13, background: t.card, border: `1px solid ${t.border}`, marginBottom: 18 }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#D97706", marginTop: 5, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: t.text, marginBottom: 3, fontFamily: ebf }}>Lisa hasn't been back in 67 days</div>
                  <div style={{ fontSize: 12, color: t.sub, lineHeight: 1.5, marginBottom: 10, fontFamily: ebf }}>VIP · $4.2k LTV. AutoPilot win-back drafted.</div>
                  <div style={{ display: "flex", gap: 8 }}>
                    {winBackSent === true
                      ? <div style={{ padding: "7px 14px", borderRadius: 9, background: t.greenBg, color: t.greenText, fontSize: 12, fontWeight: 700, fontFamily: ebf }}>✓ Win-back sent to Lisa</div>
                      : <>
                          <button
                            onClick={async () => {
                              if (winBackSent) return;
                              setWinBackSent("sending");
                              try {
                                const res = await fetch("/api/ai/winback/generate", {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json", "Authorization": `Bearer ${localStorage.getItem("access_token") || ""}` },
                                  body: JSON.stringify({
                                    client_id: "00000000-0000-0000-0000-000000000000",
                                    client_name: LISA_BRIEF.name,
                                    last_service: LISA_BRIEF.lastService,
                                    days_since: LISA_BRIEF.daysSince,
                                    ltv: LISA_BRIEF.ltv,
                                  }),
                                });
                                const data = await res.json();
                                const msg = data.message_draft || "We'd love to see you back, Lisa!";
                                console.log("✅ Email Brief win-back generated:", msg);
                                await sendWinBackSMS(LISA_BRIEF.phone, msg);
                              } catch (err) {
                                console.error("Email Brief win-back failed:", err);
                              }
                              setWinBackSent(true);
                            }}
                            style={{ padding: "7px 14px", borderRadius: 9, background: winBackSent === "sending" ? t.inputBg : t.accent, color: winBackSent === "sending" ? t.muted : "#fff", border: "none", fontSize: 12, fontWeight: 700, cursor: winBackSent ? "default" : "pointer", fontFamily: ebf, transition: "all 0.2s" }}>
                            {winBackSent === "sending" ? "Generating…" : "Send win-back"}
                          </button>
                          <button style={{ padding: "7px 14px", borderRadius: 9, background: "transparent", color: t.text, border: `1px solid ${t.border}`, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: ebf }}>Skip</button>
                        </>
                    }
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* AutoPilot wins */}
          <div style={{ paddingBottom: 18 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.4, color: t.muted, marginBottom: 12, fontFamily: ebf }}>AUTOPILOT WINS · YESTERDAY</div>
            <div style={{ borderRadius: 13, background: t.card, border: `1px solid ${t.border}`, overflow: "hidden" }}>
              {[["Slots recovered", "+$340", t.greenText], ["Messages handled by AI", "12", t.accentText], ["Win-backs sent", "3", t.accentText], ["No-shows saved", "2", t.greenText]].map(([label, val, color], i, arr) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", borderBottom: i < arr.length - 1 ? `1px solid ${t.border}` : "none" }}>
                  <span style={{ fontSize: 13, color: t.sub, fontFamily: ebf }}>{label}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color, fontFamily: ebf }}>{val}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Family Hours streak */}
          <div style={{ paddingBottom: 24 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.4, color: t.muted, marginBottom: 12, fontFamily: ebf }}>FAMILY HOURS</div>
            <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px 18px", borderRadius: 14, background: t.greenBg, border: `1px solid ${t.green}20` }}>
              <div style={{ fontSize: 32 }}>🏠</div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.2, color: t.greenText, marginBottom: 3, fontFamily: ebf }}>STREAK</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: t.text, fontFamily: ebf }}>12 days</div>
                <div style={{ fontSize: 12, color: t.greenText, fontWeight: 600, fontFamily: ebf }}>Tonight 6–8 PM protected</div>
              </div>
            </div>
          </div>

          {/* CTA */}
          <div style={{ paddingBottom: 32 }}>
            <button onClick={() => { onClose(); }} style={{ width: "100%", padding: "16px 0", borderRadius: 14, background: `linear-gradient(135deg,#534AB7,#6D28D9)`, color: "#fff", border: "none", fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: ebf, marginBottom: 10 }}>Open full dashboard</button>
            <div style={{ textAlign: "center", fontSize: 12, color: t.dim, fontFamily: ebf }}>60-second read · AutoPilot is on</div>
          </div>
        </div>
      </div>

      {/* Close button overlaid at top-right */}
      <button onClick={onClose} style={{ position: "absolute", top: 52, right: 20, width: 32, height: 32, borderRadius: "50%", background: "rgba(83,74,183,0.12)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10 }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#534AB7" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// CSS
// ═══════════════════════════════════════════════════════════════════
const css = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700;9..40,800&family=Instrument+Sans:wght@400;500;600;700&display=swap');
  @keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
  @keyframes pulseRing{0%{transform:scale(1);opacity:0.6}100%{transform:scale(2.8);opacity:0}}
  @keyframes countUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
  @keyframes successPop{0%{opacity:0;transform:scale(0.6)}100%{opacity:1;transform:scale(1)}}
  @keyframes slideOverlay{from{opacity:0;transform:translateX(24px)}to{opacity:1;transform:translateX(0)}}
  @keyframes slideUp{from{opacity:0;transform:translateY(40px)}to{opacity:1;transform:translateY(0)}}
  *{-webkit-tap-highlight-color:transparent;box-sizing:border-box}
  ::-webkit-scrollbar{display:none}
  input,textarea{outline:none}
  input:focus,textarea:focus{border-color:#534AB7!important}
  h3{margin:0}p{margin:0}
`;

// ═══════════════════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════════════════
function FlatpurseApp({
  initialTab = "home",
  initialSetup = true,
  initialDailyBrief = null,
  initialOverlay = null,
  initialMode = "light",
} = {}) {
  const [mode, setMode] = useState(initialMode);
  const [tab, setTab] = useState(initialTab);
  const [isSetup, setIsSetup] = useState(initialSetup);
  const isOnline = useOnlineStatus();
  const [dailyBrief, setDailyBrief] = useState(initialDailyBrief);
  const [showClientBooking, setShowClientBooking] = useState(initialOverlay === "clientBooking");
  const [showNewAppointment, setShowNewAppointment] = useState(initialOverlay === "newAppointment");
  const [showAppointmentDetail, setShowAppointmentDetail] = useState(initialOverlay === "appointmentDetail");
  const [showCustomerDetail, setShowCustomerDetail] = useState(initialOverlay === "customerDetail");
  const [showNotifications, setShowNotifications] = useState(initialOverlay === "notifications");
  const [showSettings, setShowSettings] = useState(initialOverlay === "settings");
  const [showSettingsBusiness, setShowSettingsBusiness] = useState(initialOverlay === "business");
  const [showSettingsServices, setShowSettingsServices] = useState(initialOverlay === "services");
  const [showBookingPage, setShowBookingPage] = useState(initialOverlay === "bookingPage");
  const [showClientsList, setShowClientsList] = useState(false);
  const [selectedClient, setSelectedClient] = useState(null);
  const [showEmailBrief, setShowEmailBrief] = useState(initialOverlay === "emailBrief");
  const scrollRef = useRef(null);
  const t = T[mode];
  const urgentCount = showNotifications ? 0 : 2;

  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = 0; }, [tab]);

  const tabs = [
    { id: "home", label: "Home", icon: <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg> },
    { id: "bookings", label: "Bookings", icon: <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> },
    { id: "clients", label: "Clients", icon: <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="23" y1="11" x2="17" y2="11"/><line x1="20" y1="8" x2="20" y2="14"/></svg> },
    { id: "team", label: "Team", icon: <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg> },
    { id: "autopilot", label: "AutoPilot", icon: <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg> },
    { id: "operations", label: "Operations", icon: <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="6" height="6" rx="1"/><rect x="9" y="3" width="6" height="6" rx="1"/><rect x="16" y="3" width="6" height="6" rx="1"/><rect x="2" y="10" width="6" height="11" rx="1"/><rect x="9" y="10" width="13" height="5" rx="1"/><rect x="9" y="16" width="13" height="5" rx="1"/></svg> },
  ];

  const renderHeader = () => {
    if (tab === "clients") return (
      <div style={{ padding: "14px 4px 8px", display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <div style={{ fontSize: 26, fontWeight: 800, color: t.text, letterSpacing: -0.5 }}>Clients</div>
          <div style={{ fontSize: 13, color: t.sub, marginTop: 3 }}>{CLIENTS_DB.length} total · tap to view profile</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {/* Export CSV — your data, always */}
          <button
            onClick={() => {
              const headers = ["Name","Phone","Email","LTV","Visits","Avg Spend","Last Visit","Tags"];
              const rows = CLIENTS_DB.map(c => [c.name, c.phone, c.email, c.ltv, c.visits, c.avgSpend, c.lastVisit, (c.tags||[]).join("|")]);
              const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g,"'")}`).join(",")).join(String.fromCharCode(10));
              const blob = new Blob([csv], { type: "text/csv" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url; a.download = "flatpurse-clients.csv"; a.click();
              URL.revokeObjectURL(url);
            }}
            title="Export all clients — your data, always"
            style={{ width: 34, height: 34, borderRadius: 10, background: t.card, border: `1px solid ${t.border}`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={t.sub} strokeWidth="2.2" strokeLinecap="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
          </button>
          <button onClick={() => setShowNewAppointment(true)} style={{ width: 36, height: 36, borderRadius: 18, background: t.accent, border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          </button>
        </div>
      </div>
    );
    if (tab === "bookings") return (
      <div style={{ padding: "14px 4px 8px", display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <div style={{ fontSize: 26, fontWeight: 800, color: t.text, letterSpacing: -0.5 }}>Bookings</div>
          <div style={{ fontSize: 13, color: t.sub, marginTop: 3 }}>Wednesday, May 7</div>
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <button onClick={() => setTab("clients")} style={{ background: "none", border: "none", cursor: "pointer", padding: 4, display: "flex", alignItems: "center" }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={t.text} strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          </button>
          <button onClick={() => setShowNewAppointment(true)} style={{ width: 34, height: 34, borderRadius: 17, background: t.accent, border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          </button>
        </div>
      </div>
    );
    if (tab === "operations") return (
      <div style={{ padding: "14px 4px 8px", display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <div style={{ fontSize: 26, fontWeight: 800, color: t.text, letterSpacing: -0.5 }}>Operations</div>
          <div style={{ fontSize: 12, color: t.muted, fontStyle: "italic", marginTop: 3 }}>Run smarter. Waste less. Profit more.</div>
        </div>
        <div style={{ position: "relative" }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={t.text} strokeWidth="2" strokeLinecap="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
          <div style={{ position: "absolute", top: -2, right: -2, width: 7, height: 7, borderRadius: 4, background: t.orange }} />
        </div>
      </div>
    );
    if (tab === "team" || tab === "autopilot") return (
      <div style={{ padding: "14px 4px 8px" }}>
        <div style={{ fontSize: 26, fontWeight: 800, color: t.text, letterSpacing: -0.5 }}>{tab === "team" ? "Team" : "AutoPilot"}</div>
        <div style={{ fontSize: 13, color: t.sub, marginTop: 3 }}>
          {tab === "team" ? (isSetup ? "Just you for now" : "4 members") : (isSetup ? "Waiting for setup" : "All 6 flows running · 24/7")}
        </div>
      </div>
    );
    // Home header — logo + controls in date row + bell + three-dot + GO
    return (
      <div style={{ padding: "14px 4px 8px" }}>
        {/* Row 1: Logo mark + wordmark */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            {/* FlatPurse Flow logo mark — unique gradient id per instance */}
            <FlatpurseLogo size={44} />
            <div style={{ lineHeight: 1.15 }}>
              <div style={{ fontSize: 17, fontWeight: 700, color: t.text, letterSpacing: -0.3 }}>FlatPurse</div>
              <div style={{ fontSize: 17, fontWeight: 700, color: t.text, letterSpacing: -0.3 }}>Flow</div>
            </div>
          </div>

          {/* Right: bell + three-dot + GO */}
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div onClick={() => setShowNotifications(true)} style={{ cursor: "pointer", position: "relative" }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={t.text} strokeWidth="2" strokeLinecap="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
              {urgentCount > 0 && (
                <div style={{ position: "absolute", top: -4, right: -5, minWidth: 16, height: 16, borderRadius: 8, background: "#EF4444", color: "#fff", fontSize: 9, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 4px" }}>{urgentCount}</div>
              )}
            </div>
            <button onClick={() => setShowSettings(true)} style={{ background: "none", border: "none", cursor: "pointer", padding: 2, display: "flex", alignItems: "center" }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={t.text} strokeWidth="2" strokeLinecap="round">
                <circle cx="12" cy="5" r="1.2" fill={t.text}/><circle cx="12" cy="12" r="1.2" fill={t.text}/><circle cx="12" cy="19" r="1.2" fill={t.text}/>
              </svg>
            </button>
            <div onClick={() => setDailyBrief("lock")} style={{ width: 34, height: 34, borderRadius: 17, background: t.accent, color: "#fff", fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>GO</div>
          </div>
        </div>

        {/* Row 2: Date + demo controls inline */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 13, color: t.sub, flex: 1 }}>Wed, May 7</span>
          {/* Dark/light toggle — lives beside the date */}
          <div onClick={() => setMode(mode === "dark" ? "light" : "dark")} style={{ width: 42, height: 22, borderRadius: 11, background: mode === "dark" ? "#334155" : t.inputBg, border: `1px solid ${t.border}`, position: "relative", cursor: "pointer", transition: "background 0.25s", flexShrink: 0 }}>
            <div style={{ width: 18, height: 18, borderRadius: 9, position: "absolute", top: 1, left: mode === "dark" ? 21 : 1, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, background: t.card, boxShadow: "0 1px 3px rgba(0,0,0,0.15)", transition: "left 0.25s" }}>
              {mode === "dark" ? "🌙" : "☀️"}
            </div>
          </div>
          {/* Empty/Live pill — lives beside the date */}
          <button onClick={() => setIsSetup(!isSetup)} style={{ padding: "3px 9px", borderRadius: 20, fontSize: 10, fontWeight: 700, border: `1px solid ${isSetup ? t.border : t.accent + "50"}`, cursor: "pointer", fontFamily: f, background: isSetup ? t.inputBg : t.accentSoft, color: isSetup ? t.muted : t.accentText, transition: "all 0.2s" }}>
            {isSetup ? "Empty" : "● Live"}
          </button>
        </div>
      </div>
    );
  };

  const renderContent = () => {
    switch (tab) {
      case "home": return isSetup ? <HomeEmpty t={t} /> : <HomePopulated t={t} />;
      case "bookings": return (
        <BookingsScreen
          t={t}
          isSetup={isSetup}
          onPreviewBooking={() => setShowBookingPage(true)}
          onNewAppointment={() => setShowNewAppointment(true)}
          onViewAppointment={() => setShowAppointmentDetail(true)}
          onViewClient={(clientName) => { const c = CLIENTS_DB.find(x => x.name === clientName) || CLIENTS_DB[0]; setSelectedClient(c); setShowCustomerDetail(true); }}
        />
      );
      case "clients": return (
        <ClientsScreen t={t} onSelectClient={(client) => { setSelectedClient(client); setShowCustomerDetail(true); }} />
      );
      case "team": return <TeamScreen t={t} isSetup={isSetup} />;
      case "autopilot": return <AutoPilotScreen t={t} isSetup={isSetup} />;
      case "operations": return <OperationsScreen t={t} />;
      default: return null;
    }
  };

  return (
    <div style={{ width: 390, height: 844, margin: "0 auto", fontFamily: f, display: "flex", flexDirection: "column", overflow: "hidden", borderRadius: 44, position: "relative", background: t.bg, border: `3px solid ${t.deviceBorder}`, boxShadow: "0 20px 80px rgba(0,0,0,0.08)", transition: "background 0.3s" }}>
      <style>{css}</style>

      {/* Settings sub-screens */}
      {showSettingsBusiness && <BusinessProfileScreen t={t} onClose={() => setShowSettingsBusiness(false)} />}
      {showSettingsServices && <ServicesPricingScreen t={t} onClose={() => setShowSettingsServices(false)} />}
      {showSettings && <SettingsHubScreen t={t} onClose={() => setShowSettings(false)} onOpenBusiness={() => setShowSettingsBusiness(true)} onOpenServices={() => setShowSettingsServices(true)} />}

      {/* App overlays */}
      {dailyBrief === "lock" && <LockScreen onTap={() => setDailyBrief("email")} />}
      {dailyBrief === "email" && <EmailBriefScreen t={t} onClose={() => { setDailyBrief(null); setTab("home"); setIsSetup(false); }} />}
      {dailyBrief === "open" && <DailyBrief t={t} onClose={() => setDailyBrief(null)} onOpenDashboard={() => { setDailyBrief(null); setTab("home"); setIsSetup(false); }} />}
      {showClientBooking && <ClientBookingFlow t={t} onClose={() => setShowClientBooking(false)} />}
      {showBookingPage && <BookingPage onClose={() => setShowBookingPage(false)} />}
      {showEmailBrief && <EmailBriefScreen t={t} onClose={() => { setShowEmailBrief(false); setDailyBrief(null); setTab("home"); setIsSetup(false); }} />}
      {showNewAppointment && (
        <NewAppointmentOverlay t={t} onClose={() => setShowNewAppointment(false)} onSave={() => { setShowNewAppointment(false); setIsSetup(false); setTimeout(() => setShowAppointmentDetail(true), 300); }} />
      )}
      {showAppointmentDetail && <AppointmentDetail t={t} onClose={() => setShowAppointmentDetail(false)} />}
      {showNotifications && <NotificationsScreen t={t} onClose={() => setShowNotifications(false)} />}
      {showCustomerDetail && <CustomerDetailScreen t={t} client={selectedClient} onClose={() => { setShowCustomerDetail(false); setSelectedClient(null); }} onBook={() => { setShowCustomerDetail(false); setSelectedClient(null); setShowNewAppointment(true); }} />}



      {/* Status bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 28px 0", height: 22, flexShrink: 0 }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: t.statusBar, letterSpacing: 0.3 }}>9:42 AM</span>
        <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
          <svg width="15" height="11" viewBox="0 0 15 11" fill={t.statusBar}><path d="M0 7.5h2.5V11H0zM4 5h2.5v6H4zM8 3h2.5v8H8zM12 0h2.5v11H12z"/></svg>
          <svg width="16" height="11" viewBox="0 0 16 11" fill="none" stroke={t.statusBar} strokeWidth="1"><rect x=".5" y=".5" width="13" height="10" rx="2"/><rect x="2" y="2" width="7" height="7" rx="1" fill={t.statusBar}/><path d="M14.5 3.5v4" strokeWidth="1.5" strokeLinecap="round"/></svg>
        </div>
      </div>

      {/* Page header */}
      <div style={{ padding: "0 20px", flexShrink: 0 }}>{renderHeader()}</div>

      {/* Main scroll area */}
      {!isOnline && (
        <div style={{ background: "#FEF3C7", borderBottom: "1px solid #F59E0B", padding: "9px 20px", display: "flex", alignItems: "center", gap: 8, flexShrink: 0, zIndex: 50 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2.5" strokeLinecap="round"><path d="M1 1l22 22M16.72 11.06A10.94 10.94 0 0 1 19 12.55M5 12.55a10.94 10.94 0 0 1 5.17-2.39M10.71 5.05A16 16 0 0 1 22.56 9M1.42 9a15.91 15.91 0 0 1 4.7-2.88M8.53 16.11a6 6 0 0 1 6.95 0M12 20h.01"/></svg>
          <span style={{ fontSize: 12, fontWeight: 700, color: "#D97706" }}>Offline mode — changes sync when connection restores</span>
        </div>
      )}
      <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", overflowX: "hidden", WebkitOverflowScrolling: "touch" }}>
        {renderContent()}
      </div>

      {/* Bottom nav */}
      <div style={{ display: "flex", justifyContent: "space-around", alignItems: "center", padding: "6px 4px 2px", borderTop: `1px solid ${t.navBorder}`, flexShrink: 0, background: t.navBg, transition: "all 0.3s" }}>
        {tabs.map((tb) => {
          const active = tab === tb.id;
          return (
            <button key={tb.id} onClick={() => setTab(tb.id)} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, background: "none", border: "none", cursor: "pointer", padding: "4px 8px", color: active ? t.accent : t.muted, fontFamily: f, transition: "color 0.2s" }}>
              {tb.icon}
              <span style={{ fontSize: 9, fontWeight: active ? 700 : 500, letterSpacing: 0.2 }}>{tb.label}</span>
            </button>
          );
        })}
      </div>
      <div style={{ display: "flex", justifyContent: "center", padding: "3px 0 8px", background: t.navBg }}>
        <div style={{ width: 134, height: 5, borderRadius: 3, background: t.border }} />
      </div>
    </div>
  );
}



// ═══════════════════════════════════════════════════════════════════
// FLATPURSE ONBOARDING
// ═══════════════════════════════════════════════════════════════════


// ── Brand tokens (match FlatpurseApp exactly) ──────────────────────
const ACCENT  = "#534AB7";
const ACCENT2 = "#D93080";
const ACCENT3 = "#FF4500";

// ── Gradient logo (unique ID per instance) ─────────────────────────
let _gc = 0;
function Logo({ size = 48, light = false }) {
  const id = useRef("ob" + (++_gc)).current;
  const h  = Math.round(size * 80 / 110);
  const c  = light ? "#fff" : `url(#${id})`;
  return (
    <svg width={size} height={h} viewBox="0 0 110 80" fill="none">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="110" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor="#8B30FF"/>
          <stop offset="50%"  stopColor="#D93080"/>
          <stop offset="100%" stopColor="#FF4500"/>
        </linearGradient>
      </defs>
      <path d="M58 6 L28 6 Q6 6 6 40 Q6 74 28 74 L58 74"        stroke={c} strokeWidth="9" strokeLinecap="round" strokeLinejoin="round"/>
      <line x1="66" y1="6" x2="66" y2="74"                      stroke={c} strokeWidth="9" strokeLinecap="round"/>
      <path d="M66 6 L88 6 Q104 6 104 22 L104 34 Q104 40 88 40 L66 40"  stroke={c} strokeWidth="9" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M66 40 L88 40 Q104 40 104 54 L104 62 Q104 74 88 74 L66 74" stroke={c} strokeWidth="9" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

// ── Shared primitives ──────────────────────────────────────────────
const Input = ({ label, type = "text", value, onChange, placeholder, prefix, suffix, error, hint }) => (
  <div style={{ marginBottom: 16 }}>
    {label && <div style={{ fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 6, letterSpacing: 0.3 }}>{label}</div>}
    <div style={{ display: "flex", alignItems: "center", borderRadius: 12, border: `1.5px solid ${error ? "#EF4444" : "#E2E0FB"}`, background: "#FAFAFE", overflow: "hidden", transition: "border-color 0.18s" }}>
      {prefix && <div style={{ padding: "0 12px", fontSize: 14, color: "#94A3B8", borderRight: "1px solid #E2E0FB", height: "100%", display: "flex", alignItems: "center", background: "#F3F1FF" }}>{prefix}</div>}
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        style={{ flex: 1, padding: "10px 12px", background: "transparent", border: "none", outline: "none", fontSize: 15, color: "#1E293B", fontFamily: f }}
      />
      {suffix && <div style={{ padding: "0 12px", color: "#94A3B8", fontSize: 13 }}>{suffix}</div>}
    </div>
    {error  && <div style={{ fontSize: 12, color: "#EF4444", marginTop: 5 }}>⚠ {error}</div>}
    {hint   && !error && <div style={{ fontSize: 12, color: "#94A3B8", marginTop: 5 }}>{hint}</div>}
  </div>
);

const Btn = ({ children, onClick, disabled, variant = "primary", small = false }) => {
  const styles = {
    primary:   { background: `linear-gradient(135deg,${ACCENT},#6D28D9)`, color: "#fff", border: "none" },
    secondary: { background: "#F3F1FF", color: ACCENT, border: `1.5px solid ${ACCENT}20` },
    ghost:     { background: "transparent", color: "#64748B", border: "1.5px solid #E2E0FB" },
    danger:    { background: "#FEF2F2", color: "#EF4444", border: "1.5px solid #FECACA" },
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        ...styles[variant],
        width: small ? "auto" : "100%",
        padding: small ? "8px 18px" : "15px 0",
        borderRadius: 12,
        fontSize: small ? 13 : 15,
        fontWeight: 700,
        cursor: disabled ? "default" : "pointer",
        fontFamily: f,
        opacity: disabled ? 0.45 : 1,
        transition: "all 0.18s",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        boxShadow: variant === "primary" && !disabled ? "0 4px 20px rgba(83,74,183,0.28)" : "none",
      }}
    >{children}</button>
  );
};

const ProgressBar = ({ step, total }) => (
  <div style={{ display: "flex", gap: 5, padding: "0 24px 0" }}>
    {Array.from({ length: total }).map((_, i) => (
      <div key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: i < step ? ACCENT : "#E2E0FB", transition: "background 0.35s" }} />
    ))}
  </div>
);

// ── Step components ───────────────────────────────────────────────

// 0 — Welcome / splash
function StepWelcome({ onNext }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => { const t = setTimeout(() => setVisible(true), 80); return () => clearTimeout(t); }, []);

  const items = [
    { emoji: "📅", text: "Smart booking that fills your calendar" },
    { emoji: "⚡", text: "AutoPilot recovers revenue while you sleep" },
    { emoji: "💳", text: "Payments, tips & payouts — all in one place" },
    { emoji: "✦",  text: "AI insights on every client, every visit" },
  ];

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "0 16px 16px" }}>
      {/* Hero */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", paddingTop: 20 }}>
        {/* Glowing orb behind logo */}
        <div style={{ position: "relative", marginBottom: 24 }}>
          <div style={{ width: 120, height: 120, borderRadius: "50%", background: "radial-gradient(circle,rgba(83,74,183,0.18) 0%,rgba(217,48,128,0.08) 60%,transparent 80%)", position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)" }} />
          <div style={{
            opacity: visible ? 1 : 0,
            transform: visible ? "scale(1) translateY(0)" : "scale(0.7) translateY(10px)",
            transition: "all 0.65s cubic-bezier(0.34,1.56,0.64,1)",
          }}>
            <Logo size={80} />
          </div>
        </div>

        <div style={{
          opacity: visible ? 1 : 0,
          transform: visible ? "translateY(0)" : "translateY(16px)",
          transition: "all 0.55s ease 0.15s",
        }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#1E293B", letterSpacing: -0.6, marginBottom: 3, lineHeight: 1.15 }}>
            Welcome to<br/>
            <span style={{ background: `linear-gradient(135deg,${ACCENT},${ACCENT2})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>FlatPurse Flow</span>
          </div>
          <div style={{ fontSize: 13, color: "#64748B", lineHeight: 1.6, marginTop: 6, maxWidth: 270 }}>
            The AI revenue autopilot built for salons & barbershops.
          </div>
        </div>

        {/* Feature pills */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 14, width: "100%", maxWidth: 310 }}>
          {items.map((item, i) => (
            <div key={i} style={{
              display: "flex", alignItems: "center", gap: 9,
              padding: "8px 12px", borderRadius: 11,
              background: "#fff", border: "1px solid #EDEAFE",
              boxShadow: "0 1px 4px rgba(83,74,183,0.06)",
              opacity: visible ? 1 : 0,
              transform: visible ? "translateX(0)" : "translateX(20px)",
              transition: `all 0.5s ease ${0.25 + i * 0.08}s`,
            }}>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: "#F3F1FF", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>{item.emoji}</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#334155" }}>{item.text}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <Btn onClick={onNext}>Get started — it's free →</Btn>
        <div style={{ textAlign: "center", fontSize: 12, color: "#94A3B8" }}>
          No credit card required · Setup in 3 minutes
        </div>
      </div>
    </div>
  );
}

// 1 — Account creation
function StepAccount({ onNext, data, setData }) {
  const [errors, setErrors] = useState({});

  const validate = () => {
    const e = {};
    if (!data.firstName?.trim()) e.firstName = "Required";
    if (!data.lastName?.trim())  e.lastName  = "Required";
    if (!data.email?.includes("@")) e.email  = "Valid email required";
    if ((data.password || "").length < 8) e.password = "At least 8 characters";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "0 16px 16px" }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: "#1E293B", letterSpacing: -0.4, marginBottom: 4 }}>Create your account</div>
        <div style={{ fontSize: 13, color: "#64748B" }}>You're the owner — let's start with your details.</div>
      </div>

      <div style={{ flex: 1 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 0 }}>
          <Input label="First name" value={data.firstName || ""} onChange={e => setData({ ...data, firstName: e.target.value })} placeholder="George" error={errors.firstName} />
          <Input label="Last name"  value={data.lastName  || ""} onChange={e => setData({ ...data, lastName:  e.target.value })} placeholder="Osei"   error={errors.lastName} />
        </div>
        <Input label="Email address" type="email" value={data.email || ""} onChange={e => setData({ ...data, email: e.target.value })} placeholder="george@stridecuts.com" error={errors.email} />
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 6, letterSpacing: 0.3 }}>Password</div>
          <div style={{ display: "flex", alignItems: "center", borderRadius: 12, border: `1.5px solid ${errors.password ? "#EF4444" : "#E2E0FB"}`, background: "#FAFAFE", overflow: "hidden" }}>
            <input type="password" value={data.password || ""} onChange={e => setData({ ...data, password: e.target.value })} placeholder="8+ characters"
              style={{ flex: 1, padding: "10px 12px", background: "transparent", border: "none", outline: "none", fontSize: 15, color: "#1E293B", fontFamily: f }} />
          </div>
          {errors.password && <div style={{ fontSize: 12, color: "#EF4444", marginTop: 5 }}>⚠ {errors.password}</div>}
          {/* Password strength bar */}
          {(data.password || "").length > 0 && (() => {
            const pwd = data.password || "";
            const score = [pwd.length >= 8, /[A-Z]/.test(pwd), /[0-9]/.test(pwd), /[^A-Za-z0-9]/.test(pwd)].filter(Boolean).length;
            const labels = ["Too short","Weak","Fair","Strong","Very strong"];
            const colors = ["#EF4444","#F97316","#F59E0B","#22C55E","#16A34A"];
            return (
              <div style={{ marginTop: 8 }}>
                <div style={{ display: "flex", gap: 4, marginBottom: 4 }}>
                  {[1,2,3,4].map(i => (
                    <div key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: i <= score ? colors[score] : "#E2E0FB", transition: "background 0.25s" }} />
                  ))}
                </div>
                <div style={{ fontSize: 11, color: colors[score], fontWeight: 600 }}>{labels[score]}</div>
              </div>
            );
          })()}
          {!(data.password || "").length && <div style={{ fontSize: 12, color: "#94A3B8", marginTop: 5 }}>Your data is encrypted and never shared.</div>}
        </div>
        <Input label="Phone number" type="tel" value={data.phone || ""} onChange={e => setData({ ...data, phone: e.target.value })} placeholder="+1 587 000 0000" prefix="📱" />

        {/* Social sign-in */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "16px 0" }}>
          <div style={{ flex: 1, height: 1, background: "#EDE9E4" }} />
          <span style={{ fontSize: 12, color: "#94A3B8", whiteSpace: "nowrap" }}>or sign in with</span>
          <div style={{ flex: 1, height: 1, background: "#EDE9E4" }} />
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          {[["🍎", "Apple"], ["G", "Google"]].map(([icon, label]) => (
            <button key={label} style={{ flex: 1, padding: "11px 0", borderRadius: 11, border: "1.5px solid #E2E0FB", background: "#FAFAFE", cursor: "pointer", fontFamily: f, fontSize: 13, fontWeight: 700, color: "#334155", display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
              <span style={{ fontSize: label === "Google" ? 13 : 15, fontWeight: 900 }}>{icon}</span>{label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ paddingTop: 16 }}>
        <Btn onClick={() => validate() && onNext()}>Continue →</Btn>
        <div style={{ textAlign: "center", fontSize: 12, color: "#94A3B8", marginTop: 10 }}>
          By continuing you agree to our <span style={{ color: ACCENT, textDecoration: "underline", cursor: "pointer" }}>Terms</span> & <span style={{ color: ACCENT, textDecoration: "underline", cursor: "pointer" }}>Privacy Policy</span>
        </div>
      </div>
    </div>
  );
}

// 2 — Business profile
function StepBusiness({ onNext, data, setData }) {
  const types = [
    { id: "barbershop", emoji: "✂️",  label: "Barbershop"    },
    { id: "salon",      emoji: "💇",  label: "Hair salon"    },
    { id: "beauty",     emoji: "💅",  label: "Beauty studio" },
    { id: "spa",        emoji: "🧖",  label: "Spa & wellness"},
    { id: "nail",       emoji: "💆",  label: "Nail salon"    },
    { id: "other",      emoji: "🏠",  label: "Other"         },
  ];

  const valid = data.bizName?.trim() && data.bizType && data.city?.trim();

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "0 16px 16px" }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: "#1E293B", letterSpacing: -0.4, marginBottom: 4 }}>Tell us about your shop</div>
        <div style={{ fontSize: 13, color: "#64748B" }}>This powers your booking page and AutoPilot settings.</div>
      </div>

      <div style={{ flex: 1 }}>
        <Input label="Business name" value={data.bizName || ""} onChange={e => setData({ ...data, bizName: e.target.value })} placeholder="Stride Cuts" />
        <Input label="City" value={data.city || ""} onChange={e => setData({ ...data, city: e.target.value })} placeholder="Edmonton, AB" />

        <div style={{ fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 10, letterSpacing: 0.3 }}>Business type</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 16 }}>
          {types.map(type => {
            const on = data.bizType === type.id;
            return (
              <button key={type.id} onClick={() => setData({ ...data, bizType: type.id })} style={{ padding: "9px 4px 8px", borderRadius: 10, border: `${on ? 2 : 1.5}px solid ${on ? ACCENT : "#E2E0FB"}`, background: on ? "#F3F1FF" : "#FAFAFE", cursor: "pointer", fontFamily: f, display: "flex", flexDirection: "column", alignItems: "center", gap: 5, transition: "all 0.15s" }}>
                <span style={{ fontSize: 22 }}>{type.emoji}</span>
                <span style={{ fontSize: 11, fontWeight: on ? 700 : 500, color: on ? ACCENT : "#64748B", textAlign: "center", lineHeight: 1.3 }}>{type.label}</span>
              </button>
            );
          })}
        </div>

        <Input label="How many staff (including you)?" type="number" value={data.staffCount || ""} onChange={e => setData({ ...data, staffCount: e.target.value })} placeholder="e.g. 4" hint="You can add team members later." />
      </div>

      <Btn onClick={onNext} disabled={!valid}>Continue →</Btn>
    </div>
  );
}

// 3 — Booking link setup
function StepBookingLink({ onNext, data, setData }) {
  const [checking, setChecking] = useState(false);
  const [available, setAvailable] = useState(null);
  const slug = (data.bizName || "").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 20);

  const [handle, setHandle] = useState(data.bookingHandle || slug || "");

  const check = () => {
    setChecking(true);
    setAvailable(null);
    setTimeout(() => {
      setAvailable(handle.length >= 3);
      setChecking(false);
    }, 900);
  };

  useEffect(() => {
    if (slug && !data.bookingHandle) setHandle(slug);
  }, [slug]);

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "0 16px 16px" }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: "#1E293B", letterSpacing: -0.4, marginBottom: 4 }}>Your booking link</div>
        <div style={{ fontSize: 14, color: "#64748B" }}>Clients tap this to book with you instantly — share it everywhere.</div>
      </div>

      <div style={{ flex: 1 }}>
        {/* Link preview card */}
        <div style={{ padding: "13px 14px", borderRadius: 16, background: "linear-gradient(135deg,#1E1B4B,#312E81)", marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.5)", letterSpacing: 1.2, marginBottom: 8 }}>YOUR BOOKING LINK</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#fff", wordBreak: "break-all" }}>
            flatpurse.app/<span style={{ color: "#C4B5FD" }}>{handle || "yourshop"}</span>
          </div>
          <div style={{ marginTop: 10, fontSize: 12, color: "rgba(255,255,255,0.45)" }}>Share on Instagram · SMS blast · Email signature</div>
        </div>

        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 6, letterSpacing: 0.3 }}>Choose your handle</div>
          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ flex: 1, display: "flex", alignItems: "center", borderRadius: 12, border: `1.5px solid ${available === false ? "#EF4444" : available ? "#22C55E" : "#E2E0FB"}`, background: "#FAFAFE", overflow: "hidden", transition: "border-color 0.2s" }}>
              <div style={{ padding: "13px 10px 13px 14px", fontSize: 14, color: "#94A3B8", whiteSpace: "nowrap" }}>flatpurse.app/</div>
              <input value={handle} onChange={e => { setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g,"")); setAvailable(null); }} placeholder="yourshop" style={{ flex: 1, padding: "13px 14px 13px 0", background: "transparent", border: "none", outline: "none", fontSize: 15, color: "#1E293B", fontFamily: f }} />
            </div>
            <button onClick={check} style={{ padding: "0 16px", borderRadius: 12, background: ACCENT, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 700, color: "#fff", fontFamily: f, whiteSpace: "nowrap" }}>
              {checking ? "…" : "Check"}
            </button>
          </div>
          {available === true  && <div style={{ fontSize: 12, color: "#16A34A", marginTop: 6 }}>✓ Available — this link is yours!</div>}
          {available === false && <div style={{ fontSize: 12, color: "#EF4444", marginTop: 6 }}>⚠ Too short — use at least 3 characters</div>}
        </div>

        {/* What the page will look like */}
        <div style={{ padding: "14px 16px", borderRadius: 13, background: "#F3F1FF", border: "1.5px solid #E2E0FB", marginTop: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: ACCENT, letterSpacing: 1.2, marginBottom: 8 }}>WHAT CLIENTS WILL SEE</div>
          {["Your shop name, photos & reviews", "Service menu with prices", "Available barbers & times", "Secure Stripe payment at booking"].map((item, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: i < 3 ? 7 : 0 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={ACCENT} strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
              <span style={{ fontSize: 13, color: "#334155" }}>{item}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ paddingTop: 16 }}>
        <Btn onClick={() => { setData({ ...data, bookingHandle: handle }); onNext(); }} disabled={handle.length < 3}>
          Claim this link →
        </Btn>
        <button onClick={onNext} style={{ width: "100%", marginTop: 10, padding: "10px 0", background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "#94A3B8", fontFamily: f }}>
          I'll do this later
        </button>
      </div>
    </div>
  );
}

// 4 — Services setup
function StepServices({ onNext, data, setData }) {
  const defaults = [
    { id: "cut",   emoji: "✂️", name: "Signature Cut",     price: 45, duration: 45, on: true  },
    { id: "beard", emoji: "🪒", name: "Cut + Beard",        price: 65, duration: 60, on: true  },
    { id: "kids",  emoji: "🧒", name: "Kids Cut",           price: 30, duration: 30, on: false },
    { id: "shave", emoji: "🏆", name: "Hot Towel Shave",    price: 55, duration: 45, on: false },
    { id: "color", emoji: "🎨", name: "Colour / Balayage",  price: 150,duration: 120,on: false },
    { id: "treat", emoji: "✨", name: "Treatment / Mask",   price: 40, duration: 30, on: false },
  ];

  const [services, setServices] = useState(data.services || defaults);
  const [customSvc, setCustomSvc] = useState("");

  const addCustom = () => {
    if (!customSvc.trim()) return;
    const newSvc = { id: "custom_" + Date.now(), emoji: "✨", name: customSvc.trim(), price: 50, duration: 30, on: true };
    setServices(s => [...s, newSvc]);
    setCustomSvc("");
  };

  const toggle = (id) => setServices(s => s.map(svc => svc.id === id ? { ...svc, on: !svc.on } : svc));
  const updatePrice = (id, price) => setServices(s => s.map(svc => svc.id === id ? { ...svc, price } : svc));

  const selected = services.filter(s => s.on);

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "0 16px 16px" }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: "#1E293B", letterSpacing: -0.4, marginBottom: 4 }}>Your services & prices</div>
        <div style={{ fontSize: 13, color: "#64748B" }}>Select what you offer. Edit prices now or later.</div>
      </div>

      <div style={{ flex: 1, overflowY: "auto" }}>
        {services.map((svc) => (
          <div key={svc.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: 14, background: svc.on ? "#F3F1FF" : "#fff", border: `${svc.on ? 2 : 1.5}px solid ${svc.on ? ACCENT+"40" : "#E2E0FB"}`, marginBottom: 8, transition: "all 0.15s" }}>
            {/* Toggle */}
            <div onClick={() => toggle(svc.id)} style={{ width: 44, height: 26, borderRadius: 13, background: svc.on ? ACCENT : "#E2E0FB", position: "relative", cursor: "pointer", flexShrink: 0, transition: "background 0.2s" }}>
              <div style={{ width: 20, height: 20, borderRadius: 10, background: "#fff", position: "absolute", top: 3, left: svc.on ? 21 : 3, transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.18)" }} />
            </div>
            <span style={{ fontSize: 20, flexShrink: 0 }}>{svc.emoji}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: svc.on ? "#1E293B" : "#94A3B8" }}>{svc.name}</div>
              <div style={{ fontSize: 11, color: "#94A3B8" }}>{svc.duration} min</div>
            </div>
            {svc.on && (
              <div style={{ display: "flex", alignItems: "center", gap: 2, border: "1.5px solid #E2E0FB", borderRadius: 8, overflow: "hidden", flexShrink: 0 }}>
                <span style={{ padding: "6px 8px", fontSize: 13, color: "#94A3B8", background: "#FAFAFE" }}>$</span>
                <input
                  type="number"
                  value={svc.price}
                  onChange={e => updatePrice(svc.id, e.target.value)}
                  style={{ width: 52, padding: "6px 8px 6px 4px", border: "none", outline: "none", fontSize: 14, fontWeight: 700, color: "#1E293B", fontFamily: f, background: "#FAFAFE" }}
                />
              </div>
            )}
          </div>
        ))}

        {/* Custom service add */}
        <div style={{ display: "flex", gap: 8, marginTop: 4, marginBottom: 4 }}>
          <input
            value={customSvc}
            onChange={e => setCustomSvc(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && customSvc.trim()) addCustom(); }}
            placeholder="Add a custom service…"
            style={{ flex: 1, padding: "11px 14px", borderRadius: 12, border: "1.5px dashed #C7D2FE", background: "#FAFAFE", outline: "none", fontSize: 13, color: "#1E293B", fontFamily: f }}
          />
          <button onClick={addCustom} disabled={!customSvc.trim()} style={{ padding: "11px 16px", borderRadius: 12, background: customSvc.trim() ? ACCENT : "#E2E0FB", border: "none", cursor: customSvc.trim() ? "pointer" : "default", fontSize: 13, fontWeight: 700, color: customSvc.trim() ? "#fff" : "#94A3B8", fontFamily: f, transition: "all 0.15s" }}>Add</button>
        </div>

        {selected.length > 0 && (
          <div style={{ padding: "12px 16px", borderRadius: 12, background: "#DCFCE7", border: "1px solid #BBF7D0", marginTop: 4 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#16A34A" }}>
              {selected.length} service{selected.length !== 1 ? "s" : ""} selected · avg ${Math.round(selected.reduce((s,v) => s + Number(v.price), 0) / selected.length)} per booking
            </div>
          </div>
        )}
      </div>

      <div style={{ paddingTop: 16 }}>
        <Btn onClick={() => { setData({ ...data, services }); onNext(); }} disabled={selected.length === 0}>
          Continue with {selected.length} service{selected.length !== 1 ? "s" : ""} →
        </Btn>
        <button onClick={onNext} style={{ width: "100%", marginTop: 10, padding: "10px 0", background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "#94A3B8", fontFamily: f }}>
          Skip for now
        </button>
      </div>
    </div>
  );
}

// 5 — Team / staff setup
function StepTeam({ onNext, data, setData }) {
  const [members, setMembers] = useState(data.team || [
    { id: 1, name: "", role: "stylist", initials: "", color: "#534AB7" },
  ]);
  const [newName, setNewName] = useState("");

  const colors = ["#534AB7","#DB2777","#0891B2","#16A34A","#D97706","#9333EA"];
  const roles  = ["stylist","barber","colorist","nail tech","esthetician","owner"];

  const addMember = () => {
    if (!newName.trim()) return;
    const initials = newName.trim().split(" ").map(w=>w[0]).join("").toUpperCase().slice(0,2);
    setMembers(m => [...m, { id: Date.now(), name: newName.trim(), role: "stylist", initials, color: colors[m.length % colors.length] }]);
    setNewName("");
  };

  const remove = (id) => setMembers(m => m.filter(x => x.id !== id));
  const update = (id, field, val) => setMembers(m => m.map(x => x.id === id ? { ...x, [field]: val } : x));

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "0 16px 16px" }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: "#1E293B", letterSpacing: -0.4, marginBottom: 4 }}>Add your team</div>
        <div style={{ fontSize: 13, color: "#64748B" }}>Clients can choose who they book with. Add yourself too.</div>
      </div>

      <div style={{ flex: 1, overflowY: "auto" }}>
        {members.map((m, i) => (
          <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 11, background: "#fff", border: "1.5px solid #E2E0FB", marginBottom: 6 }}>
            <div style={{ width: 38, height: 38, borderRadius: 19, background: m.color, color: "#fff", fontSize: 13, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              {m.initials || "?"}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <input
                value={m.name}
                onChange={e => {
                  const name = e.target.value;
                  const initials = name.trim().split(" ").map(w=>w[0]).join("").toUpperCase().slice(0,2);
                  update(m.id, "name", name);
                  update(m.id, "initials", initials);
                }}
                placeholder="Staff name"
                style={{ width: "100%", background: "none", border: "none", outline: "none", fontSize: 14, fontWeight: 700, color: "#1E293B", fontFamily: f, marginBottom: 3 }}
              />
              <select value={m.role} onChange={e => update(m.id, "role", e.target.value)} style={{ background: "none", border: "none", outline: "none", fontSize: 12, color: "#64748B", fontFamily: f, cursor: "pointer" }}>
                {roles.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
              </select>
            </div>
            {members.length > 1 && (
              <button onClick={() => remove(m.id)} style={{ background: "#FFF1F2", border: "1px solid #FECACA", borderRadius: 8, padding: "4px 8px", cursor: "pointer", fontSize: 12, color: "#EF4444", fontFamily: f }}>✕</button>
            )}
          </div>
        ))}

        {/* Add new member */}
        <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
          <input
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === "Enter" && addMember()}
            placeholder="Add team member name…"
            style={{ flex: 1, padding: "11px 14px", borderRadius: 12, border: "1.5px dashed #C7D2FE", background: "#FAFAFE", outline: "none", fontSize: 14, color: "#1E293B", fontFamily: f }}
          />
          <button onClick={addMember} style={{ padding: "11px 16px", borderRadius: 12, background: ACCENT, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 700, color: "#fff", fontFamily: f }}>Add</button>
        </div>

        <div style={{ marginTop: 16, padding: "12px 16px", borderRadius: 12, background: "#F3F1FF", border: "1.5px solid #E2E0FB" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: ACCENT, marginBottom: 5 }}>✦ AutoPilot will track</div>
          <div style={{ fontSize: 12, color: "#64748B", lineHeight: 1.6 }}>Rebooking rates per staff · Revenue per stylist · Upsell performance · Schedule optimisation</div>
        </div>
      </div>

      <div style={{ paddingTop: 16 }}>
        <Btn onClick={() => { setData({ ...data, team: members }); onNext(); }}>
          Continue →
        </Btn>
        <button onClick={onNext} style={{ width: "100%", marginTop: 10, padding: "10px 0", background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "#94A3B8", fontFamily: f }}>
          Just me for now
        </button>
      </div>
    </div>
  );
}

// 6 — Connect payments
function StepPayments({ onNext, data, setData }) {
  const [connecting, setConnecting] = useState(false);
  const [connected, setConnected]   = useState(false);

  const connect = () => {
    setConnecting(true);
    setTimeout(() => { setConnecting(false); setConnected(true); setData({ ...data, stripeConnected: true }); }, 1800);
  };

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "0 16px 16px" }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: "#1E293B", letterSpacing: -0.4, marginBottom: 4 }}>Connect payments</div>
        <div style={{ fontSize: 13, color: "#64748B" }}>Accept deposits, full payments, tips, and get paid out automatically.</div>
      </div>

      <div style={{ flex: 1 }}>
        {/* Stripe card */}
        <div style={{ padding: "14px 16px", borderRadius: 18, background: connected ? "linear-gradient(135deg,#052B1A,#0D4A2D)" : "linear-gradient(135deg,#1A1A2E,#16213E)", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: "#635BFF", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontSize: 16 }}>⚡</span>
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 800, color: "#fff" }}>Stripe Payments</div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>PCI compliant · 256-bit SSL</div>
            </div>
            {connected && <div style={{ marginLeft: "auto", padding: "4px 12px", borderRadius: 20, background: "#16A34A", fontSize: 11, fontWeight: 700, color: "#fff" }}>✓ Connected</div>}
          </div>

          {connected ? (
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", lineHeight: 1.6 }}>
              Ready to accept Visa, Mastercard, Amex, Apple Pay, Google Pay. Payouts in 2 business days.
            </div>
          ) : (
            <>
              <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                {["Visa","Mastercard","Amex","Apple Pay","Google Pay"].map(p => (
                  <span key={p} style={{ fontSize: 9, fontWeight: 700, padding: "3px 7px", borderRadius: 6, background: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.6)", whiteSpace: "nowrap" }}>{p}</span>
                ))}
              </div>
              <button onClick={connect} disabled={connecting} style={{ width: "100%", padding: "13px 0", borderRadius: 12, background: "#635BFF", border: "none", cursor: connecting ? "default" : "pointer", fontSize: 14, fontWeight: 700, color: "#fff", fontFamily: f, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                {connecting ? (
                  <><span style={{ display: "inline-block", width: 16, height: 16, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", animation: "spin 0.7s linear infinite" }} />Connecting…</>
                ) : "Connect with Stripe →"}
              </button>
            </>
          )}
        </div>

        {/* What you get */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {[
            { icon: "💳", title: "Tap to Pay",       sub: "NFC on your iPhone"   },
            { icon: "🔗", title: "Payment Links",    sub: "SMS / WhatsApp / Email"},
            { icon: "💰", title: "Auto deposits",    sub: "2-day payouts"         },
            { icon: "🧾", title: "Receipts",         sub: "Auto-sent to clients"  },
          ].map((item, i) => (
            <div key={i} style={{ padding: "9px 12px", borderRadius: 11, background: "#fff", border: "1.5px solid #E2E0FB" }}>
              <div style={{ fontSize: 20, marginBottom: 5 }}>{item.icon}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#1E293B", marginBottom: 2 }}>{item.title}</div>
              <div style={{ fontSize: 11, color: "#94A3B8" }}>{item.sub}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ paddingTop: 16 }}>
        <Btn onClick={onNext} variant={connected ? "primary" : "secondary"}>
          {connected ? "Continue →" : "Skip for now"}
        </Btn>
        {!connected && (
          <div style={{ textAlign: "center", fontSize: 12, color: "#94A3B8", marginTop: 8 }}>
            You can connect payments from Settings anytime.
          </div>
        )}
      </div>
    </div>
  );
}

// 7 — AutoPilot setup
function StepAutoPilot({ onNext, data, setData }) {
  const flows = [
    { id: "rebook",   emoji: "🔁", title: "Rebooking reminders",   sub: "SMS clients when they're due for a visit",       recommended: true  },
    { id: "winback",  emoji: "🏆", title: "Win-back campaigns",     sub: "Automatically re-engage lapsed clients",         recommended: true  },
    { id: "slots",    emoji: "📅", title: "Slot filler",            sub: "Fill cancelled slots with waitlist clients",      recommended: true  },
    { id: "birthday", emoji: "🎂", title: "Birthday offers",        sub: "Auto-send gifts on client birthdays",            recommended: false },
    { id: "upsell",   emoji: "⭐", title: "Upsell prompts",         sub: "Suggest add-ons at booking & checkout",          recommended: false },
    { id: "review",   emoji: "⭐", title: "Review requests",        sub: "Collect Google reviews post-appointment",        recommended: false },
  ];

  const [enabled, setEnabled] = useState(new Set(["rebook","winback","slots"]));

  const toggle = id => setEnabled(s => {
    const next = new Set(s);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "0 16px 16px" }}>
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 12px", borderRadius: 20, background: "#F3F1FF", border: `1px solid ${ACCENT}20`, marginBottom: 12 }}>
          <span style={{ fontSize: 13 }}>✦</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: ACCENT }}>AI Revenue AutoPilot</span>
        </div>
        <div style={{ fontSize: 18, fontWeight: 800, color: "#1E293B", letterSpacing: -0.4, marginBottom: 4 }}>Turn on AutoPilot</div>
        <div style={{ fontSize: 13, color: "#64748B" }}>These run automatically in the background. You stay in control — turn any off anytime.</div>
      </div>

      {/* Revenue estimate */}
      <div style={{ padding: "10px 12px", borderRadius: 12, background: "linear-gradient(135deg,#F0EFFE,#E8E4FF)", border: "1.5px solid #C7D2FE", marginBottom: 10, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: ACCENT, letterSpacing: 1.2, marginBottom: 3 }}>EST. MONTHLY RECOVERY</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: "#1E293B", letterSpacing: -0.5 }}>+${enabled.size * 340}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 11, color: "#94A3B8", marginBottom: 3 }}>{enabled.size} flows active</div>
          <div style={{ fontSize: 12, fontWeight: 600, color: ACCENT }}>Based on 4 staff</div>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto" }}>
        {flows.map(flow => {
          const on = enabled.has(flow.id);
          return (
            <div key={flow.id} onClick={() => toggle(flow.id)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 11px", borderRadius: 11, background: on ? "#F3F1FF" : "#fff", border: `${on ? 2 : 1.5}px solid ${on ? ACCENT+"40" : "#E2E0FB"}`, marginBottom: 8, cursor: "pointer", transition: "all 0.15s" }}>
              <div style={{ width: 38, height: 38, borderRadius: 11, background: on ? "#E2E0FB" : "#FAFAFE", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>{flow.emoji}</div>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 2 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: "#1E293B" }}>{flow.title}</span>
                  {flow.recommended && <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 20, background: "#FEF3C7", color: "#D97706" }}>Recommended</span>}
                </div>
                <div style={{ fontSize: 12, color: "#64748B" }}>{flow.sub}</div>
              </div>
              {/* Toggle */}
              <div style={{ width: 42, height: 24, borderRadius: 12, background: on ? ACCENT : "#E2E0FB", position: "relative", flexShrink: 0, transition: "background 0.2s" }}>
                <div style={{ width: 18, height: 18, borderRadius: 9, background: "#fff", position: "absolute", top: 3, left: on ? 21 : 3, transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.15)" }} />
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ paddingTop: 16 }}>
        <Btn onClick={() => { setData({ ...data, autopilot: [...enabled] }); onNext(); }}>
          Launch AutoPilot →
        </Btn>
      </div>
    </div>
  );
}

// 8 — Daily brief preferences
function StepDailyBrief({ onNext, data, setData }) {
  const [briefTime, setBriefTime] = useState("7:00 AM");
  const [channels, setChannels]   = useState({ email: true, push: true, sms: false });

  const times = ["6:00 AM","6:30 AM","7:00 AM","7:30 AM","8:00 AM","8:30 AM","9:00 AM"];

  const toggleChan = k => setChannels(c => ({ ...c, [k]: !c[k] }));

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "0 16px 16px" }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: "#1E293B", letterSpacing: -0.4, marginBottom: 4 }}>Your daily brief</div>
        <div style={{ fontSize: 13, color: "#64748B" }}>Every morning, a 60-second snapshot of your business — before you open the door.</div>
      </div>

      <div style={{ flex: 1 }}>
        {/* Mock brief preview */}
        <div style={{ borderRadius: 18, background: "linear-gradient(165deg,#1A0D4E,#3B2090,#6040C0)", padding: "12px 14px 10px", marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
            <Logo size={22} light />
            <span style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.6)", letterSpacing: 1 }}>FLATPURSE FLOW</span>
            <span style={{ marginLeft: "auto", fontSize: 11, color: "rgba(255,255,255,0.35)" }}>{briefTime}</span>
          </div>
          <div style={{ fontSize: 16, fontWeight: 800, color: "#fff", marginBottom: 8 }}>Good morning, {data.firstName || "George"} ☀️</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            {[
              { icon: "📈", text: "+$340 recovered by AutoPilot yesterday" },
              { icon: "📅", text: "Today is 78% booked (14/18 slots)" },
              { icon: "⚠️", text: "2 items need your attention" },
            ].map((row, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 9 }}>
                <div style={{ width: 24, height: 24, borderRadius: "50%", background: "rgba(83,74,183,0.5)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, flexShrink: 0 }}>{row.icon}</div>
                <span style={{ fontSize: 12, color: "rgba(255,255,255,0.8)" }}>{row.text}</span>
              </div>
            ))}
          </div>
          <div style={{ height: 1, background: "rgba(255,255,255,0.12)", margin: "12px 0" }} />
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 7, padding: "9px 0", borderRadius: 10, background: "#4338CA" }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>Open Daily Brief</span>
            <span style={{ color: "#fff" }}>→</span>
          </div>
        </div>

        {/* Delivery time */}
        <div style={{ fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 8, letterSpacing: 0.3 }}>Deliver at</div>
        <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4, marginBottom: 16 }}>
          {times.map(t => (
            <button key={t} onClick={() => setBriefTime(t)} style={{ padding: "8px 14px", borderRadius: 20, border: `${briefTime===t?2:1.5}px solid ${briefTime===t?ACCENT:"#E2E0FB"}`, background: briefTime===t?"#F3F1FF":"#fff", cursor: "pointer", fontFamily: f, fontSize: 12, fontWeight: briefTime===t?700:500, color: briefTime===t?ACCENT:"#64748B", whiteSpace: "nowrap", flexShrink: 0, transition: "all 0.15s" }}>
              {t}
            </button>
          ))}
        </div>

        {/* Channels */}
        <div style={{ fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 8, letterSpacing: 0.3 }}>Send via</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {[["email","✉️","Email","Detailed morning brief in your inbox"],["push","📱","Push notification","Quick summary on your lock screen"],["sms","💬","SMS","One-line daily stat update"]].map(([key, icon, label, sub]) => {
            const on = channels[key];
            return (
              <div key={key} onClick={() => toggleChan(key)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 12, background: on?"#F3F1FF":"#fff", border: `${on?2:1.5}px solid ${on?ACCENT+"40":"#E2E0FB"}`, cursor: "pointer", transition: "all 0.15s" }}>
                <span style={{ fontSize: 18 }}>{icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#1E293B" }}>{label}</div>
                  <div style={{ fontSize: 11, color: "#94A3B8" }}>{sub}</div>
                </div>
                <div style={{ width: 42, height: 24, borderRadius: 12, background: on ? ACCENT : "#E2E0FB", position: "relative", flexShrink: 0, transition: "background 0.2s" }}>
                  <div style={{ width: 18, height: 18, borderRadius: 9, background: "#fff", position: "absolute", top: 3, left: on ? 21 : 3, transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.15)" }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ paddingTop: 16 }}>
        <Btn onClick={() => { setData({ ...data, briefTime, channels }); onNext(); }}>
          Set up my brief →
        </Btn>
      </div>
    </div>
  );
}

// 9 — All done / launch
function StepComplete({ data, onLaunch }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => { const t = setTimeout(() => setVisible(true), 100); return () => clearTimeout(t); }, []);

  const recap = [
    { icon: "🏠", label: "Business", value: data.bizName || "Your shop" },
    { icon: "🔗", label: "Booking link", value: `flatpurse.app/${data.bookingHandle || "yourshop"}` },
    { icon: "✂️", label: "Services", value: `${(data.services||[]).filter(s=>s.on).length} added` },
    { icon: "👥", label: "Team",     value: `${(data.team||[]).filter(m=>m.name).length} member${(data.team||[]).filter(m=>m.name).length !== 1?"s":""}` },
    { icon: "⚡", label: "AutoPilot",value: `${(data.autopilot||[]).length} flows active` },
  ];

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "0 16px 16px" }}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center" }}>
        {/* Success animation */}
        <div style={{
          width: 64, height: 64, borderRadius: 32,
          background: "linear-gradient(135deg,#22C55E,#15803D)",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 8px 24px rgba(34,197,94,0.35)",
          marginBottom: 14,
          opacity: visible ? 1 : 0,
          transform: visible ? "scale(1)" : "scale(0.5)",
          transition: "all 0.7s cubic-bezier(0.34,1.56,0.64,1)",
        }}>
          <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
        </div>

        <div style={{ opacity: visible?1:0, transform: visible?"translateY(0)":"translateY(16px)", transition: "all 0.55s ease 0.2s" }}>
          <div style={{ fontSize: 26, fontWeight: 800, color: "#1E293B", letterSpacing: -0.6, marginBottom: 8 }}>
            You're all set,<br/>{data.firstName || "George"}! 🎉
          </div>
          <div style={{ fontSize: 14, color: "#64748B", lineHeight: 1.65, maxWidth: 280, margin: "0 auto" }}>
            FlatPurse Flow is configured and AutoPilot is warming up. Your first daily brief arrives tomorrow morning.
          </div>
        </div>

        {/* Recap */}
        <div style={{ marginTop: 24, width: "100%", maxWidth: 320, opacity: visible?1:0, transition: "opacity 0.5s ease 0.4s" }}>
          {recap.map((item, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 12px", borderRadius: 10, background: "#fff", border: "1px solid #EDEAFE", marginBottom: 5, boxShadow: "0 1px 4px rgba(83,74,183,0.06)" }}>
              <span style={{ fontSize: 16, flexShrink: 0 }}>{item.icon}</span>
              <span style={{ fontSize: 12, color: "#94A3B8", flex: 1, textAlign: "left" }}>{item.label}</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#1E293B" }}>{item.value}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ opacity: visible?1:0, transition: "opacity 0.5s ease 0.5s" }}>
        <Btn onClick={onLaunch}>Open FlatPurse Flow →</Btn>
        <div style={{ textAlign: "center", fontSize: 12, color: "#94A3B8", marginTop: 10 }}>
          Questions? We're at hello@flatpurse.com
        </div>
      </div>
    </div>
  );
}


// ─────────────────────────────────────────────────────────────────
// STEP: MIGRATE — Featured competitors
// ─────────────────────────────────────────────────────────────────
function StepMigrateFeatured({ onNext, data, setData }) {
  const [selected, setSelected] = useState(null);
  const [importing, setImporting] = useState(false);
  const [imported, setImported] = useState(null);

  const platforms = [
    { id: "fresha",    name: "Fresha",    emoji: "🟢", clients: "3,200+", color: "#00B67A", desc: "Free booking software" },
    { id: "square",    name: "Square",    emoji: "🟦", clients: "2,800+", color: "#3E4348", desc: "Square Appointments" },
    { id: "booksy",    name: "Booksy",    emoji: "🔵", clients: "1,900+", color: "#1C6EF2", desc: "Marketplace + booking" },
    { id: "mindbody",  name: "Mindbody",  emoji: "🟣", clients: "4,100+", color: "#6D3FC8", desc: "Wellness & fitness" },
  ];

  const doImport = () => {
    if (!selected) return;
    setImporting(true);
    setTimeout(() => {
      setImporting(false);
      const p = platforms.find(p => p.id === selected);
      setImported({ name: p.name, count: Math.floor(Math.random() * 200) + 80 });
      setData({ ...data, migratedFrom: p.name });
    }, 2000);
  };

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "0 16px 16px" }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: "#1E293B", letterSpacing: -0.4, marginBottom: 4 }}>Switching from another app?</div>
        <div style={{ fontSize: 13, color: "#64748B" }}>Import your clients, services & history in one tap. No spreadsheets.</div>
      </div>

      <div style={{ flex: 1 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
          {platforms.map(p => {
            const on = selected === p.id;
            const done = imported?.name === p.name;
            return (
              <button key={p.id} onClick={() => !imported && setSelected(p.id)} style={{ padding: "11px 12px", borderRadius: 13, border: `${on || done ? 2 : 1.5}px solid ${done ? "#22C55E" : on ? ACCENT : "#E2E0FB"}`, background: done ? "#DCFCE7" : on ? "#F3F1FF" : "#fff", cursor: imported ? "default" : "pointer", textAlign: "left", transition: "all 0.18s", position: "relative" }}>
                {done && <div style={{ position: "absolute", top: 8, right: 10, fontSize: 16 }}>✅</div>}
                <div style={{ fontSize: 26, marginBottom: 8 }}>{p.emoji}</div>
                <div style={{ fontSize: 15, fontWeight: 800, color: done ? "#16A34A" : "#1E293B", marginBottom: 2 }}>{p.name}</div>
                <div style={{ fontSize: 11, color: "#94A3B8", marginBottom: 6 }}>{p.desc}</div>
                <div style={{ fontSize: 11, fontWeight: 700, color: done ? "#16A34A" : p.color }}>
                  {done ? `Imported!` : `${p.clients} salons switched`}
                </div>
              </button>
            );
          })}
        </div>

        {/* Import CTA */}
        {!imported && (
          <button onClick={doImport} disabled={!selected || importing} style={{ width: "100%", padding: "14px 0", borderRadius: 14, background: selected ? `linear-gradient(135deg,${ACCENT},#6D28D9)` : "#F0F0F0", color: selected ? "#fff" : "#94A3B8", border: "none", cursor: selected && !importing ? "pointer" : "default", fontFamily: f, fontSize: 15, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 10, boxShadow: selected ? "0 4px 20px rgba(83,74,183,0.28)" : "none", transition: "all 0.2s" }}>
            {importing ? (
              <><span style={{ display: "inline-block", width: 16, height: 16, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.35)", borderTopColor: "#fff", animation: "spin 0.7s linear infinite" }} />Importing your data…</>
            ) : selected ? `Import from ${platforms.find(p=>p.id===selected)?.name} →` : "Select a platform"}
          </button>
        )}

        {imported && (
          <div style={{ padding: "14px 16px", borderRadius: 14, background: "#DCFCE7", border: "1px solid #BBF7D0", marginBottom: 10 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: "#16A34A", marginBottom: 2 }}>🎉 {imported.count} clients imported!</div>
            <div style={{ fontSize: 12, color: "#4B7A5B" }}>Appointments, services & history transferred from {imported.name}.</div>
          </div>
        )}

        {/* Other options */}
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => onNext("csv")} style={{ flex: 1, padding: "11px 0", borderRadius: 12, border: "1.5px solid #E2E0FB", background: "#FAFAFE", cursor: "pointer", fontFamily: f, fontSize: 12, fontWeight: 700, color: "#64748B" }}>📁 Upload CSV</button>
          <button onClick={onNext} style={{ flex: 1, padding: "11px 0", borderRadius: 12, border: "1.5px solid #E2E0FB", background: "#FAFAFE", cursor: "pointer", fontFamily: f, fontSize: 12, fontWeight: 700, color: "#64748B" }}>🔍 More platforms</button>
        </div>
      </div>

      <div style={{ paddingTop: 14 }}>
        <Btn onClick={onNext}>{imported ? "Continue with imported data →" : "Skip — I'll start fresh"}</Btn>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// STEP: MIGRATE — CSV Upload
// ─────────────────────────────────────────────────────────────────
function StepMigrateCSV({ onNext, data, setData }) {
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState(null);
  const [phase, setPhase] = useState("idle"); // idle | mapping | review | done
  const [progress, setProgress] = useState(0);
  const fileRef = useRef(null);

  const handleFile = (f) => {
    if (!f) return;
    setFile(f);
    setPhase("mapping");
    let p = 0;
    const interval = setInterval(() => {
      p += 12;
      setProgress(Math.min(p, 100));
      if (p >= 100) { clearInterval(interval); setPhase("review"); }
    }, 120);
  };

  const columns = ["Full Name","Phone","Email","Last Visit","Total Spend"];
  const preview = [
    ["Sarah Johnson", "+1 587 222 1947", "sarah@email.com", "Apr 12", "$1,240"],
    ["Michael Chen",  "+1 780 333 4821", "mc@email.com",   "Mar 28", "$360"],
    ["Lisa Park",     "+1 587 444 9102", "lisa@email.com", "Apr 1",  "$4,800"],
  ];

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "0 16px 16px" }}>
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: "#1E293B", letterSpacing: -0.4, marginBottom: 4 }}>Import from CSV</div>
        <div style={{ fontSize: 13, color: "#64748B" }}>Export from any platform, upload here. We'll map the columns automatically.</div>
      </div>

      <div style={{ flex: 1 }}>
        {/* 3-step progress */}
        <div style={{ display: "flex", alignItems: "center", marginBottom: 18 }}>
          {[["Upload","idle"],["Map columns","mapping"],["Review","review"]].map(([label, p], i) => {
            const done  = (phase === "mapping" && i === 0) || (phase === "review" && i <= 1) || phase === "done";
            const active = (phase === p) || (phase === "done" && i === 2);
            return (
              <div key={i} style={{ display: "flex", alignItems: "center", flex: i < 2 ? 1 : "none" }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                  <div style={{ width: 28, height: 28, borderRadius: 14, background: done ? "#22C55E" : active ? ACCENT : "#E2E0FB", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: done || active ? "#fff" : "#94A3B8", transition: "all 0.3s" }}>
                    {done ? "✓" : i + 1}
                  </div>
                  <div style={{ fontSize: 10, fontWeight: 600, color: active ? ACCENT : "#94A3B8", whiteSpace: "nowrap" }}>{label}</div>
                </div>
                {i < 2 && <div style={{ flex: 1, height: 2, background: done ? "#22C55E" : "#E2E0FB", margin: "0 8px 14px", transition: "background 0.5s" }} />}
              </div>
            );
          })}
        </div>

        {/* Upload zone */}
        {phase === "idle" && (
          <>
            <div
              onDragOver={e => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={e => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]); }}
              onClick={() => fileRef.current?.click()}
              style={{ height: 160, borderRadius: 16, border: `2px dashed ${dragging ? ACCENT : "#C7D2FE"}`, background: dragging ? "#F3F1FF" : "#FAFAFE", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, cursor: "pointer", transition: "all 0.2s", marginBottom: 12 }}>
              <input ref={fileRef} type="file" accept=".csv,.xlsx" style={{ display: "none" }} onChange={e => handleFile(e.target.files?.[0])} />
              <div style={{ width: 52, height: 52, borderRadius: "50%", background: "#F3F1FF", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>📁</div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#1E293B", marginBottom: 4 }}>Drop your CSV here</div>
                <div style={{ fontSize: 12, color: "#94A3B8" }}>or click to browse · CSV, Excel supported</div>
              </div>
            </div>
            <button style={{ width: "100%", padding: "11px 0", borderRadius: 12, background: "#F3F1FF", border: "1.5px solid #E2E0FB", cursor: "pointer", fontFamily: f, fontSize: 13, fontWeight: 700, color: ACCENT }}>
              📥 Download our template
            </button>
          </>
        )}

        {/* Mapping phase */}
        {phase === "mapping" && (
          <div style={{ textAlign: "center", padding: "24px 0" }}>
            <div style={{ fontSize: 22, marginBottom: 12 }}>🔍</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#1E293B", marginBottom: 8 }}>Mapping columns…</div>
            <div style={{ height: 6, borderRadius: 3, background: "#E2E0FB", overflow: "hidden", marginBottom: 8 }}>
              <div style={{ height: "100%", borderRadius: 3, background: `linear-gradient(90deg,${ACCENT},#D93080)`, width: `${progress}%`, transition: "width 0.1s" }} />
            </div>
            <div style={{ fontSize: 12, color: "#94A3B8" }}>{file?.name} · Detecting columns…</div>
          </div>
        )}

        {/* Review phase */}
        {phase === "review" && (
          <>
            <div style={{ padding: "12px 14px", borderRadius: 12, background: "#DCFCE7", border: "1px solid #BBF7D0", marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#16A34A" }}>✓ {file?.name} · {Math.floor(Math.random() * 200) + 50 + 3} clients detected</div>
              <div style={{ fontSize: 12, color: "#4B7A5B", marginTop: 2 }}>All 5 columns mapped automatically</div>
            </div>
            <div style={{ borderRadius: 12, border: "1px solid #E2E0FB", overflow: "hidden", marginBottom: 10 }}>
              <div style={{ display: "flex", background: "#F3F1FF", borderBottom: "1px solid #E2E0FB" }}>
                {columns.map((col, i) => <div key={i} style={{ flex: 1, padding: "8px 10px", fontSize: 9, fontWeight: 700, color: ACCENT, letterSpacing: 0.8 }}>{col.toUpperCase()}</div>)}
              </div>
              {preview.map((row, i) => (
                <div key={i} style={{ display: "flex", borderBottom: i < 2 ? "1px solid #E2E0FB" : "none" }}>
                  {row.map((cell, j) => <div key={j} style={{ flex: 1, padding: "9px 10px", fontSize: 11, color: "#334155", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{cell}</div>)}
                </div>
              ))}
              <div style={{ padding: "8px 10px", fontSize: 11, color: "#94A3B8", background: "#FAFAFE" }}>+ more rows…</div>
            </div>
          </>
        )}
      </div>

      <div style={{ paddingTop: 12 }}>
        {phase === "review" ? (
          <Btn onClick={() => { setData({ ...data, csvImported: true }); onNext(); }}>Import {Math.floor(Math.random() * 200) + 53} clients →</Btn>
        ) : (
          <Btn onClick={onNext} variant="ghost">Skip — start with no data</Btn>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// STEP: HOURS / SCHEDULE
// ─────────────────────────────────────────────────────────────────
function StepHours({ onNext, data, setData }) {
  const days = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
  const [open, setOpen] = useState({ Mon:true, Tue:true, Wed:true, Thu:true, Fri:true, Sat:false, Sun:false });
  const [hours, setHours] = useState({ Mon:{from:"9:00 AM",to:"7:00 PM"}, Tue:{from:"9:00 AM",to:"7:00 PM"}, Wed:{from:"9:00 AM",to:"7:00 PM"}, Thu:{from:"9:00 AM",to:"7:00 PM"}, Fri:{from:"9:00 AM",to:"8:00 PM"}, Sat:{from:"10:00 AM",to:"6:00 PM"}, Sun:{from:"10:00 AM",to:"4:00 PM"} });

  const times = ["7:00 AM","7:30 AM","8:00 AM","8:30 AM","9:00 AM","9:30 AM","10:00 AM","10:30 AM","11:00 AM","12:00 PM","1:00 PM","2:00 PM","3:00 PM","4:00 PM","5:00 PM","6:00 PM","7:00 PM","8:00 PM","9:00 PM"];

  const toggleDay = d => setOpen(o => ({ ...o, [d]: !o[d] }));
  const setFrom = (d, v) => setHours(h => ({ ...h, [d]: { ...h[d], from: v } }));
  const setTo   = (d, v) => setHours(h => ({ ...h, [d]: { ...h[d], to: v } }));

  const openDays = days.filter(d => open[d]);

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "0 16px 16px" }}>
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: "#1E293B", letterSpacing: -0.4, marginBottom: 4 }}>Your opening hours</div>
        <div style={{ fontSize: 13, color: "#64748B" }}>Set when clients can book. You can change this anytime.</div>
      </div>

      <div style={{ flex: 1, overflowY: "auto" }}>
        {/* Day toggle pills */}
        <div style={{ display: "flex", gap: 7, marginBottom: 18, flexWrap: "wrap" }}>
          {days.map(d => (
            <button key={d} onClick={() => toggleDay(d)} style={{ padding: "8px 14px", borderRadius: 20, border: `${open[d]?2:1.5}px solid ${open[d]?ACCENT:"#E2E0FB"}`, background: open[d]?"#F3F1FF":"#fff", cursor: "pointer", fontFamily: f, fontSize: 12, fontWeight: open[d]?700:500, color: open[d]?ACCENT:"#94A3B8", transition: "all 0.15s" }}>
              {d}
            </button>
          ))}
        </div>

        {/* Time pickers for open days */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {days.filter(d => open[d]).map(d => (
            <div key={d} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 11, background: "#fff", border: "1.5px solid #E2E0FB" }}>
              <div style={{ width: 36, fontSize: 12, fontWeight: 700, color: "#334155" }}>{d}</div>
              <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8 }}>
                <select value={hours[d].from} onChange={e => setFrom(d, e.target.value)} style={{ flex: 1, padding: "8px 10px", borderRadius: 9, border: "1px solid #E2E0FB", background: "#FAFAFE", fontFamily: f, fontSize: 12, fontWeight: 600, color: "#334155", cursor: "pointer", outline: "none" }}>
                  {times.map(t => <option key={t}>{t}</option>)}
                </select>
                <span style={{ fontSize: 12, color: "#94A3B8" }}>–</span>
                <select value={hours[d].to} onChange={e => setTo(d, e.target.value)} style={{ flex: 1, padding: "8px 10px", borderRadius: 9, border: "1px solid #E2E0FB", background: "#FAFAFE", fontFamily: f, fontSize: 12, fontWeight: 600, color: "#334155", cursor: "pointer", outline: "none" }}>
                  {times.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
            </div>
          ))}

          {days.filter(d => !open[d]).map(d => (
            <div key={d} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderRadius: 13, background: "#FAFAFE", border: "1.5px solid #E2E0FB", opacity: 0.5 }}>
              <div style={{ width: 36, fontSize: 12, fontWeight: 700, color: "#94A3B8" }}>{d}</div>
              <div style={{ fontSize: 12, color: "#94A3B8" }}>Closed</div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 14, padding: "12px 16px", borderRadius: 12, background: "#F3F1FF", border: "1.5px solid #E2E0FB" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: ACCENT, marginBottom: 4 }}>✦ AutoPilot will respect these hours</div>
          <div style={{ fontSize: 12, color: "#64748B" }}>No bookings or outreach sent outside your open hours.</div>
        </div>
      </div>

      <div style={{ paddingTop: 14 }}>
        <Btn onClick={() => { setData({ ...data, hours, openDays }); onNext(); }}>
          Save hours — {openDays.length} days open →
        </Btn>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// STEP: FAMILY HOURS
// ─────────────────────────────────────────────────────────────────
function StepFamilyHours({ onNext, data, setData }) {
  const [enabled, setEnabled] = useState(true);
  const [protectedTime, setProtectedTime] = useState({ from: "6:00 PM", to: "8:00 PM" });
  const [days, setDays] = useState({ Mon:true, Tue:true, Wed:true, Thu:true, Fri:true, Sat:false, Sun:false });
  const [streak] = useState(12);

  const times = ["5:00 PM","5:30 PM","6:00 PM","6:30 PM","7:00 PM","7:30 PM","8:00 PM","8:30 PM","9:00 PM","10:00 PM"];
  const dayList = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];

  const toggleDay = d => setDays(s => ({ ...s, [d]: !s[d] }));

  // Timeline bar segments (visual only)
  const segments = [
    { label: "Open",   from: 0,   to: 55,  color: "#534AB7", opacity: 1 },
    { label: "Family", from: 55,  to: 80,  color: "#22C55E", opacity: 1 },
    { label: "Closed", from: 80,  to: 100, color: "#E2E0FB", opacity: 1 },
  ];

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "0 16px 16px" }}>
      <div style={{ marginBottom: 18 }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 12px", borderRadius: 20, background: "#DCFCE7", border: "1px solid #BBF7D0", marginBottom: 10 }}>
          <span style={{ fontSize: 14 }}>🏠</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: "#16A34A" }}>Family Hours</span>
        </div>
        <div style={{ fontSize: 18, fontWeight: 800, color: "#1E293B", letterSpacing: -0.4, marginBottom: 4 }}>Protect your personal time</div>
        <div style={{ fontSize: 13, color: "#64748B" }}>AutoPilot will never book clients or send messages during these hours.</div>
      </div>

      <div style={{ flex: 1 }}>
        {/* Enable toggle */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 16px", borderRadius: 14, background: enabled ? "#DCFCE7" : "#FAFAFE", border: `1.5px solid ${enabled ? "#BBF7D0" : "#E2E0FB"}`, marginBottom: 16, transition: "all 0.2s" }}>
          <div style={{ fontSize: 24 }}>🏠</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#1E293B" }}>Enable Family Hours</div>
            <div style={{ fontSize: 12, color: "#64748B" }}>AutoPilot respects your off-time</div>
          </div>
          <div onClick={() => setEnabled(!enabled)} style={{ width: 46, height: 26, borderRadius: 13, background: enabled ? "#22C55E" : "#E2E0FB", position: "relative", cursor: "pointer", flexShrink: 0, transition: "background 0.2s" }}>
            <div style={{ width: 20, height: 20, borderRadius: 10, background: "#fff", position: "absolute", top: 3, left: enabled ? 23 : 3, transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.15)" }} />
          </div>
        </div>

        {enabled && (
          <>
            {/* Timeline visual */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 8 }}>Today's schedule</div>
              <div style={{ display: "flex", height: 32, borderRadius: 10, overflow: "hidden", gap: 2, marginBottom: 6 }}>
                {segments.map((seg, i) => (
                  <div key={i} style={{ flex: seg.to - seg.from, background: seg.color, opacity: seg.opacity, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <span style={{ fontSize: 9, fontWeight: 700, color: "#fff", whiteSpace: "nowrap", padding: "0 4px" }}>{seg.label}</span>
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#94A3B8" }}>
                <span>9:00 AM</span><span>3:00 PM</span><span>6:00 PM</span><span>10:00 PM</span>
              </div>
            </div>

            {/* Time picker */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 8 }}>Protected window</div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 11, background: "#fff", border: "1.5px solid #E2E0FB" }}>
                <span style={{ fontSize: 16 }}>🏠</span>
                <select value={protectedTime.from} onChange={e => setProtectedTime(t => ({ ...t, from: e.target.value }))} style={{ flex: 1, background: "none", border: "none", outline: "none", fontFamily: f, fontSize: 13, fontWeight: 700, color: "#334155", cursor: "pointer" }}>
                  {times.map(t => <option key={t}>{t}</option>)}
                </select>
                <span style={{ fontSize: 12, color: "#94A3B8" }}>–</span>
                <select value={protectedTime.to} onChange={e => setProtectedTime(t => ({ ...t, to: e.target.value }))} style={{ flex: 1, background: "none", border: "none", outline: "none", fontFamily: f, fontSize: 13, fontWeight: 700, color: "#334155", cursor: "pointer" }}>
                  {times.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
            </div>

            {/* Day selection */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 8 }}>Protect on</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {dayList.map(d => (
                  <button key={d} onClick={() => toggleDay(d)} style={{ padding: "6px 12px", borderRadius: 20, border: `${days[d]?2:1.5}px solid ${days[d]?"#22C55E":"#E2E0FB"}`, background: days[d]?"#DCFCE7":"#fff", cursor: "pointer", fontFamily: f, fontSize: 11, fontWeight: days[d]?700:500, color: days[d]?"#16A34A":"#94A3B8", transition: "all 0.15s" }}>
                    {d}
                  </button>
                ))}
              </div>
            </div>

            {/* Streak */}
            <div style={{ padding: "12px 16px", borderRadius: 13, background: "linear-gradient(135deg,#DCFCE7,#F0FDF4)", border: "1px solid #BBF7D0", display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: "#16A34A" }}>{streak}</div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#16A34A" }}>day streak</div>
                <div style={{ fontSize: 11, color: "#4B7A5B" }}>Keep it going — your business runs, you rest.</div>
              </div>
              <span style={{ fontSize: 24, marginLeft: "auto" }}>🔥</span>
            </div>
          </>
        )}
      </div>

      <div style={{ paddingTop: 14 }}>
        <Btn onClick={() => { setData({ ...data, familyHours: { enabled, protectedTime, days } }); onNext(); }}>
          {enabled ? `Protect ${protectedTime.from} – ${protectedTime.to} →` : "Skip Family Hours"}
        </Btn>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// STEP: CONNECT CHANNELS
// ─────────────────────────────────────────────────────────────────
function StepChannels({ onNext, data, setData }) {
  const [connected, setConnected] = useState({});
  const [connecting, setConnecting] = useState(null);

  const channels = [
    { id: "instagram",  name: "Instagram",       emoji: "📸", desc: "Bio link + DM booking",       color: "#E1306C", benefit: "~40% of bookings" },
    { id: "whatsapp",   name: "WhatsApp",         emoji: "💬", desc: "Send confirmations & links",   color: "#25D366", benefit: "2× open rate vs SMS" },
    { id: "facebook",   name: "Facebook",         emoji: "🔵", desc: "Page + Messenger booking",    color: "#1877F2", benefit: "Reach older clients" },
    { id: "google",     name: "Google Business",  emoji: "🔍", desc: "Book via Search & Maps",       color: "#4285F4", benefit: "3× local discovery" },
    { id: "email",      name: "Email",            emoji: "✉️", desc: "Automated campaigns & briefs", color: "#534AB7", benefit: "Highest LTV channel" },
    { id: "sms",        name: "SMS",              emoji: "📱", desc: "Reminders & win-backs",        color: "#0891B2", benefit: "98% open rate" },
  ];

  const connect = (id) => {
    setConnecting(id);
    setTimeout(() => {
      setConnected(c => ({ ...c, [id]: true }));
      setConnecting(null);
    }, 1200);
  };

  const connectedCount = Object.keys(connected).length;

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "0 16px 16px" }}>
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: "#1E293B", letterSpacing: -0.4, marginBottom: 4 }}>Connect your channels</div>
        <div style={{ fontSize: 13, color: "#64748B" }}>AutoPilot sends through the channels clients actually use.</div>
      </div>

      <div style={{ flex: 1, overflowY: "auto" }}>
        {connectedCount > 0 && (
          <div style={{ padding: "10px 14px", borderRadius: 12, background: "#F3F1FF", border: "1.5px solid #E2E0FB", marginBottom: 14, display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: ACCENT }}>✦ {connectedCount} channel{connectedCount!==1?"s":""} connected</div>
            <div style={{ fontSize: 12, color: "#94A3B8", marginLeft: "auto" }}>AutoPilot is expanding</div>
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7 }}>
          {channels.map(ch => {
            const done = connected[ch.id];
            const busy = connecting === ch.id;
            return (
              <div key={ch.id} style={{ padding: "14px 14px", borderRadius: 16, border: `${done?2:1.5}px solid ${done?ch.color+"50":"#E2E0FB"}`, background: done?`${ch.color}08`:"#fff", transition: "all 0.2s", position: "relative" }}>
                {done && <div style={{ position: "absolute", top: 9, right: 11, fontSize: 13 }}>✅</div>}
                <div style={{ fontSize: 26, marginBottom: 7 }}>{ch.emoji}</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: "#1E293B", marginBottom: 2 }}>{ch.name}</div>
                <div style={{ fontSize: 11, color: "#94A3B8", marginBottom: 8, lineHeight: 1.4 }}>{ch.desc}</div>
                <div style={{ fontSize: 10, fontWeight: 700, color: ch.color, marginBottom: 10 }}>{ch.benefit}</div>
                <button
                  onClick={() => !done && !busy && connect(ch.id)}
                  style={{ width: "100%", padding: "8px 0", borderRadius: 9, background: done?"#DCFCE7":busy?`${ch.color}15`:`${ch.color}12`, border: `1.5px solid ${done?"#BBF7D0":busy?`${ch.color}40`:`${ch.color}25`}`, cursor: done||busy?"default":"pointer", fontFamily: f, fontSize: 12, fontWeight: 700, color: done?"#16A34A":ch.color, transition: "all 0.2s", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                  {busy ? (
                    <><span style={{ display: "inline-block", width: 12, height: 12, borderRadius: "50%", border: `2px solid ${ch.color}30`, borderTopColor: ch.color, animation: "spin 0.7s linear infinite" }} />Connecting…</>
                  ) : done ? "✓ Connected" : "Connect"}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ paddingTop: 14 }}>
        <Btn onClick={() => { setData({ ...data, channels: connected }); onNext(); }}>
          {connectedCount > 0 ? `Continue with ${connectedCount} channel${connectedCount!==1?"s":""} →` : "Skip for now"}
        </Btn>
      </div>
    </div>
  );
}

// ── Step config ────────────────────────────────────────────────────
const STEPS = [
  { id: "welcome",      title: null,                 showProgress: false, showBack: false },
  { id: "account",      title: "Create account",     showProgress: true,  showBack: true  },
  { id: "migrate",      title: "Import data",        showProgress: true,  showBack: true  },
  { id: "csv",          title: "CSV upload",         showProgress: true,  showBack: true  },
  { id: "business",     title: "Your shop",          showProgress: true,  showBack: true  },
  { id: "bookingLink",  title: "Booking link",       showProgress: true,  showBack: true  },
  { id: "hours",        title: "Opening hours",      showProgress: true,  showBack: true  },
  { id: "family",       title: "Family hours",       showProgress: true,  showBack: true  },
  { id: "services",     title: "Services",           showProgress: true,  showBack: true  },
  { id: "team",         title: "Your team",          showProgress: true,  showBack: true  },
  { id: "payments",     title: "Payments",           showProgress: true,  showBack: true  },
  { id: "channels",     title: "Connect channels",   showProgress: true,  showBack: true  },
  { id: "autopilot",    title: "AutoPilot",          showProgress: true,  showBack: true  },
  { id: "brief",        title: "Daily brief",        showProgress: true,  showBack: true  },
  { id: "complete",     title: null,                 showProgress: false, showBack: false },
];

// ── Phone chrome wrapper ──────────────────────────────────────────
function PhoneShell({ children, step }) {
  const [time] = useState(() => {
    const now = new Date();
    return `${now.getHours()}:${String(now.getMinutes()).padStart(2,"0")}`;
  });

  // Phone dimensions — natural size, let the outer wrapper scale it
  const PW = 390, PH = 780;

  return (
    <div style={{ width: PW, height: PH, borderRadius: 48, overflow: "hidden", background: "#FAF8F5", position: "relative", flexShrink: 0, boxShadow: "0 32px 80px rgba(0,0,0,0.28), 0 4px 20px rgba(0,0,0,0.14), inset 0 0 0 1.5px rgba(0,0,0,0.09)" }}>
      {/* Status bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 28px 0", flexShrink: 0 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: "#1E293B" }}>{time}</span>
        <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
          <svg width="16" height="10" viewBox="0 0 18 12"><rect x="0" y="8" width="3" height="4" rx="0.5" fill="#1E293B"/><rect x="4.5" y="5.5" width="3" height="6.5" rx="0.5" fill="#1E293B"/><rect x="9" y="3" width="3" height="9" rx="0.5" fill="#1E293B"/><rect x="13.5" y="0" width="3" height="12" rx="0.5" fill="#1E293B"/></svg>
          <svg width="24" height="12" viewBox="0 0 26 13" fill="none"><rect x="0.5" y="0.5" width="21" height="12" rx="3.5" stroke="rgba(0,0,0,0.25)"/><rect x="2" y="2" width="15" height="9" rx="2" fill="#1E293B"/><path d="M22.5 4.5v4a2 2 0 000-4z" fill="rgba(0,0,0,0.2)"/></svg>
        </div>
      </div>

      {/* Dynamic island */}
      <div style={{ position: "absolute", top: 12, left: "50%", transform: "translateX(-50%)", width: 110, height: 30, borderRadius: 18, background: "#000", zIndex: 20 }} />

      {/* Screen content */}
      <div style={{ display: "flex", flexDirection: "column", height: "100%", paddingTop: 4 }}>
        {/* Nav header */}
        {STEPS[step].showProgress && (
          <div style={{ padding: "8px 20px 8px", flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <Logo size={22} />
                <div>
                  <div style={{ fontSize: 11, fontWeight: 800, color: "#1E293B", letterSpacing: -0.1, lineHeight: 1.1 }}>FlatPurse</div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: ACCENT, lineHeight: 1 }}>Flow</div>
                </div>
              </div>
              <span style={{ fontSize: 10, fontWeight: 600, color: "#94A3B8" }}>Step {step} of {STEPS.length - 2}</span>
            </div>
            <ProgressBar step={step} total={STEPS.length - 2} />
            {STEPS[step].title && (
              <div style={{ fontSize: 10, fontWeight: 700, color: "#94A3B8", letterSpacing: 1.2, marginTop: 8, textTransform: "uppercase" }}>{STEPS[step].title}</div>
            )}
          </div>
        )}

        {/* Welcome screen logo area */}
        {!STEPS[step].showProgress && step === 0 && (
          <div style={{ padding: "16px 20px 0", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <Logo size={26} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 800, color: "#1E293B", lineHeight: 1.1 }}>FlatPurse</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: ACCENT, lineHeight: 1 }}>Flow</div>
              </div>
            </div>
            <button style={{ fontSize: 12, color: "#94A3B8", background: "none", border: "none", cursor: "pointer", fontFamily: f, fontWeight: 600 }}>Sign in</button>
          </div>
        )}

        {children}
      </div>
    </div>
  );
}

// ── Root ──────────────────────────────────────────────────────────
function FlatpurseOnboarding({ onLaunchApp } = {}) {
  const [step, setStep]   = useState(0);
  const [data, setData]   = useState({});
  const [dir,  setDir]    = useState(1); // 1 forward, -1 back
  const [animKey, setAnimKey] = useState(0);

  const go = (delta) => {
    setDir(delta);
    setAnimKey(k => k + 1);
    setStep(s => Math.max(0, Math.min(STEPS.length - 1, s + delta)));
  };

  const next = () => go(1);
  const back = () => go(-1);

  const stepComponents = [
    <StepWelcome          onNext={next} />,
    <StepAccount          onNext={next} data={data} setData={setData} />,
    <StepMigrateFeatured  onNext={next} data={data} setData={setData} />,
    <StepMigrateCSV       onNext={next} data={data} setData={setData} />,
    <StepBusiness         onNext={next} data={data} setData={setData} />,
    <StepBookingLink      onNext={next} data={data} setData={setData} />,
    <StepHours            onNext={next} data={data} setData={setData} />,
    <StepFamilyHours      onNext={next} data={data} setData={setData} />,
    <StepServices         onNext={next} data={data} setData={setData} />,
    <StepTeam             onNext={next} data={data} setData={setData} />,
    <StepPayments         onNext={next} data={data} setData={setData} />,
    <StepChannels         onNext={next} data={data} setData={setData} />,
    <StepAutoPilot        onNext={next} data={data} setData={setData} />,
    <StepDailyBrief       onNext={next} data={data} setData={setData} />,
    <StepComplete         data={data} onLaunch={() => onLaunchApp ? onLaunchApp() : setStep(0)} />,
  ];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #0A0A14; min-height: 100vh; font-family: 'DM Sans', sans-serif; }
        :root { --phone-scale: 0.88; }
        @media (max-height: 820px) { :root { --phone-scale: 0.78; } }
        @media (max-height: 700px) { :root { --phone-scale: 0.66; } }
        @media (max-width: 900px)  { :root { --phone-scale: 0.72; } }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes slideInRight { from { opacity:0; transform:translateX(32px); } to { opacity:1; transform:translateX(0); } }
        @keyframes slideInLeft  { from { opacity:0; transform:translateX(-32px); } to { opacity:1; transform:translateX(0); } }
        input[type=number]::-webkit-inner-spin-button { -webkit-appearance: none; }
        select { appearance: none; }
        ::-webkit-scrollbar { width: 0; }
      `}</style>

      {/* Background */}
      <div style={{ position: "fixed", inset: 0, background: "radial-gradient(ellipse at 30% 20%,rgba(83,74,183,0.25) 0%,transparent 50%), radial-gradient(ellipse at 70% 80%,rgba(217,48,128,0.15) 0%,transparent 50%), #0A0A14", zIndex: 0 }} />

      <div style={{ position: "relative", zIndex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 28, padding: "16px 20px", minHeight: "100vh", flexWrap: "wrap" }}>
        {/* Left — step navigator (desktop companion) */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 160 }}>
          {STEPS.filter(s => s.showProgress).map((s, i) => {
            const realStep = i + 1;
            const done   = step > realStep;
            const active = step === realStep;
            return (
              <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 8, opacity: active ? 1 : done ? 0.7 : 0.3, transition: "opacity 0.3s" }}>
                <div style={{ width: 20, height: 20, borderRadius: 10, background: done ? "#22C55E" : active ? ACCENT : "rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "background 0.3s", fontSize: 10, fontWeight: 700, color: "#fff" }}>
                  {done ? "✓" : realStep}
                </div>
                <span style={{ fontSize: 12, fontWeight: active ? 700 : 500, color: active ? "#fff" : "rgba(255,255,255,0.7)" }}>{s.title}</span>
              </div>
            );
          })}
        </div>

        {/* Phone — scaled to fit viewport height */}
        <div style={{ transform: "scale(var(--phone-scale, 0.88))", transformOrigin: "top center", flexShrink: 0 }}>
        <PhoneShell step={step}>
          {/* Back button */}
          {STEPS[step].showBack && (
            <button onClick={back} style={{ position: "absolute", top: 22, left: 20, zIndex: 30, width: 34, height: 34, borderRadius: 17, background: "rgba(83,74,183,0.08)", border: "1px solid rgba(83,74,183,0.15)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={ACCENT} strokeWidth="2.5" strokeLinecap="round"><path d="M15 18l-6-6 6-6"/></svg>
            </button>
          )}

          {/* Animated content */}
          <div key={animKey} style={{ flex: 1, display: "flex", flexDirection: "column", animation: `${dir > 0 ? "slideInRight" : "slideInLeft"} 0.32s cubic-bezier(0.25,0.46,0.45,0.94) both`, overflowY: "auto" }}>
            {stepComponents[step]}
          </div>
        </PhoneShell>
        </div>

        {/* Right — data preview */}
        <div style={{ width: 170, display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.4)", letterSpacing: 1.5, marginBottom: 2 }}>PROFILE BUILDING</div>
          {[
            { key: "firstName", label: "Name",   icon: "👤", val: [data.firstName, data.lastName].filter(Boolean).join(" ") },
            { key: "bizName",   label: "Shop",   icon: "🏠", val: data.bizName },
            { key: "bookingHandle", label: "Link", icon: "🔗", val: data.bookingHandle ? `flatpurse.app/${data.bookingHandle}` : null },
            { key: "services",  label: "Services",icon: "✂️", val: data.services ? `${data.services.filter(s=>s.on).length} selected` : null },
            { key: "team",      label: "Team",   icon: "👥", val: data.team ? `${data.team.filter(m=>m.name).length} members` : null },
            { key: "migratedFrom",    label: "Imported",  icon: "📦", val: data.migratedFrom || (data.csvImported ? "CSV upload" : null) },
            { key: "stripeConnected", label: "Payments",  icon: "💳", val: data.stripeConnected ? "Stripe connected" : null },
            { key: "channels",        label: "Channels",  icon: "📡", val: data.channels && Object.keys(data.channels).length > 0 ? `${Object.keys(data.channels).length} connected` : null },
            { key: "autopilot",       label: "AutoPilot", icon: "⚡", val: data.autopilot ? `${data.autopilot.length} flows` : null },
          ].map(row => (
            row.val ? (
              <div key={row.key} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", borderRadius: 9, background: "rgba(83,74,183,0.12)", border: "1px solid rgba(83,74,183,0.2)", animation: "slideInRight 0.3s ease both" }}>
                <span style={{ fontSize: 13 }}>{row.icon}</span>
                <div>
                  <div style={{ fontSize: 9, color: "rgba(255,255,255,0.4)", letterSpacing: 0.8 }}>{row.label.toUpperCase()}</div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#C4B5FD" }}>{row.val}</div>
                </div>
              </div>
            ) : null
          ))}
        </div>
      </div>
    </>
  );
}


// ═══════════════════════════════════════════════════════════════════
// ROOT — switches between Onboarding and App
// ═══════════════════════════════════════════════════════════════════
export default function FlatpurseRoot() {
  const [showApp, setShowApp] = useState(false);
  const [launching, setLaunching] = useState(false);

  const handleLaunch = () => {
    setLaunching(true);
    setTimeout(() => setShowApp(true), 600);
  };

  if (showApp) {
    return (
      <div style={{ animation: "fadeInApp 0.5s ease both" }}>
        <style>{`
          @keyframes fadeInApp { from { opacity:0; transform:scale(0.97); } to { opacity:1; transform:scale(1); } }
        `}</style>
        <FlatpurseApp
          initialTab="home"
          initialSetup={false}
          initialMode="light"
        />
      </div>
    );
  }

  return (
    <>
      {launching && (
        <div style={{ position:"fixed", inset:0, zIndex:9999, background:"#1E1B4B", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", animation:"fadeOut 0.5s ease 0.4s both" }}>
          <style>{`
            @keyframes fadeOut { to { opacity:0; pointer-events:none; } }
            @keyframes logoIn { from { opacity:0; transform:scale(0.6); } to { opacity:1; transform:scale(1); } }
          `}</style>
          <div style={{ animation:"logoIn 0.4s cubic-bezier(0.34,1.56,0.64,1) both" }}>
            <FlatpurseLogo size={64} />
          </div>
          <div style={{ marginTop:18, fontSize:15, fontWeight:700, color:"rgba(255,255,255,0.6)", fontFamily:"'DM Sans',sans-serif" }}>
            Setting up your workspace…
          </div>
        </div>
      )}
      <FlatpurseOnboarding onLaunchApp={handleLaunch} />
    </>
  );
}