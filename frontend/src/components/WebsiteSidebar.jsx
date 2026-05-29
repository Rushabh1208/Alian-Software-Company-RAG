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
    <aside className="flex h-full flex-col gap-4 rounded-3xl border border-white/10 bg-white/5 p-4 shadow-glow backdrop-blur-xl">
      <div>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-cyan-200/70">Chats</p>
            <h2 className="mt-2 text-lg font-semibold text-white">Conversations</h2>
          </div>
          <button
            className="rounded-full border border-white/10 px-3 py-1 text-sm text-slate-200"
            onClick={onNewChat}
            type="button"
          >
            New
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {chats.map((chat) => {
          const active = currentChatId === chat.id;
          return (
            <div
              key={chat.id}
              className={[
                "rounded-2xl border p-3 transition",
                active
                  ? "border-mint/40 bg-mint/10 text-white"
                  : "border-white/10 bg-ink-900/35 hover:border-white/20 hover:bg-white/10",
              ].join(" ")}
            >
              <div className="flex items-start justify-between gap-3">
                <button className="w-full text-left" onClick={() => onSelectChat(chat.id)} type="button">
                  <div>
                    <p className="text-sm font-medium">{chat.name || new Date(chat.createdAt).toLocaleString()}</p>
                    <p className="mt-1 text-xs text-slate-400">{chat.messages?.length || 0} messages</p>
                  </div>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    className="rounded-full border border-rose-400/30 px-2 py-1 text-[11px] font-medium text-rose-200 transition hover:bg-rose-400/10"
                    onClick={() => onDeleteChat(chat.id)}
                    type="button"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <hr className="my-2 border-white/5" />

      <div>
        <p className="text-xs uppercase tracking-[0.35em] text-cyan-200/70">Indexed websites</p>
        <h2 className="mt-2 text-lg font-semibold text-white">Collections</h2>
      </div>

      <button
        className={[
          "rounded-2xl border px-4 py-4 text-left transition",
          baseActive
            ? "border-mint/40 bg-mint/10 text-white"
            : "border-white/10 bg-ink-900/40 text-slate-200 hover:border-white/20 hover:bg-white/10",
        ].join(" ")}
        onClick={() => onSelectWebsite(null)}
        type="button"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium">Alian Software</p>
            <p className="mt-1 text-xs text-slate-400">Default company collection</p>
          </div>
          <span className="rounded-full border border-mint/30 px-2 py-1 text-[10px] uppercase tracking-[0.25em] text-mint">
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
                "rounded-2xl border p-3 transition",
                active
                  ? "border-gold/40 bg-gold/10"
                  : "border-white/10 bg-ink-900/35 hover:border-white/20 hover:bg-white/10",
              ].join(" ")}
            >
              <button
                className="w-full text-left"
                onClick={() => onSelectWebsite(website.id)}
                type="button"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-white">{website.domain || website.collection_name}</p>
                    <p className="mt-1 break-all text-xs text-slate-400">{website.url}</p>
                  </div>
                  <span className="rounded-full border border-white/10 px-2 py-1 text-[10px] uppercase tracking-[0.25em] text-slate-300">
                    Site
                  </span>
                </div>
              </button>

              <div className="mt-3 flex items-center justify-between gap-3">
                <span className="text-[11px] uppercase tracking-[0.25em] text-slate-500">
                  {website.collection_name}
                </span>
                <button
                  className="rounded-full border border-rose-400/30 px-3 py-1 text-[11px] font-medium text-rose-200 transition hover:bg-rose-400/10"
                  onClick={() => onDeleteWebsite(website.id)}
                  type="button"
                >
                  Delete
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
