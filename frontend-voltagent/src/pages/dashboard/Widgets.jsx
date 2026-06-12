import { useEffect, useState } from "react";
import { DashboardShell } from "../../components/dashboard/DashboardShell";
import { Card } from "../../components/marketing/MarketingPrimitives";
import { API_BASE_URL, createWidget, deleteWidget, getWidgets, updateWidget, getWebsites } from "../../lib/api";
import { EmptyState, Skeleton, Toast } from "../../components/ui/Feedback";

const WIDGET_SCRIPT_URL = import.meta.env.VITE_WIDGET_SCRIPT_URL || "";

function buildEmbedSnippet(widget) {
  const apiBaseUrl = API_BASE_URL.replace(/\/+$/, "");
  const widgetScriptUrl = String(
    WIDGET_SCRIPT_URL ||
      widget.scriptUrl ||
      (() => {
        const match = String(widget.script || "").match(/src="([^"]+)"/i);
        return match?.[1] || "";
      })()
  ).trim();
  const attrs = [`data-widget-id="${widget.widgetId}"`, `data-api-base-url="${apiBaseUrl}"`];
  return `<script src="${widgetScriptUrl}" ${attrs.join(" ")}></script>`;
}

export function WidgetsPage() {
  const [widgets, setWidgets] = useState([]);
  const [websites, setWebsites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ collection: "", displayName: "", status: "active" });
  const [toast, setToast] = useState(null);

  const refresh = async () => {
    const [widgetPayload, websitePayload] = await Promise.all([getWidgets(), getWebsites()]);
    setWidgets(widgetPayload.widgets || []);
    setWebsites(websitePayload.websites || []);
  };

  useEffect(() => {
    refresh()
      .catch((e) => setError(e.message || "Failed to load widgets."))
      .finally(() => setLoading(false));
  }, []);

  const showToast = (message, tone = "success") => {
    setToast({ message, tone, id: crypto.randomUUID() });
    window.clearTimeout(showToast.timeoutId);
    showToast.timeoutId = window.setTimeout(() => setToast(null), 2000);
  };

  const handleSave = async () => {
    setBusy(true);
    setError("");
    try {
      const active = widgets.find((item) => item.collection === form.collection);
      if (active) {
        await updateWidget(active.widgetId, form);
        showToast("Widget updated");
      } else {
        await createWidget(form);
        showToast("Widget created");
      }
      setForm({ collection: "", displayName: "", status: "active" });
      await refresh();
    } catch (e) {
      setError(e.message || "Failed to save widget.");
    } finally {
      setBusy(false);
    }
  };

  const handleCopyScript = async (script) => {
    try {
      await navigator.clipboard.writeText(script);
      showToast("Widget script copied");
    } catch {
      showToast("Copy failed", "error");
    }
  };

  const handleDelete = async (widgetId) => {
    try {
      await deleteWidget(widgetId);
      await refresh();
      showToast("Widget deleted");
    } catch (e) {
      setError(e.message || "Failed to delete widget.");
      showToast("Delete failed", "error");
    }
  };

  return (
    <DashboardShell eyebrow="Widgets" title="Widget management" description="Your widgets are private to your account. Each widget gets a unique embed script — paste it on any page to add your chatbot.">
      {error ? <Toast tone="error">{error}</Toast> : null}

      {toast ? (
        <div className="fixed right-4 top-4 z-50">
          <Toast tone={toast.tone === "error" ? "error" : "success"}>{toast.message}</Toast>
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <Card className="space-y-4 p-5">
          <div>
            <p className="text-sm font-medium text-ink-strong">Collection</p>
            <select
              className="mt-2 w-full rounded-xl border border-hairline bg-canvas-soft px-4 py-3 text-sm text-ink outline-none"
              value={form.collection}
              onChange={(e) => setForm((prev) => ({ ...prev, collection: e.target.value }))}
            >
              <option value="">Select Website</option>
              {websites.map((site) => (
                <option key={site.id} value={site.collection_name}>
                  {site.domain || site.collection_name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <p className="text-sm font-medium text-ink-strong">Display Name</p>
            <input
              className="mt-2 w-full rounded-xl border border-hairline bg-canvas-soft px-4 py-3 text-sm text-ink outline-none"
              placeholder="Support Assistant"
              value={form.displayName}
              onChange={(e) => setForm((prev) => ({ ...prev, displayName: e.target.value }))}
            />
          </div>

          <div>
            <p className="text-sm font-medium text-ink-strong">Status</p>
            <select
              className="mt-2 w-full rounded-xl border border-hairline bg-canvas-soft px-4 py-3 text-sm text-ink outline-none"
              value={form.status}
              onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))}
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          <button onClick={handleSave} disabled={busy} className="rounded-full bg-primary px-4 py-3 text-sm font-semibold text-on-primary">
            {busy ? "Saving..." : "Save Widget"}
          </button>
        </Card>

        <Card className="p-5">
          <p className="text-sm font-medium text-ink-strong">Saved Widgets</p>
          <div className="mt-4 space-y-3">
            {loading ? (
              <Skeleton className="h-60" />
            ) : widgets.length ? (
              widgets.map((widget) => (
                <div key={widget.widgetId} className="rounded-2xl border border-hairline bg-canvas px-4 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-ink-strong">{widget.displayName}</p>
                      <p className="mt-1 text-xs text-body">
                        {widget.collection} · {widget.status}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        className="rounded-full border border-hairline px-3 py-1.5 text-xs text-body"
                        onClick={() => setForm({ collection: widget.collection, displayName: widget.displayName, status: widget.status || "active" })}
                      >
                        Edit
                      </button>
                      <button
                        className="rounded-full border border-primary/30 px-3 py-1.5 text-xs text-primary hover:bg-primary/10"
                        onClick={() => handleCopyScript(buildEmbedSnippet(widget))}
                      >
                        Copy Script
                      </button>
                      <button
                        className="rounded-full border border-red-500/30 px-3 py-1.5 text-xs text-red-300"
                        onClick={() => handleDelete(widget.widgetId)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                  <pre className="mt-3 overflow-auto rounded-xl border border-hairline bg-canvas-soft p-3 text-[11px] text-body">
                    {buildEmbedSnippet(widget)}
                  </pre>
                  {buildEmbedSnippet(widget).includes("localhost") && (
                    <p className="mt-2 rounded-xl bg-amber-500/10 border border-amber-500/20 px-3 py-2 text-xs text-amber-600 dark:text-amber-400">
                      ⚠️ This script uses <strong>localhost</strong> — it will only work on your own machine. Set <code>VITE_API_BASE_URL</code> to your deployed backend URL before sharing this script with others.
                    </p>
                  )}
                </div>
              ))
            ) : (
              <EmptyState title="No widgets yet" description="Create your first widget to generate an embed script." />
            )}
          </div>
        </Card>
      </div>
    </DashboardShell>
  );
}