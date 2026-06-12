import { useEffect, useRef, useState } from "react";
import { syncWebsites, getIndexingStatus } from "../lib/api";

function StatusBadge({ status, message }) {
  if (status === "indexing") {
    return (
      <span className="shrink-0 inline-flex items-center gap-1 rounded-full border border-yellow-500/40 bg-yellow-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-eyebrow text-yellow-400 pulse-green">
        <span className="h-1.5 w-1.5 rounded-full bg-yellow-400 inline-block pulse-green" />
        Indexing
      </span>
    );
  }
  if (status === "error") {
    return (
      <span className="shrink-0 inline-flex items-center gap-1 rounded-full border border-red-500/40 bg-red-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-eyebrow text-red-400" title={message}>
        Error
      </span>
    );
  }
  if (status === "done") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-eyebrow text-primary">
        <span className="h-1.5 w-1.5 rounded-full bg-primary inline-block" />
        Live
      </span>
    );
  }
  return (
    <span className="shrink-0 rounded-full border border-hairline px-2 py-0.5 text-[10px] font-semibold uppercase tracking-eyebrow text-mute">
      —
    </span>
  );
}

function WebsiteSidebar({
  websites,
  selectedWebsiteId,
  onSelectWebsite,
  onDeleteWebsite,
  baseWebsiteId = null,
  chats = [],
  currentChatId = null,
  onNewChat = () => {},
  onSelectChat = () => {},
  onDeleteChat = () => {},
  onWebsitesSync = () => {},
}) {
  const [statuses, setStatuses] = useState({});
  const pollingRef = useRef(null);

  useEffect(() => {
    syncWebsites()
      .then((res) => { if (res?.removed > 0) onWebsitesSync(); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (pollingRef.current) clearInterval(pollingRef.current);
    const toPoll = websites.filter((w) => {
      const s = statuses[w.id]?.status;
      return !s || s === "indexing";
    });
    if (toPoll.length === 0) return;

    pollingRef.current = setInterval(async () => {
      const updates = {};
      await Promise.all(
        toPoll.map(async (w) => {
          try { const data = await getIndexingStatus(w.id); updates[w.id] = data; } catch {}
        })
      );
      setStatuses((prev) => ({ ...prev, ...updates }));
    }, 3000);
    return () => clearInterval(pollingRef.current);
  }, [websites, statuses]);

  return (
    <aside className="flex h-full flex-col gap-0 overflow-hidden rounded-md border border-hairline bg-canvas">
      {/* Header */}
      <div className="border-b border-hairline px-5 py-4">
        <p className="text-[11px] font-semibold uppercase tracking-eyebrow text-mute">Navigation</p>
        <h2 className="mt-2 text-base font-semibold text-ink-strong">Workspace</h2>
      </div>

      {/* Chats section */}
      <div className="border-b border-hairline px-5 py-4">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-eyebrow text-mute">Conversations</p>
          <button
            onClick={onNewChat}
            type="button"
            className="flex h-6 w-6 items-center justify-center rounded-sm border border-hairline bg-canvas-soft text-xs font-semibold text-ink transition hover:border-primary/50 hover:text-primary"
            title="New chat"
          >
            +
          </button>
        </div>

        <div className="mt-3 flex max-h-[28vh] flex-col gap-1 overflow-y-auto">
          {chats.length === 0 && (
            <p className="text-xs text-mute">No conversations yet.</p>
          )}
          {chats.map((chat) => {
            const active = currentChatId === chat.id;
            return (
              <div
                key={chat.id}
                className={[
                  "group flex items-center gap-2 rounded-sm px-3 py-2 transition cursor-pointer",
                  active
                    ? "bg-primary/10 border border-primary/30"
                    : "border border-transparent hover:border-hairline hover:bg-canvas-soft",
                ].join(" ")}
              >
                <button
                  className="flex-1 min-w-0 text-left"
                  onClick={() => onSelectChat(chat.id)}
                  type="button"
                >
                  <p className={`truncate text-sm font-medium ${active ? "text-primary" : "text-ink"}`}>
                    {chat.name || "Chat"}
                  </p>
                  <p className="text-[11px] text-mute">{chat.messages?.length || 0} messages</p>
                </button>
                <button
                  className="shrink-0 hidden group-hover:flex items-center justify-center h-5 w-5 rounded-xs border border-hairline text-[10px] text-mute transition hover:border-red-500/40 hover:text-red-400"
                  onClick={() => onDeleteChat(chat.id)}
                  type="button"
                >
                  ✕
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Collections section */}
      <div className="px-5 py-4">
        <p className="text-[11px] font-semibold uppercase tracking-eyebrow text-mute">
          Collections
          <span className="ml-2 text-mute font-normal normal-case tracking-normal">
            ({websites.length})
          </span>
        </p>
      </div>

      {/* Website collections */}
      <div className="flex-1 overflow-y-auto px-3 pb-3">
        <div className="flex flex-col gap-1">
          {websites.map((website) => {
            const active = selectedWebsiteId === website.id;
            const progress = statuses[website.id];
            const indexingStatus = progress?.status ?? "unknown";
            const isIndexing = indexingStatus === "indexing";
            const isError = indexingStatus === "error";
            const pct = progress?.total_batches > 0
              ? Math.round((progress.current_batch / progress.total_batches) * 100)
              : 0;

            return (
              <div
                key={website.id}
                className={[
                  "group rounded-sm border px-3 py-3 transition",
                  active
                    ? "border-primary/40 bg-primary/8"
                    : "border-transparent hover:border-hairline hover:bg-canvas-soft",
                ].join(" ")}
              >
                <button
                  className="w-full text-left"
                  onClick={() => onSelectWebsite(website.id)}
                  type="button"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className={`truncate text-sm font-medium ${active ? "text-primary" : "text-ink"}`}>
                        {website.domain || website.collection_name}
                      </p>
                      <p className="mt-0.5 truncate text-[11px] text-mute">{website.url}</p>
                    </div>
                    <StatusBadge status={indexingStatus} message={progress?.message} />
                  </div>

                  {isIndexing && progress?.total_batches > 0 && (
                    <div className="mt-2">
                      <div className="flex justify-between text-[10px] text-mute mb-1">
                        <span>Batch {progress.current_batch}/{progress.total_batches}</span>
                        <span>{progress.stored_chunks} chunks</span>
                      </div>
                      <div className="h-0.5 w-full rounded-full bg-hairline overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {isError && progress?.message && (
                    <p className="mt-1 text-[10px] text-red-400 truncate">{progress.message}</p>
                  )}
                </button>

                <div className="mt-2 flex items-center justify-between gap-2">
                  <span className="truncate text-[10px] font-mono text-mute">
                    {website.collection_name}
                  </span>
                  <button
                    className="hidden group-hover:flex shrink-0 items-center justify-center h-5 w-5 rounded-xs border border-hairline text-[10px] text-mute transition hover:border-red-500/40 hover:text-red-400"
                    onClick={(e) => { e.stopPropagation(); onDeleteWebsite(website.id); }}
                    type="button"
                  >
                    ✕
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </aside>
  );
}

export default WebsiteSidebar;
