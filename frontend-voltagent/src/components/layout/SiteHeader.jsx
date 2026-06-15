export function SiteHeader({ currentPath, navItems, onNavigate, onToggleMenu, menuOpen, authUser, onLogout }) {
  const authButtons = authUser
    ? [
        { label: authUser.role === "Admin" ? "Admin Dashboard" : "Dashboard", href: authUser.role === "Admin" ? "/admin" : "/dashboard" },
        { label: "Logout", action: onLogout },
      ]
    : [
        { label: "Login", href: "/login" },
        { label: "Sign Up", href: "/signup" },
      ];

  return (
    <header className="sticky top-0 z-40 border-b border-hairline/80 bg-canvas/90 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <button onClick={() => onNavigate("/")} className="flex items-center gap-3 text-left">
          <span className="flex h-9 w-9 items-center justify-center rounded-md border border-primary/30 bg-primary/10 text-primary">✦</span>
          <div>
            <p className="text-sm font-semibold text-ink-strong">WebGenius</p>
            <p className="text-[11px] uppercase tracking-[0.28em] text-mute">AI-Powered Website Intelligence Platform</p>
          </div>
        </button>

        <nav className="hidden items-center gap-1 rounded-full border border-hairline bg-canvas-soft/80 p-1 md:flex">
          {navItems.map((item) => (
            <button
              key={item.href}
              onClick={() => onNavigate(item.href)}
              className={[
                "rounded-full px-4 py-2 text-sm transition",
                currentPath === item.href ? "bg-primary text-on-primary" : "text-body hover:text-ink",
              ].join(" ")}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          {authButtons.map((item) =>
            item.action ? (
              <button key={item.label} onClick={item.action} className="rounded-full border border-hairline px-4 py-2 text-sm text-body">
                {item.label}
              </button>
            ) : (
              <button
                key={item.label}
                onClick={() => onNavigate(item.href)}
                className={
                  item.label === "Sign Up"
                    ? "rounded-full bg-primary px-4 py-2 text-sm font-semibold text-on-primary"
                    : "rounded-full border border-hairline px-4 py-2 text-sm text-body"
                }
              >
                {item.label}
              </button>
            ),
          )}
        </div>

        <button onClick={onToggleMenu} className="inline-flex items-center gap-2 rounded-md border border-hairline px-3 py-2 text-sm text-body md:hidden">
          ☰ Menu
        </button>
      </div>

      {menuOpen && (
        <div className="border-t border-hairline bg-canvas-soft md:hidden">
          <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6">
            <div className="grid gap-2">
              {navItems.map((item) => (
                <button key={item.href} onClick={() => onNavigate(item.href)} className="rounded-md border border-hairline px-4 py-3 text-left text-sm text-body">
                  {item.label}
                </button>
              ))}
              {authButtons.map((item) =>
                item.action ? (
                  <button key={item.label} onClick={item.action} className="rounded-md border border-hairline px-4 py-3 text-left text-sm text-body">
                    {item.label}
                  </button>
                ) : (
                  <button
                    key={item.label}
                    onClick={() => onNavigate(item.href)}
                    className={
                      item.label === "Sign Up"
                        ? "rounded-md bg-primary px-4 py-3 text-left text-sm font-semibold text-on-primary"
                        : "rounded-md border border-hairline px-4 py-3 text-left text-sm text-body"
                    }
                  >
                    {item.label}
                  </button>
                ),
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
