function WebsiteSidebar({
  websites,
  selectedWebsiteId,
  onSelectWebsite,
  onDeleteWebsite,
  // chat props
  chats = [],
  currentChatId = null,
  onNewChat = () => {},
  onSelectChat = () => {},
  onDeleteChat = () => {},
}) {
  const baseActive = !selectedWebsiteId;

  return (
    <aside className="sticky top-4 self-start h-full overflow-hidden flex flex-col gap-4 rounded-2xl border border-white/10 bg-gradient-to-b from-white/8 to-white/[0.03] p-4 shadow-glow backdrop-blur-xl">
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
                    <p className="text-sm font-semibold text-white">{chat.name || new Date(chat.createdAt).toLocaleString()}</p>
                    <p className="mt-1 text-xs text-slate-400">{chat.messages?.length || 0} messages</p>
                  </div>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    className="rounded-full border border-rose-400/40 bg-rose-400/5 px-2 py-1 text-[11px] font-semibold text-rose-300 transition hover:bg-rose-400/15 hover:border-rose-400/60"
                    onClick={() => onDeleteChat(chat.id)}
                    type="button"
                  >
                    ✕
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="border-t border-white/5 pt-4">
        <p className="text-xs uppercase tracking-[0.4em] text-cyan-300/70 font-bold">📚 Collections</p>
        <h2 className="mt-2 text-lg font-bold text-white">Indexed Websites</h2>
      </div>

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
            <p className="text-sm font-semibold text-white">Alian Software</p>
            <p className="mt-1 text-xs text-slate-400">Default company collection</p>
          </div>
          <span className="rounded-full border border-mint/40 bg-mint/10 px-2 py-1 text-[10px] uppercase tracking-[0.25em] text-mint font-bold">
            Base
          </span>
        </div>
      </button>

      <div className="flex-1 space-y-3 overflow-y-auto pr-1">
        {websites.filter((item) => item.id !== "alian_software").map((website) => {
          const active = selectedWebsiteId === website.id;

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
                    <p className="text-sm font-semibold text-white">{website.domain || website.collection_name}</p>
                    <p className="mt-1 break-all text-xs text-slate-400">{website.url}</p>
                  </div>
                  <span className="rounded-full border border-gold/40 bg-gold/10 px-2 py-1 text-[10px] uppercase tracking-[0.25em] text-gold font-bold">
                    Site
                  </span>
                </div>
              </button>

              <div className="mt-3 flex items-start justify-between gap-3">
                <span className="min-w-0 text-[11px] uppercase tracking-[0.25em] text-slate-500 font-semibold">
                  {website.collection_name}
                </span>
                <button
                  className="self-start rounded-full border border-rose-400/40 bg-rose-400/5 px-2 py-1 text-[11px] font-semibold text-rose-300 transition hover:bg-rose-400/15 hover:border-rose-400/60"
                  onClick={() => onDeleteWebsite(website.id)}
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
