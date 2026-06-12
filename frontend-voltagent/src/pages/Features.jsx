import { Card, SectionTitle } from "../components/marketing/MarketingPrimitives";

export function FeaturesPage({ onNavigate }) {
  const items = [
    "Website indexing workflow",
    "Widget demo surfaces",
    "Analytics preview blocks",
    "Pricing previews",
    "Documentation entry points",
    "About and positioning copy",
  ];
  return (
    <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
      <SectionTitle eyebrow="Features" title="Built to explain the product clearly." description="This page expands on the public experience without exposing auth, data, or backend details." />
      <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => (
          <Card key={item} className="p-6">
            <p className="text-sm font-medium text-ink-strong">{item}</p>
            <p className="mt-2 text-sm leading-6 text-body">Each feature is presented in the same dark, precise Voltagent visual language as the home page.</p>
          </Card>
        ))}
      </div>
      <div className="mt-8">
        <button onClick={() => onNavigate("/pricing")} className="rounded-full border border-primary/30 px-5 py-3 text-sm text-primary">See pricing</button>
      </div>
    </div>
  );
}
