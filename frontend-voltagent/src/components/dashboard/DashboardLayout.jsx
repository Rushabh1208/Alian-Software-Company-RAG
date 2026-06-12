const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: "▣" },
  { href: "/dashboard/websites", label: "Websites", icon: "◫" },
  { href: "/dashboard/chat", label: "Chat", icon: "◈" },
  { href: "/dashboard/widgets", label: "Widgets", icon: "◪" },
  { href: "/dashboard/chatbot-settings", label: "Chatbot Settings", icon: "◎" },
  { href: "/dashboard/prompt-settings", label: "Prompt Settings", icon: "✦" },
  { href: "/dashboard/conversations", label: "Conversations", icon: "◉" },
  { href: "/dashboard/analytics", label: "Analytics", icon: "▤" },
  { href: "/dashboard/profile", label: "Profile", icon: "◌" },
];

export function DashboardLayout({ children, currentPath, onNavigate, onLogout, authUser }) {
  return (
    <div className="mx-auto flex min-h-[calc(100vh-1px)] max-w-[1800px]">
      <aside className="hidden w-72 shrink-0 border-r border-hairline bg-canvas-soft/45 lg:block">
        <div className="sticky top-0 flex h-screen flex-col p-4">
          <button onClick={() => onNavigate("/dashboard")} className="flex items-center gap-3 rounded-2xl border border-hairline bg-canvas px-4 py-4 text-left">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">V</div>
            <div>
              <p className="text-sm font-semibold text-ink-strong">Voltagent Dashboard</p>
              <p className="text-xs text-body">Mock SaaS workspace</p>
            </div>
          </button>

          <nav className="mt-4 grid gap-2">
            {navItems.map((item) => {
              const active = currentPath === item.href;
              return (
                <button
                  key={item.href}
                  onClick={() => onNavigate(item.href)}
                  className={[
                    "flex items-center justify-between rounded-xl border px-4 py-3 text-left transition",
                    active ? "border-primary/30 bg-primary/10 text-ink-strong" : "border-hairline bg-canvas text-body hover:text-ink",
                  ].join(" ")}
                >
                  <span className="flex items-center gap-3">
                    <span className={active ? "text-primary" : "text-body"}>{item.icon}</span>
                    <span className="text-sm">{item.label}</span>
                  </span>
                  <span className="text-mute">›</span>
                </button>
              );
            })}
          </nav>

          <div className="mt-auto space-y-3">
            {authUser && (
              <div className="rounded-xl border border-hairline bg-canvas px-4 py-3">
                <p className="text-xs text-mute">Signed in as</p>
                <p className="mt-0.5 truncate text-sm font-medium text-ink-strong">{authUser.email || authUser.name || "User"}</p>
              </div>
            )}
            <button
              onClick={onLogout}
              className="flex w-full items-center gap-3 rounded-xl border border-hairline bg-canvas px-4 py-3 text-left text-sm text-body transition hover:border-red-500/40 hover:bg-red-500/5 hover:text-red-400"
            >
              <span>⎋</span>
              <span>Logout</span>
            </button>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-hairline bg-canvas/90 backdrop-blur-xl lg:hidden">
          <div className="flex items-center justify-between px-4 py-4">
            <button onClick={() => onNavigate("/dashboard")} className="flex items-center gap-3 text-left">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">V</div>
              <div>
                <p className="text-sm font-semibold text-ink-strong">Dashboard</p>
                <p className="text-[11px] text-body">Voltagent</p>
              </div>
            </button>
            <button className="rounded-full border border-hairline px-3 py-2 text-sm text-body" onClick={() => onNavigate("/dashboard/profile")}>Profile</button>
            <button
              onClick={onLogout}
              className="rounded-full border border-hairline px-3 py-2 text-sm text-body hover:border-red-500/40 hover:text-red-400"
            >
              Logout
            </button>
          </div>
        </header>

        <main className="relative flex-1 px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}