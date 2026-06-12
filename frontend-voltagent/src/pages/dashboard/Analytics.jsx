import { useEffect, useState } from "react";
import { Card } from "../../components/marketing/MarketingPrimitives";
import { DashboardShell } from "../../components/dashboard/DashboardShell";
import { getUserAnalyticsApi, getDashboardMetricsApi } from "../../lib/api";
import { Skeleton, Toast } from "../../components/ui/Feedback";

// Simple bar chart rendered as SVG
function BarChart({ data = [], valueKey = "queries", labelKey = "label", color = "#00d992" }) {
  if (!data.length) {
    return (
      <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-hairline">
        <p className="text-sm text-mute">No data for this period yet.</p>
      </div>
    );
  }
  const max = Math.max(...data.map((d) => Number(d[valueKey] || 0)), 1);
  const barW = Math.max(8, Math.min(40, Math.floor(520 / data.length) - 8));

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${Math.max(data.length * (barW + 8), 300)} 160`} className="w-full" style={{ minWidth: Math.max(data.length * (barW + 8), 300) }}>
        {data.map((row, i) => {
          const val = Number(row[valueKey] || 0);
          const barH = Math.max(4, Math.round((val / max) * 110));
          const x = i * (barW + 8) + 4;
          const y = 120 - barH;
          return (
            <g key={row.id || i}>
              <rect x={x} y={y} width={barW} height={barH} rx="3" fill={color} opacity="0.85" />
              <text x={x + barW / 2} y="138" textAnchor="middle" fontSize="9" fill="currentColor" className="text-mute" style={{ fill: "#9ca3af" }}>
                {String(row[labelKey] || "").slice(0, 6)}
              </text>
              <text x={x + barW / 2} y={y - 4} textAnchor="middle" fontSize="9" fill={color}>
                {val > 0 ? val : ""}
              </text>
            </g>
          );
        })}
        <line x1="0" y1="122" x2="100%" y2="122" stroke="#374151" strokeWidth="1" />
      </svg>
    </div>
  );
}

function StatCard({ label, value, sub }) {
  return (
    <div className="rounded-2xl border border-hairline bg-canvas-soft/60 p-5">
      <p className="text-sm text-body">{label}</p>
      <p className="mt-3 text-3xl font-semibold text-ink-strong">{value}</p>
      {sub && <p className="mt-1 text-[11px] text-mute">{sub}</p>}
    </div>
  );
}

const PERIODS = ["Daily", "Weekly", "Monthly"];

export function AnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [analytics, setAnalytics] = useState({ daily: [], weekly: [], monthly: [], queriesToday: 0 });
  const [metrics, setMetrics] = useState(null);
  const [period, setPeriod] = useState("Daily");

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    Promise.all([getUserAnalyticsApi(), getDashboardMetricsApi()])
      .then(([analyticsData, metricsData]) => {
        if (!mounted) return;
        setAnalytics(analyticsData);
        setMetrics(metricsData);
      })
      .catch((e) => { if (mounted) setError(e.message || "Failed to load analytics."); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

  const periodData = period === "Daily"
    ? analytics.daily || []
    : period === "Weekly"
    ? analytics.weekly || []
    : analytics.monthly || [];

  const totalQueries = periodData.reduce((s, r) => s + Number(r.queries || 0), 0);
  const totalChats = periodData.reduce((s, r) => s + Number(r.chats || 0), 0);
  const avgQueries = periodData.length ? Math.round(totalQueries / periodData.length) : 0;

  return (
    <DashboardShell
      eyebrow="Analytics"
      title="Analytics overview"
      description="Track your query usage, token consumption, and conversation trends."
    >
      {error ? <Toast tone="error">{error}</Toast> : null}

      {/* Summary stat cards */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Total Queries (all-time)"
            value={(metrics?.totalQueries ?? 0).toLocaleString()}
            sub="Persists even after chat deletion"
          />
          <StatCard
            label="Total Tokens Used"
            value={(metrics?.totalTokens ?? 0).toLocaleString()}
            sub="Estimated across all sessions"
          />
          <StatCard
            label="Queries Today"
            value={(analytics.queriesToday ?? 0).toLocaleString()}
            sub={new Date().toLocaleDateString("en", { weekday: "long", month: "short", day: "numeric" })}
          />
          <StatCard
            label="Active Chats"
            value={(metrics?.totalChats ?? 0).toLocaleString()}
            sub="Conversations in your history"
          />
        </div>
      )}

      {/* Period tabs */}
      <div className="flex flex-wrap gap-2">
        {PERIODS.map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={
              period === p
                ? "rounded-full bg-primary px-4 py-2 text-sm font-semibold text-on-primary"
                : "rounded-full border border-hairline px-4 py-2 text-sm text-body hover:text-ink transition"
            }
          >
            {p}
          </button>
        ))}
      </div>

      {loading ? (
        <Skeleton className="h-80" />
      ) : (
        <>
          {/* Period summary */}
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-hairline bg-canvas-soft/40 px-5 py-4">
              <p className="text-xs text-mute uppercase tracking-widest">Queries ({period})</p>
              <p className="mt-2 text-2xl font-semibold text-ink-strong">{totalQueries.toLocaleString()}</p>
            </div>
            <div className="rounded-2xl border border-hairline bg-canvas-soft/40 px-5 py-4">
              <p className="text-xs text-mute uppercase tracking-widest">Chats ({period})</p>
              <p className="mt-2 text-2xl font-semibold text-ink-strong">{totalChats.toLocaleString()}</p>
            </div>
            <div className="rounded-2xl border border-hairline bg-canvas-soft/40 px-5 py-4">
              <p className="text-xs text-mute uppercase tracking-widest">Avg Queries / {period === "Daily" ? "Day" : period === "Weekly" ? "Week" : "Month"}</p>
              <p className="mt-2 text-2xl font-semibold text-ink-strong">{avgQueries.toLocaleString()}</p>
            </div>
          </div>

          {/* Charts */}
          <div className="grid gap-4 xl:grid-cols-2">
            <Card className="p-5">
              <p className="mb-4 text-sm font-medium text-ink-strong">Query Trends — {period}</p>
              <BarChart data={periodData} valueKey="queries" labelKey="label" color="#00d992" />
            </Card>
            <Card className="p-5">
              <p className="mb-4 text-sm font-medium text-ink-strong">Chat Activity — {period}</p>
              <BarChart data={periodData} valueKey="chats" labelKey="label" color="#6366f1" />
            </Card>
          </div>

          {/* Data table */}
          <Card className="p-5">
            <p className="mb-4 text-sm font-medium text-ink-strong">{period} Breakdown</p>
            {periodData.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-hairline text-left">
                      <th className="pb-3 pr-6 text-xs font-semibold uppercase tracking-widest text-mute">Period</th>
                      <th className="pb-3 pr-6 text-xs font-semibold uppercase tracking-widest text-mute">Queries</th>
                      <th className="pb-3 text-xs font-semibold uppercase tracking-widest text-mute">Chats</th>
                    </tr>
                  </thead>
                  <tbody>
                    {periodData.map((row, i) => (
                      <tr key={row.id || i} className="border-b border-hairline/50 last:border-0 hover:bg-canvas-soft/40 transition">
                        <td className="py-3 pr-6 text-body">{row.label || row.date || row.month || `—`}</td>
                        <td className="py-3 pr-6 font-semibold text-ink-strong">{Number(row.queries || 0).toLocaleString()}</td>
                        <td className="py-3 font-semibold text-ink-strong">{Number(row.chats || 0).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="flex h-24 items-center justify-center rounded-xl border border-dashed border-hairline">
                <p className="text-sm text-mute">
                  No data yet for this period. Start chatting and queries will appear here.
                </p>
              </div>
            )}
          </Card>
        </>
      )}
    </DashboardShell>
  );
}