import { Card, SectionTitle } from "../components/marketing/MarketingPrimitives";

export function PricingPage({ onNavigate }) {
  return (
    <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
      <SectionTitle eyebrow="Pricing" title="Straightforward plans for a website-first launch." description="No hidden auth layers, no database story, and no backend integration on this phase." />
      <div className="mt-8 grid gap-4 lg:grid-cols-3">
        {[
          ["Starter", "$29", "For simple public demos and one indexed website."],
          ["Growth", "$79", "For more traffic, widget previews, and analytics storytelling."],
          ["Scale", "$199", "For teams who want a bigger public launch presence."],
        ].map(([name, price, text], index) => (
          <Card key={name} className={index === 1 ? "border-primary/30 p-6" : "p-6"}>
            <p className="text-sm font-medium text-ink-strong">{name}</p>
            <p className="mt-3 text-4xl font-semibold text-primary">{price}</p>
            <p className="mt-3 text-sm leading-6 text-body">{text}</p>
          </Card>
        ))}
      </div>
      <div className="mt-8">
        <button onClick={() => onNavigate("/docs")} className="rounded-full bg-primary px-5 py-3 text-sm font-semibold text-on-primary">Read the docs</button>
      </div>
    </div>
  );
}

