export function Toast({ tone = "success", children }) {
  const classes = tone === "error" ? "border-red-500/30 bg-red-500/10 text-red-200" : "border-primary/30 bg-primary/10 text-primary";
  return <div className={`rounded-xl border px-4 py-3 text-sm ${classes}`}>{children}</div>;
}

export function Skeleton({ className = "" }) {
  return <div className={`animate-pulse rounded-xl bg-white/5 ${className}`} />;
}

export function EmptyState({ title, description, action }) {
  return (
    <div className="rounded-2xl border border-hairline bg-canvas-soft p-6 text-center">
      <p className="text-sm font-medium text-ink-strong">{title}</p>
      <p className="mt-2 text-sm text-body">{description}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
