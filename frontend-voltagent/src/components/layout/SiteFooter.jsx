export function SiteFooter({ onNavigate }) {
  return (
    <footer className="border-t border-hairline/80 bg-canvas-soft/60">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-8 sm:px-6 lg:px-8 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-semibold text-ink-strong">WebGenius</p>
          <p className="mt-1 text-sm text-body">AI-Powered Website Intelligence Platform.</p>
        </div>
        <div className="flex flex-wrap gap-3 text-sm text-body">
          <button onClick={() => onNavigate("/features")} className="hover:text-ink">Features</button>
          <button onClick={() => onNavigate("/pricing")} className="hover:text-ink">Pricing</button>
          <button onClick={() => onNavigate("/docs")} className="hover:text-ink">Docs</button>
          <button onClick={() => onNavigate("/about")} className="hover:text-ink">About</button>
        </div>
      </div>
    </footer>
  );
}

