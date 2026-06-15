import { useEffect, useState } from "react";
import { Card } from "../../components/marketing/MarketingPrimitives";
import { DashboardShell } from "../../components/dashboard/DashboardShell";
import { getAdminOverviewApi } from "../../lib/api";
import { Skeleton, Toast } from "../../components/ui/Feedback";

// Platform Analytics Bar Chart
function BarChart({ data = [], valueKey = "queries", labelKey = "label", color = "#00d992" }) {
  if (!data.length) {
    return (
      <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-hairline">
        <p className="text-sm text-mute">No platform data available for this period.</p>
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

const PERIODS = ["Daily", "Monthly"];

export function AdminAnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState(null);
  const [period, setPeriod] = useState("Daily");

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    getAdminOverviewApi()
      .then((payload) => {
        if (mounted) setData(payload);
      })
      .catch((e) => {
        if (mounted) setError(e.message || "Failed to load admin analytics.");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const metrics = data?.metrics || {};
  const periodData = period === "Daily" ? data?.dailyAnalytics || [] : data?.monthlyAnalytics || [];
  const websitesSummary = data?.websitesSummary || [];

  const totalQueries = periodData.reduce((s, r) => s + Number(r.queries || 0), 0);
  const totalChats = periodData.reduce((s, r) => s + Number(r.chats || 0), 0);
  const totalTokens = periodData.reduce((s, r) => s + Number(r.tokens || 0), 0);

  return (
    <DashboardShell
      eyebrow="Platform Metrics"
      title="Admin Analytics"
      description="Monitor platform-wide user activity, API usage, token counts, and collection growth."
    >
      {error ? <Toast tone="error">{error}</Toast> : null}

      {/* Main Stats Grid */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Total Platform Users"
            value={metrics.totalUsers ?? 0}
            sub={`${metrics.activeUsers ?? 0} active in last 30 days`}
          />
          <StatCard
            label="Total Collections"
            value={metrics.totalCollections ?? 0}
            sub={`${metrics.totalWidgets ?? 0} widgets created`}
          />
          <StatCard
            label="Cumulative Queries"
            value={(metrics.totalQueriesAllTime ?? 0).toLocaleString()}
            sub={`${metrics.totalQueriesToday ?? 0} queries today`}
          />
          <StatCard
            label="Cumulative Tokens"
            value={(metrics.totalTokensAllTime ?? 0).toLocaleString()}
            sub={`${(metrics.totalTokensToday ?? 0).toLocaleString()} tokens today`}
          />
        </div>
      )}

      {/* Interval Selector */}
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
            {p} Analytics
          </button>
        ))}
      </div>

      {loading ? (
        <Skeleton className="h-80" />
      ) : (
        <>
          {/* Period totals summary */}
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-hairline bg-canvas-soft/40 px-5 py-4">
              <p className="text-xs text-mute uppercase tracking-widest">Queries in period</p>
              <p className="mt-2 text-2xl font-semibold text-ink-strong">{totalQueries.toLocaleString()}</p>
            </div>
            <div className="rounded-2xl border border-hairline bg-canvas-soft/40 px-5 py-4">
              <p className="text-xs text-mute uppercase tracking-widest">Chats in period</p>
              <p className="mt-2 text-2xl font-semibold text-ink-strong">{totalChats.toLocaleString()}</p>
            </div>
            <div className="rounded-2xl border border-hairline bg-canvas-soft/40 px-5 py-4">
              <p className="text-xs text-mute uppercase tracking-widest">Tokens in period</p>
              <p className="mt-2 text-2xl font-semibold text-primary font-mono">{totalTokens.toLocaleString()}</p>
            </div>
          </div>

          {/* SVG Trends Charts */}
          <div className="grid gap-4 xl:grid-cols-2">
            <Card className="p-5">
              <p className="mb-4 text-sm font-medium text-ink-strong">Global Query Trends — {period}</p>
              <BarChart data={periodData} valueKey="queries" labelKey="label" color="#00d992" />
            </Card>
            <Card className="p-5">
              <p className="mb-4 text-sm font-medium text-ink-strong">Global Token Trends — {period}</p>
              <BarChart data={periodData} valueKey="tokens" labelKey="label" color="#6366f1" />
            </Card>
          </div>

          {/* Collections & Websites Analysis */}
          <Card className="p-5">
            <p className="mb-4 text-sm font-medium text-ink-strong">Ingested Collections & Websites Summary</p>
            {websitesSummary.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-hairline text-left">
                      <th className="pb-3 pr-6 text-xs font-semibold uppercase tracking-widest text-mute">Collection/Domain</th>
                      <th className="pb-3 pr-6 text-xs font-semibold uppercase tracking-widest text-mute">Indexed Pages</th>
                      <th className="pb-3 text-xs font-semibold uppercase tracking-widest text-mute">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {websitesSummary.map((site) => (
                      <tr key={site.id} className="border-b border-hairline/50 last:border-0 hover:bg-canvas-soft/40 transition">
                        <td className="py-3 pr-6 text-body font-mono text-xs">{site.domain || site.id}</td>
                        <td className="py-3 pr-6 font-semibold text-ink-strong">{Number(site.pageCount).toLocaleString()}</td>
                        <td className="py-3">
                          <span className={`rounded-full px-2 py-0.5 text-[10px] uppercase font-semibold ${site.status === "active" ? "bg-green-500/10 text-green-400" : "bg-yellow-500/10 text-yellow-400"}`}>
                            {site.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="flex h-24 items-center justify-center rounded-xl border border-dashed border-hairline">
                <p className="text-sm text-mute">No collections ingested yet.</p>
              </div>
            )}
          </Card>
        </>
      )}
    </DashboardShell>
  );
}
