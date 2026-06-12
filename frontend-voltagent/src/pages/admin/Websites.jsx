import { useEffect, useMemo, useState } from "react";
import { Card } from "../../components/marketing/MarketingPrimitives";
import { DashboardShell } from "../../components/dashboard/DashboardShell";
import { adminDeleteWebsiteApi, adminReindexWebsiteApi, adminWebsitesApi, listUsersApi } from "../../lib/api";
import { EmptyState, Skeleton, Toast } from "../../components/ui/Feedback";

export function AdminWebsitesPage() {
  const [websites, setWebsites] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = async () => {
    const [websitePayload, userPayload] = await Promise.all([adminWebsitesApi(), listUsersApi()]);
    setWebsites(websitePayload.websites || []);
    setUsers(userPayload.users || []);
  };

  useEffect(() => {
    refresh().catch((e) => setError(e.message || "Failed to load websites.")).finally(() => setLoading(false));
  }, []);

  const usersById = useMemo(() => {
    const map = new Map();
    users.forEach((user) => {
      map.set(String(user.id || ""), user);
    });
    return map;
  }, [users]);

  const groupedWebsites = useMemo(() => {
    const groups = new Map();

    websites.forEach((site) => {
      const ownerId = String(site.owner_user_id || site.ownerId || site.user_id || "");
      const key = ownerId || "__unassigned__";
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key).push(site);
    });

    return Array.from(groups.entries())
      .map(([ownerId, items]) => ({
        ownerId,
        owner: usersById.get(ownerId) || null,
        items: items.sort((left, right) =>
          String(left.domain || left.collection_name || "").localeCompare(String(right.domain || right.collection_name || ""))
        ),
      }))
      .sort((left, right) => {
        const leftLabel = left.owner?.name || left.owner?.email || left.ownerId;
        const rightLabel = right.owner?.name || right.owner?.email || right.ownerId;
        return String(leftLabel).localeCompare(String(rightLabel));
      });
  }, [usersById, websites]);

  return (
    <DashboardShell
      eyebrow="Websites"
      title="Website management"
      description="View websites grouped by owner, force reindex, delete websites, and monitor status."
    >
      {error ? <Toast tone="error">{error}</Toast> : null}
      <div className="grid gap-4">
        {loading ? (
          <Skeleton className="h-72" />
        ) : groupedWebsites.length ? (
          groupedWebsites.map((group) => {
            const ownerLabel =
              group.owner?.name ||
              group.owner?.email ||
              (group.ownerId === "__unassigned__" ? "Unassigned" : group.ownerId);

            return (
              <Card key={group.ownerId} className="p-5">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-hairline pb-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-mute">Owner</p>
                    <h3 className="mt-1 text-base font-semibold text-ink-strong">{ownerLabel}</h3>
                    <p className="mt-1 text-xs text-body">
                      {group.owner?.email || (group.ownerId === "__unassigned__" ? "No owner assigned" : group.ownerId)}
                    </p>
                  </div>
                  <span className="rounded-full border border-hairline px-3 py-1 text-xs text-body">
                    {group.items.length} website{group.items.length !== 1 ? "s" : ""}
                  </span>
                </div>

                <div className="grid gap-3">
                  {group.items.map((site) => {
                    const siteId = site.id || site.collection_name;
                    return (
                      <div key={siteId} className="rounded-2xl border border-hairline bg-canvas px-4 py-4">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                          <div>
                            <p className="text-sm font-medium text-ink-strong">{site.domain || site.collection_name}</p>
                            <p className="mt-1 text-xs text-body">
                              {site.url || site.source_url || site.collection_name} · {site.status || "indexed"}
                            </p>
                            <p className="mt-1 text-[11px] text-mute">
                              Collection: {site.collection_name || site.id || "n/a"}
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <button
                              onClick={async () => {
                                await adminReindexWebsiteApi(siteId);
                                await refresh();
                              }}
                              className="rounded-full border border-primary/30 px-4 py-2 text-sm text-primary"
                            >
                              Force Reindex
                            </button>
                            <button
                              onClick={async () => {
                                await adminDeleteWebsiteApi(siteId);
                                await refresh();
                              }}
                              className="rounded-full border border-red-500/30 px-4 py-2 text-sm text-red-300"
                            >
                              Delete Website
                            </button>
                          </div>
                        </div>
                        <p className="mt-3 text-xs text-body">Reindex state: {site.reindex || "available"}</p>
                      </div>
                    );
                  })}
                </div>
              </Card>
            );
          })
        ) : (
          <EmptyState title="No websites" description="All tracked websites will appear here." />
        )}
      </div>
    </DashboardShell>
  );
}
