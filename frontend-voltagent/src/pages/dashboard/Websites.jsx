import { useEffect, useMemo, useState } from "react";
import { Card } from "../../components/marketing/MarketingPrimitives";
import { DashboardShell } from "../../components/dashboard/DashboardShell";
import { getWebsites, indexWebsite, adminReindexWebsiteApi, deleteWebsite } from "../../lib/api";
import { EmptyState, Skeleton, Toast } from "../../components/ui/Feedback";

const statusTones = {
  pending: "bg-mute",
  indexing: "bg-yellow-400",
  indexed: "bg-primary",
  failed: "bg-red-400",
};

export function WebsitesPage() {
  const [websites, setWebsites] = useState([]);
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");

  const refresh = async () => {
    const payload = await getWebsites();
    setWebsites(payload.websites || []);
  };

  useEffect(() => {
    refresh().catch((e) => setError(e.message || "Failed to load websites.")).finally(() => setLoading(false));
    
    const interval = setInterval(refresh, 5000);
    return () => clearInterval(interval);
  }, []);

  const stats = useMemo(() => {
    return {
      pending: websites.filter((item) => item.status === "pending").length,
      indexing: websites.filter((item) => item.status === "indexing").length,
      indexed: websites.filter((item) => item.status === "indexed" || !item.status).length,
      failed: websites.filter((item) => item.status === "failed").length,
    };
  }, [websites]);

  const handleAdd = async () => {
    setActionLoading(true);
    setError("");
    const newUrl = url.trim();
    if (!newUrl) { setActionLoading(false); return; }
    try {
      // Optimistically add placeholder site with indexing status
      const placeholder = {
        id: `tmp-${Date.now()}`,
        domain: newUrl,
        status: "indexing",
        page_count: 0,
      };
      setWebsites((prev) => [...prev, placeholder]);
      setUrl("");
      await indexWebsite(newUrl);
      // Refresh to get updated site list; remove temporary placeholder afterwards
      await refresh();
      setWebsites((prev) => prev.filter((s) => !(s.id && s.id.startsWith("tmp-"))));
    } catch (e) {
      setError(e.message || "Failed to add website.");
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <DashboardShell eyebrow="Websites" title="Website management" description="Create, edit, delete, reindex, and track website status from the backend.">
      {error ? <Toast tone="error">{error}</Toast> : null}
      <div className="grid gap-4 md:grid-cols-4">
        {[
          ["Pending", stats.pending],
          ["Indexing", stats.indexing],
          ["Indexed", stats.indexed],
          ["Failed", stats.failed],
        ].map(([label, value]) => (
          <Card key={label} className="p-4">
            <p className="text-sm text-body">{label}</p>
            <p className="mt-2 text-2xl font-semibold text-ink-strong">{String(value)}</p>
          </Card>
        ))}
      </div>
      <div className="flex flex-wrap gap-3">
        <input className="min-w-72 rounded-full border border-hairline bg-canvas-soft px-4 py-3 text-sm text-ink outline-none placeholder:text-mute" placeholder="https://example.com" value={url} onChange={(e) => setUrl(e.target.value)} />
        <button onClick={handleAdd} className="rounded-full bg-primary px-4 py-3 text-sm font-semibold text-on-primary" disabled={actionLoading}>Add Website</button>
      </div>
      <div className="grid gap-4">
        {loading ? (
          <Skeleton className="h-40" />
        ) : websites.length ? websites.map((site) => (
          <Card key={site.id || site.domain} className="p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-sm font-medium text-ink-strong">{site.domain || site.collection_name}</p>
                <p className="mt-1 text-xs text-body">{site.page_count || 0} pages · Updated {site.updated_at || site.created_at || "recently"}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                  <button onClick={async () => { await deleteWebsite(site.id || site.collection_name); await refresh(); }} className="rounded-full border border-hairline px-4 py-2 text-sm text-body" disabled={actionLoading}>Delete Website</button>
                  <button onClick={async () => { await adminReindexWebsiteApi(site.id || site.collection_name); }} className="rounded-full border border-primary/30 px-4 py-2 text-sm text-primary" disabled={actionLoading}>Reindex Website</button>
              </div>
            </div>
            <div className="mt-4 flex items-center gap-3 text-xs text-body">
              <span className={`h-2.5 w-2.5 rounded-full ${statusTones[site.status || "indexed"] || "bg-primary"}`} />
              Status tracking: {site.status || "indexed"}
            </div>
          </Card>
        )) : <EmptyState title="No websites yet" description="Add a website to begin indexing." />}
      </div>
    </DashboardShell>
  );
}
