import { Card, SectionTitle } from "../components/marketing/MarketingPrimitives";

export function DocsPage() {
  const blocks = [
    ["Quick start", "Use the navigation to explore the public pages and the product story."],
    ["Workflow", "The home page walks through indexing, widget embedding, and retrieval."],
    ["Scope", "Phase 1 stops at the marketing website. No auth or backend wiring."],
  ];
  return (
    <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
      <SectionTitle eyebrow="Documentation" title="Clear product docs for the public site." description="This page serves as the public explanation layer for the website-focused SaaS launch." />
      <div className="mt-8 grid gap-4 lg:grid-cols-3">
        {blocks.map(([title, text]) => (
          <Card key={title} className="p-6">
            <p className="text-sm font-medium text-ink-strong">{title}</p>
            <p className="mt-2 text-sm leading-6 text-body">{text}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}

