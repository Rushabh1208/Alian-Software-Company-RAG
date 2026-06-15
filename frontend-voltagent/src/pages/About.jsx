import { Card, SectionTitle } from "../components/marketing/MarketingPrimitives";

export function AboutPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
      <SectionTitle eyebrow="About" title="A public website built around the WebGenius look and feel." description="The goal is to give the project a credible SaaS face while preserving the dashboard-first dark aesthetic." />
      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        <Card className="p-6">
          <p className="text-sm font-medium text-ink-strong">What this phase includes</p>
          <p className="mt-2 text-sm leading-6 text-body">Home, Features, Pricing, Documentation, and About pages with shared navigation, footer, and responsive layout patterns.</p>
        </Card>
        <Card className="p-6">
          <p className="text-sm font-medium text-ink-strong">What it excludes</p>
          <p className="mt-2 text-sm leading-6 text-body">Authentication, database work, dashboard screens, and backend integration are intentionally out of scope for Phase 1.</p>
        </Card>
      </div>
    </div>
  );
}

