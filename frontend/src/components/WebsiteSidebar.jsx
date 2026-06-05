import { useEffect, useRef, useState } from "react";
import { syncWebsites, getIndexingStatus } from "../lib/api";

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
  const baseActive = !selectedWebsiteId;
  const [statuses, setStatuses] = useState({});
  const pollingRef = useRef(null);

  // Sync ChromaDB ↔ registry on mount (catches manual deletions)
  useEffect(() => {
    syncWebsites()
      .then((res) => {
        if (res?.removed > 0) onWebsitesSync();
      })
      .catch(() => {});
  }, []);

  // Poll status every 3s for collections that are indexing or unknown
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
          try {
            const data = await getIndexingStatus(w.id);
            updates[w.id] = data;
          } catch {}
        })
      );
      setStatuses((prev) => ({ ...prev, ...updates }));
    }, 3000);

    return () => clearInterval(pollingRef.current);
  }, [websites, statuses]);

  return (
    <aside className="sticky top-4 self-start h-full overflow-hidden flex flex-col gap-4 rounded-2xl border border-white/10 bg-gradient-to-b from-white/8 to-white/[0.03] p-4 shadow-glow backdrop-blur-xl">
      {/* ── Chats section ── */}
      <div>
        <div className="flex items-center justify-between gap-2 mb-3">
          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-cyan-300/70 font-bold">💬 Chats</p>
            <h2 className="mt-2 text-lg font-bold text-white">Conversations</h2>
          </div>
          <button
            className="rounded-full border border-mint/40 bg-mint/10 px-3 py-1.5 text-sm text-mint font-semibold transition hover:bg-mint/20 hover:border-mint/60"
            onClick={onNewChat}
            type="button"
          >
            +
          </button>
        </div>
      </div>

      <div className="flex max-h-[32vh] flex-col gap-2 overflow-y-auto pr-1">
        {chats.map((chat) => {
          const active = currentChatId === chat.id;
          return (
            <div
              key={chat.id}
              className={[
                "rounded-2xl border p-3 transition cursor-pointer",
                active
                  ? "border-mint/50 bg-gradient-to-br from-mint/20 to-mint/5 text-white shadow-lg shadow-mint/10"
                  : "border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] hover:border-white/20 hover:bg-white/10",
              ].join(" ")}
            >
              <div className="flex items-start justify-between gap-3">
                <button className="w-full text-left" onClick={() => onSelectChat(chat.id)} type="button">
                  <div>
                    <p className="text-sm font-semibold text-white">
                      {chat.name || new Date(chat.createdAt).toLocaleString()}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">{chat.messages?.length || 0} messages</p>
                  </div>
                </button>
                <button
                  className="rounded-full border border-rose-400/40 bg-rose-400/5 px-2 py-1 text-[11px] font-semibold text-rose-300 transition hover:bg-rose-400/15 hover:border-rose-400/60"
                  onClick={() => onDeleteChat(chat.id)}
                  type="button"
                >
                  ✕
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Collections section ── */}
      <div className="border-t border-white/5 pt-4">
        <p className="text-xs uppercase tracking-[0.4em] text-cyan-300/70 font-bold">📚 Collections</p>
        <h2 className="mt-2 text-lg font-bold text-white">
          Indexed Websites
          <span className="ml-2 text-sm font-normal text-slate-400">
            ({websites.filter((w) => w.id !== baseWebsiteId).length})
          </span>
        </h2>
      </div>

      {/* Base collection */}
      <button
        className={[
          "rounded-2xl border px-4 py-4 text-left transition",
          baseActive
            ? "border-mint/50 bg-gradient-to-br from-mint/20 to-mint/5 text-white shadow-lg shadow-mint/10"
            : "border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] text-slate-200 hover:border-white/20 hover:bg-white/10",
        ].join(" ")}
        onClick={() => onSelectWebsite(null)}
        type="button"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-white">Default Collection</p>
            <p className="mt-1 text-xs text-slate-400">Base knowledge collection</p>
          </div>
          <span className="rounded-full border border-mint/40 bg-mint/10 px-2 py-1 text-[10px] uppercase tracking-[0.25em] text-mint font-bold">
            Base
          </span>
        </div>
      </button>

      {/* Website collections */}
      <div className="flex-1 space-y-3 overflow-y-auto pr-1">
        {websites.filter((item) => item.id !== baseWebsiteId).map((website) => {
          const active = selectedWebsiteId === website.id;
          const progress = statuses[website.id];
          const indexingStatus = progress?.status ?? "unknown";
          const isIndexing = indexingStatus === "indexing";
          const isError = indexingStatus === "error";
          const isDone = indexingStatus === "done";
          const pct =
            progress?.total_batches > 0
              ? Math.round((progress.current_batch / progress.total_batches) * 100)
              : 0;

          return (
            <div
              key={website.id}
              className={[
                "rounded-2xl border p-4 transition cursor-pointer",
                active
                  ? "border-gold/50 bg-gradient-to-br from-gold/20 to-gold/5 shadow-lg shadow-gold/10"
                  : "border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] hover:border-white/20 hover:bg-white/10",
              ].join(" ")}
            >
              <button
                className="w-full text-left"
                onClick={() => onSelectWebsite(website.id)}
                type="button"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white">
                      {website.domain || website.collection_name}
                    </p>
                    <p className="mt-1 break-all text-xs text-slate-400">{website.url}</p>
                  </div>

                  {/* Status badge */}
                  {isIndexing && (
                    <span className="shrink-0 rounded-full border border-yellow-400/40 bg-yellow-400/10 px-2 py-1 text-[10px] uppercase tracking-[0.2em] text-yellow-300 font-bold animate-pulse">
                      Indexing
                    </span>
                  )}
                  {isError && (
                    <span
                      className="shrink-0 rounded-full border border-rose-400/40 bg-rose-400/10 px-2 py-1 text-[10px] uppercase tracking-[0.2em] text-rose-300 font-bold"
                      title={progress?.message}
                    >
                      Error
                    </span>
                  )}
                  {isDone && (
                    <span className="shrink-0 rounded-full border border-gold/40 bg-gold/10 px-2 py-1 text-[10px] uppercase tracking-[0.25em] text-gold font-bold">
                      Site
                    </span>
                  )}
                  {indexingStatus === "unknown" && (
                    <span className="shrink-0 rounded-full border border-white/20 bg-white/5 px-2 py-1 text-[10px] uppercase tracking-[0.2em] text-slate-400 font-bold">
                      …
                    </span>
                  )}
                </div>

                {/* Progress bar — only while indexing */}
                {isIndexing && (
                  <div className="mt-3">
                    <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                      <span>
                        {progress.total_batches > 0
                          ? `Batch ${progress.current_batch}/${progress.total_batches}`
                          : progress.message}
                      </span>
                      <span>{progress.stored_chunks} chunks</span>
                    </div>
                    {progress.total_batches > 0 && (
                      <div className="h-1 w-full rounded-full bg-white/10 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-yellow-400/70 transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* Error message */}
                {isError && progress?.message && (
                  <p className="mt-2 text-[10px] text-rose-400 truncate" title={progress.message}>
                    {progress.message}
                  </p>
                )}
              </button>

              <div className="mt-3 flex items-start justify-between gap-3">
                <span className="min-w-0 text-[11px] uppercase tracking-[0.25em] text-slate-500 font-semibold truncate">
                  {website.collection_name}
                </span>
                <button
                  className="self-start rounded-full border border-rose-400/40 bg-rose-400/5 px-2 py-1 text-[11px] font-semibold text-rose-300 transition hover:bg-rose-400/15 hover:border-rose-400/60"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteWebsite(website.id);
                  }}
                  type="button"
                >
                  ✕
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}

export default WebsiteSidebar;