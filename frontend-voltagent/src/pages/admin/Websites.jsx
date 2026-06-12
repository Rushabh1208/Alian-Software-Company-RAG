import { useEffect, useState } from "react";
import { Card } from "../../components/marketing/MarketingPrimitives";
import { DashboardShell } from "../../components/dashboard/DashboardShell";
import { adminDeleteWebsiteApi, adminReindexWebsiteApi, adminWebsitesApi } from "../../lib/api";
import { EmptyState, Skeleton, Toast } from "../../components/ui/Feedback";

export function AdminWebsitesPage() {
  const [websites, setWebsites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = async () => {
    const payload = await adminWebsitesApi();
    setWebsites(payload.websites || []);
  };

  useEffect(() => {
    refresh().catch((e) => setError(e.message || "Failed to load websites.")).finally(() => setLoading(false));
  }, []);

  return (
    <DashboardShell eyebrow="Websites" title="Website management" description="View all websites, force reindex, delete websites, and monitor status.">
      {error ? <Toast tone="error">{error}</Toast> : null}
      <div className="grid gap-4">
        {loading ? <Skeleton className="h-72" /> : websites.length ? websites.map((site) => (
          <Card key={site.id || site.domain} className="p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-sm font-medium text-ink-strong">{site.domain || site.collection_name}</p>
                <p className="mt-1 text-xs text-body">{site.widgets || 0} widgets · {site.status || "indexed"}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button onClick={async () => { await adminReindexWebsiteApi(site.id || site.collection_name); await refresh(); }} className="rounded-full border border-primary/30 px-4 py-2 text-sm text-primary">Force Reindex</button>
                <button onClick={async () => { await adminDeleteWebsiteApi(site.id || site.collection_name); await refresh(); }} className="rounded-full border border-red-500/30 px-4 py-2 text-sm text-red-300">Delete Website</button>
              </div>
            </div>
            <p className="mt-3 text-xs text-body">Reindex state: {site.reindex || "available"}</p>
          </Card>
        )) : <EmptyState title="No websites" description="All tracked websites will appear here." />}
      </div>
    </DashboardShell>
  );
}
