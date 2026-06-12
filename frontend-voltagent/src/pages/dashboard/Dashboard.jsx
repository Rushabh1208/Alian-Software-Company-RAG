import { useEffect, useState } from "react";
import { Card } from "../../components/marketing/MarketingPrimitives";
import { DashboardShell } from "../../components/dashboard/DashboardShell";
import { getDashboardMetricsApi, getConversationsApi, getWidgets, getWebsites } from "../../lib/api";
import { Skeleton, EmptyState, Toast } from "../../components/ui/Feedback";

export function DashboardPage({ onNavigate }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [metrics, setMetrics] = useState(null);
  const [latestConversations, setLatestConversations] = useState([]);
  const [latestWebsites, setLatestWebsites] = useState([]);
  const [widgets, setWidgets] = useState([]);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const [metricPayload, convoPayload, websitePayload, widgetPayload] = await Promise.all([
          getDashboardMetricsApi(),
          getConversationsApi(),
          getWebsites(),
          getWidgets(),
        ]);
        if (!mounted) return;
        setMetrics(metricPayload);
        setLatestConversations((convoPayload.conversations || []).slice(0, 3));
        setLatestWebsites((websitePayload.websites || []).slice(0, 3));
        setWidgets((widgetPayload.widgets || []).slice(0, 3));
      } catch (e) {
        if (mounted) setError(e.message || "Failed to load dashboard.");
      } finally {
        if (mounted) setLoading(false);
      }
    };
    void load();
    return () => { mounted = false; };
  }, []);

  const statCards = [
    {
      label: "Total Websites",
      value: metrics?.totalWebsites ?? 0,
      href: "/dashboard/websites",
      description: "Manage your indexed websites",
    },
    {
      label: "Total Chats",
      value: metrics?.totalChats ?? 0,
      href: "/dashboard/conversations",
      description: "View all conversations",
    },
    {
      label: "Total Queries",
      value: metrics?.totalQueries ?? 0,
      href: "/dashboard/analytics",
      description: "All-time queries (persists after deletion)",
    },
    {
      label: "Total Tokens Used",
      value: (metrics?.totalTokens ?? 0).toLocaleString(),
      href: "/dashboard/analytics",
      description: "Cumulative token consumption",
    },
    {
      label: "Queries Today",
      value: metrics?.queriesToday ?? 0,
      href: "/dashboard/analytics",
      description: "Queries made today",
    },
    {
      label: "Active Widgets",
      value: metrics?.activeWidgets ?? 0,
      href: "/dashboard/widgets",
      description: "Currently active chat widgets",
    },
  ];

  return (
    <DashboardShell eyebrow="Overview" title="Dashboard" description="A live SaaS dashboard backed by backend APIs.">
      {error ? <Toast tone="error">{error}</Toast> : null}

      <div className="grid gap-4 xl:grid-cols-3 2xl:grid-cols-6">
        {loading ? (
          <>
            {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-28" />)}
          </>
        ) : (
          statCards.map(({ label, value, href, description }) => (
            <button
              key={label}
              onClick={() => onNavigate(href)}
              className="group rounded-2xl border border-hairline bg-canvas-soft/60 p-5 text-left transition hover:border-primary/40 hover:bg-primary/5 focus:outline-none"
            >
              <p className="text-sm text-body group-hover:text-primary transition">{label}</p>
              <p className="mt-3 text-3xl font-semibold text-ink-strong">{String(value)}</p>
              <p className="mt-2 text-[11px] text-mute leading-4">{description}</p>
              <p className="mt-2 text-[11px] text-primary/70 group-hover:text-primary transition">View →</p>
            </button>
          ))
        )}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-ink-strong">Latest websites</p>
            <button onClick={() => onNavigate("/dashboard/websites")} className="text-xs text-primary hover:underline">View all →</button>
          </div>
          <div className="mt-4 space-y-3">
            {latestWebsites.length ? latestWebsites.map((item) => (
              <button
                key={item.id || item.collection_name || item.domain}
                onClick={() => onNavigate("/dashboard/websites")}
                className="w-full rounded-xl border border-hairline bg-canvas px-4 py-3 text-left transition hover:border-primary/40 hover:bg-primary/5"
              >
                <div className="flex items-center justify-between">
                  <p className="font-medium text-ink-strong">{item.domain || item.collection_name}</p>
                  <span className="text-xs text-body">{item.status || "active"}</span>
                </div>
                <p className="mt-1 text-xs text-body">{item.page_count || 0} pages</p>
              </button>
            )) : <EmptyState title="No websites yet" description="Add a website to populate dashboard metrics." />}
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-ink-strong">Active widgets</p>
            <button onClick={() => onNavigate("/dashboard/widgets")} className="text-xs text-primary hover:underline">View all →</button>
          </div>
          <div className="mt-4 space-y-3">
            {widgets.length ? widgets.map((item) => (
              <button
                key={item.widgetId}
                onClick={() => onNavigate("/dashboard/widgets")}
                className="w-full rounded-xl border border-hairline bg-canvas px-4 py-3 text-left transition hover:border-primary/40 hover:bg-primary/5"
              >
                <p className="font-medium text-ink-strong">{item.displayName}</p>
                <p className="mt-1 text-xs text-body">{item.status}</p>
              </button>
            )) : <EmptyState title="No widgets found" description="Create a widget to see it here." />}
          </div>
        </Card>
      </div>

      <Card className="p-5">
        <p className="text-sm font-medium text-ink-strong">Recent Activity</p>
        <div className="mt-4 grid gap-3 lg:grid-cols-3">
          {metrics?.recentActivity?.length ? metrics.recentActivity.map((item) => (
            <button
              key={`${item.type}-${item.label}`}
              onClick={() => onNavigate(item.type === "Conversation" ? "/dashboard/conversations" : "/dashboard/widgets")}
              className="rounded-xl border border-hairline bg-canvas px-4 py-4 text-left transition hover:border-primary/40 hover:bg-primary/5"
            >
              <p className="text-xs uppercase tracking-[0.28em] text-primary">{item.type}</p>
              <p className="mt-2 text-sm font-medium text-ink-strong">{item.label}</p>
              <p className="mt-1 text-xs text-body">{item.timestamp}</p>
            </button>
          )) : <EmptyState title="No recent activity" description="Activity will appear here once conversations or widgets change." />}
        </div>
      </Card>

      <Card className="p-5">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-ink-strong">Latest conversations</p>
          <button onClick={() => onNavigate("/dashboard/conversations")} className="text-xs text-primary hover:underline">View all →</button>
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-3">
          {latestConversations.length ? latestConversations.map((item) => (
            <button
              key={item.id}
              onClick={() => onNavigate("/dashboard/conversations")}
              className="rounded-xl border border-hairline bg-canvas px-4 py-4 text-left transition hover:border-primary/40 hover:bg-primary/5"
            >
              <p className="text-sm font-medium text-ink-strong">{item.title}</p>
              <p className="mt-1 text-xs text-body">{item.source || "conversation"} · {item.messages?.length || 0} messages</p>
            </button>
          )) : <EmptyState title="No conversations yet" description="Chat activity appears here once users start asking questions." />}
        </div>
      </Card>
    </DashboardShell>
  );
}