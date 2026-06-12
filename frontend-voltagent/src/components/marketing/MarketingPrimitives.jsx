export function SectionLabel({ children }) {
  return <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-primary">{children}</p>;
}

export function SectionTitle({ eyebrow, title, description, align = "left" }) {
  return (
    <div className={align === "center" ? "mx-auto max-w-3xl text-center" : "max-w-3xl"}>
      {eyebrow ? <SectionLabel>{eyebrow}</SectionLabel> : null}
      <h2 className="mt-3 text-3xl font-semibold tracking-tight text-ink-strong sm:text-4xl">{title}</h2>
      {description ? <p className="mt-4 text-base leading-7 text-body">{description}</p> : null}
    </div>
  );
}

export function Card({ children, className = "" }) {
  return <div className={`rounded-2xl border border-hairline bg-canvas-soft/70 ${className}`}>{children}</div>;
}

