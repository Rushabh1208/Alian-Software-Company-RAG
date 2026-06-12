import { Card, SectionTitle } from "../marketing/MarketingPrimitives";

export function DashboardShell({ eyebrow, title, description, children, actions }) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 overflow-hidden lg:flex-row lg:items-end lg:justify-between">
        <SectionTitle eyebrow={eyebrow} title={title} description={description} />
        {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
      </div>
      {children}
    </div>
  );
}

