import { useEffect, useState } from "react";
import { DashboardShell } from "../../components/dashboard/DashboardShell";
import { getAdminOverviewApi } from "../../lib/api";
import { Skeleton } from "../../components/ui/Feedback";

/* ─── number formatter ────────────────────────────────────────────── */
function fmt(n) {
  if (n == null) return "—";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return String(n);
}

/* ─── accent colour map ───────────────────────────────────────────── */
const ACCENT = {
  blue:   { bg: "bg-blue-500/10",   text: "text-blue-400",   border: "hover:border-blue-500/40" },
  green:  { bg: "bg-green-500/10",  text: "text-green-400",  border: "hover:border-green-500/40" },
  purple: { bg: "bg-purple-500/10", text: "text-purple-400", border: "hover:border-purple-500/40" },
  amber:  { bg: "bg-amber-500/10",  text: "text-amber-400",  border: "hover:border-amber-500/40" },
  rose:   { bg: "bg-rose-500/10",   text: "text-rose-400",   border: "hover:border-rose-500/40" },
  teal:   { bg: "bg-teal-500/10",   text: "text-teal-400",   border: "hover:border-teal-500/40" },
  indigo: { bg: "bg-indigo-500/10", text: "text-indigo-400", border: "hover:border-indigo-500/40" },
  sky:    { bg: "bg-sky-500/10",    text: "text-sky-400",    border: "hover:border-sky-500/40" },
};

/* ─── stat card ───────────────────────────────────────────────────── */
function StatCard({ label, value, sub, icon, onClick, accent = "blue" }) {
  const c = ACCENT[accent] || ACCENT.blue;
  return (
    <button
      onClick={onClick}
      className={[
        "group flex flex-col gap-3 rounded-2xl border border-hairline bg-canvas p-5 text-left",
        "transition-all duration-150 hover:-translate-y-0.5 hover:shadow-lg",
        c.border,
      ].join(" ")}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-widest text-mute">{label}</span>
        <span className={`flex h-9 w-9 items-center justify-center rounded-xl text-lg ${c.bg} ${c.text}`}>
          {icon}
        </span>
      </div>
      <p className={`text-4xl font-bold tabular-nums ${c.text}`}>{fmt(value)}</p>
      <div className="flex items-center justify-between">
        <p className="text-xs text-mute">{sub || "\u00a0"}</p>
        <span className={`text-xs opacity-0 transition-opacity group-hover:opacity-100 ${c.text}`}>View →</span>
      </div>
    </button>
  );
}

/* ─── section wrapper ─────────────────────────────────────────────── */
function Section({ title, children }) {
  return (
    <div className="space-y-3">
      <h2 className="text-xs font-semibold uppercase tracking-widest text-mute">{title}</h2>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{children}</div>
    </div>
  );
}

/* ─── main page ───────────────────────────────────────────────────── */
export function AdminOverviewPage({ onNavigate }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    getAdminOverviewApi()
      .then(setData)
      .catch((e) => setError(e?.message || "Failed to load overview"));
  }, []);

  const navigate = onNavigate || ((path) => { window.location.hash = path; });

  if (error) {
    return (
      <DashboardShell eyebrow="Overview" title="Admin overview">
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">
          {error}
        </div>
      </DashboardShell>
    );
  }

  if (!data) {
    return (
      <DashboardShell eyebrow="Overview" title="Admin overview" description="Loading platform stats…">
        <div className="space-y-8">
          {[3, 4, 4].map((cols, si) => (
            <div key={si} className="space-y-3">
              <div className="h-4 w-32 animate-pulse rounded bg-white/5" />
              <div className={`grid gap-4 sm:grid-cols-2 xl:grid-cols-${cols}`}>
                {Array.from({ length: cols }).map((_, i) => (
                  <Skeleton key={i} className="h-36" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </DashboardShell>
    );
  }

  const m = data.metrics || {};

  return (
    <DashboardShell
      eyebrow="Overview"
      title="Admin overview"
      description="Real-time platform snapshot. Click any card to drill in."
    >
      <div className="space-y-8">

        {/* ── USERS ───────────────────────────────────────────────── */}
        <Section title="Users">
          <StatCard
            label="Total Users"
            value={m.totalUsers}
            sub="Registered client accounts"
            icon="👥"
            accent="blue"
            onClick={() => navigate("/admin/users")}
          />
          <StatCard
            label="Active Users"
            value={m.activeUsers}
            sub="Active · logged in within 30 days"
            icon="🟢"
            accent="green"
            onClick={() => navigate("/admin/users")}
          />
          <StatCard
            label="Total Collections"
            value={m.totalCollections}
            sub="Indexed collections across all users"
            icon="🗂️"
            accent="indigo"
            onClick={() => navigate("/admin/websites")}
          />
        </Section>

        {/* ── WIDGETS ─────────────────────────────────────────────── */}
        <Section title="Widgets">
          <StatCard
            label="Total Widgets"
            value={m.totalWidgets}
            sub="All users combined"
            icon="🧩"
            accent="purple"
            onClick={() => navigate("/admin/users")}
          />
          <StatCard
            label="Active Widgets"
            value={m.activeWidgets}
            sub="Status active · owner account enabled"
            icon="✅"
            accent="teal"
            onClick={() => navigate("/admin/users")}
          />
          <StatCard
            label="Queries Today"
            value={m.totalQueriesToday}
            sub="All clients · today"
            icon="🔍"
            accent="amber"
            onClick={() => navigate("/admin/analytics")}
          />
          <StatCard
            label="Tokens Today"
            value={m.totalTokensToday}
            sub="All clients · today"
            icon="⚡"
            accent="rose"
            onClick={() => navigate("/admin/analytics")}
          />
        </Section>

        {/* ── PLATFORM TOTALS ─────────────────────────────────────── */}
        <Section title="Platform totals (all time)">
          <StatCard
            label="Total Queries"
            value={m.totalQueriesAllTime}
            sub="All users ever"
            icon="📊"
            accent="blue"
            onClick={() => navigate("/admin/analytics")}
          />
          <StatCard
            label="Total Tokens Used"
            value={m.totalTokensAllTime}
            sub="Across all accounts"
            icon="🪙"
            accent="amber"
            onClick={() => navigate("/admin/analytics")}
          />

        </Section>

      </div>
    </DashboardShell>
  );
}