import { useEffect, useMemo, useState } from "react";
import { Card } from "../../components/marketing/MarketingPrimitives";
import { DashboardShell } from "../../components/dashboard/DashboardShell";
import { deleteUserApi, getUserMetricsApi, listUsersApi, updateUserStatusApi } from "../../lib/api";
import { EmptyState, Skeleton, Toast } from "../../components/ui/Feedback";

function StatBox({ label, value }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-hairline bg-canvas px-3 py-2">
      <span className="text-[11px] uppercase tracking-[0.2em] text-mute">{label}</span>
      <span className="text-sm font-semibold text-ink-strong">{(value ?? 0).toLocaleString()}</span>
    </div>
  );
}

export function AdminUsersPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");

  const [expandedId, setExpandedId] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [metricsLoading, setMetricsLoading] = useState(false);
  const [metricsError, setMetricsError] = useState("");

  const refresh = async () => {
    const payload = await listUsersApi();
    setUsers(payload.users || []);
  };

  useEffect(() => {
    refresh().catch((e) => setError(e.message || "Failed to load users.")).finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => users.filter((user) => `${user.name} ${user.email}`.toLowerCase().includes(search.toLowerCase())), [users, search]);

  const handleToggleExpand = async (user) => {
    const userId = user.id;
    if (expandedId === userId) {
      setExpandedId(null);
      setMetrics(null);
      setMetricsError("");
      return;
    }

    setExpandedId(userId);
    setMetrics(null);
    setMetricsError("");
    setMetricsLoading(true);
    try {
      const payload = await getUserMetricsApi(userId);
      setMetrics(payload);
    } catch (e) {
      setMetricsError(e.message || "Failed to load user details.");
    } finally {
      setMetricsLoading(false);
    }
  };

  return (
    <DashboardShell eyebrow="Users" title="User management" description="View, search, disable, enable, and delete users. Token and query usage is tracked cumulatively.">
      {error ? <Toast tone="error">{error}</Toast> : null}
      <div className="flex flex-wrap gap-3">
        <input
          className="min-w-72 rounded-full border border-hairline bg-canvas-soft px-4 py-3 text-sm text-ink outline-none placeholder:text-mute"
          placeholder="Search users"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button className="rounded-full border border-hairline px-4 py-3 text-sm text-body">View Users</button>
      </div>
      <div className="grid gap-4">
        {loading ? <Skeleton className="h-72" /> : filtered.length ? filtered.map((user) => (
          <Card key={user.id || user.email} className="p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <button
                type="button"
                onClick={() => handleToggleExpand(user)}
                className="flex-1 text-left"
              >
                <div className="flex items-center gap-3">
                  <p className="text-sm font-medium text-ink-strong">{user.name}</p>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${user.status === "active" ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"}`}>
                    {user.status}
                  </span>
                  <span className="text-[11px] text-mute">{expandedId === user.id ? "▲ Hide details" : "▼ View details"}</span>
                </div>
                <p className="mt-1 text-xs text-body">{user.email} · {user.role} · Last login: {user.lastLoginAt || "never"}</p>

                {/* Usage Stats */}
                <div className="mt-3 flex flex-wrap gap-4">
                  <StatBox label="Total Queries" value={user.totalQueries} />
                  <StatBox label="Total Tokens" value={user.totalTokens} />
                </div>
              </button>

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={async () => { await updateUserStatusApi(user.id, "disabled"); await refresh(); }}
                  className="rounded-full border border-hairline px-4 py-2 text-sm text-body hover:border-red-500/30 hover:text-red-400 transition"
                >
                  Disable
                </button>
                <button
                  onClick={async () => { await updateUserStatusApi(user.id, "active"); await refresh(); }}
                  className="rounded-full border border-primary/30 px-4 py-2 text-sm text-primary hover:bg-primary/10 transition"
                >
                  Enable
                </button>
                <button
                  onClick={async () => {
                    await deleteUserApi(user.id);
                    if (expandedId === user.id) {
                      setExpandedId(null);
                      setMetrics(null);
                    }
                    await refresh();
                  }}
                  className="rounded-full border border-red-500/30 px-4 py-2 text-sm text-red-300 hover:bg-red-500/10 transition"
                >
                  Delete
                </button>
              </div>
            </div>

            {expandedId === user.id ? (
              <div className="mt-4 border-t border-hairline pt-4">
                {metricsLoading ? (
                  <Skeleton className="h-32" />
                ) : metricsError ? (
                  <Toast tone="error">{metricsError}</Toast>
                ) : metrics ? (
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-wrap gap-3">
                      <StatBox label="Total Websites" value={metrics.totalWebsites} />
                      <StatBox label="Total Chats" value={metrics.totalChats} />
                      <StatBox label="Total Queries" value={metrics.totalQueries} />
                      <StatBox label="Total Tokens" value={metrics.totalTokens} />
                      <StatBox label="Queries Today" value={metrics.queriesToday} />
                      <StatBox label="Active Widgets" value={metrics.activeWidgets} />
                      <StatBox label="Total Widgets" value={metrics.totalWidgets} />
                    </div>

                    <div className="grid gap-4 lg:grid-cols-2">
                      <div>
                        <p className="mb-2 text-[11px] uppercase tracking-[0.2em] text-mute">Widgets</p>
                        {metrics.widgets?.length ? (
                          <ul className="space-y-2">
                            {metrics.widgets.map((widget) => (
                              <li key={widget.id} className="rounded-xl border border-hairline bg-canvas px-3 py-2 text-xs text-body">
                                <span className="font-medium text-ink-strong">{widget.displayName || widget.id}</span>
                                {" · "}
                                {widget.status}
                                {widget.collection ? ` · ${widget.collection}` : ""}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-xs text-mute">No widgets.</p>
                        )}
                      </div>

                      <div>
                        <p className="mb-2 text-[11px] uppercase tracking-[0.2em] text-mute">Websites</p>
                        {metrics.websites?.length ? (
                          <ul className="space-y-2">
                            {metrics.websites.map((site) => (
                              <li key={site.id || site.collection_name} className="rounded-xl border border-hairline bg-canvas px-3 py-2 text-xs text-body">
                                <span className="font-medium text-ink-strong">{site.name || site.url || site.collection_name || site.id}</span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-xs text-mute">No websites.</p>
                        )}
                      </div>
                    </div>

                    <div>
                      <p className="mb-2 text-[11px] uppercase tracking-[0.2em] text-mute">Recent conversations</p>
                      {metrics.conversations?.length ? (
                        <ul className="space-y-2">
                          {metrics.conversations.slice(0, 5).map((conv) => (
                            <li key={conv.id} className="rounded-xl border border-hairline bg-canvas px-3 py-2 text-xs text-body">
                              <span className="font-medium text-ink-strong">{conv.title}</span>
                              {" · "}
                              {conv.source}
                              {" · "}
                              {conv.updated_at || conv.created_at}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-xs text-mute">No conversations yet.</p>
                      )}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
          </Card>
        )) : <EmptyState title="No users" description="Users will appear here once accounts are created." />}
      </div>
    </DashboardShell>
  );
}