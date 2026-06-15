import { Card, SectionTitle } from "../components/marketing/MarketingPrimitives";

const featureTiles = [
  { icon: "✦", title: "Clean indexing", text: "Crawl sites, clean content, chunk intelligently, and keep every source traceable." },
  { icon: "◼", title: "Guarded answers", text: "Keep retrieval grounded with settings that shape response behavior." },
  { icon: "▣", title: "Analytics ready", text: "Preview traffic, widget usage, and question patterns with a compact dashboard layer." },
];

export function HomePage({ onNavigate }) {
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <section className="grid gap-10 py-14 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-primary">Website RAG platform</p>
          <h1 className="mt-4 max-w-3xl text-5xl font-semibold tracking-tight text-ink-strong sm:text-6xl">
            Turn any website into a polished RAG experience.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-body">
            WebGenius is a dark-theme, developer-first public site for indexing websites, embedding widgets, and previewing retrieval analytics.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <button onClick={() => onNavigate("/pricing")} className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-on-primary">
              View pricing &rarr;
            </button>
            <button onClick={() => onNavigate("/docs")} className="inline-flex items-center gap-2 rounded-full border border-hairline px-5 py-3 text-sm font-medium text-body">
              Read docs &rarr;
            </button>
          </div>
          <div className="mt-8 flex flex-wrap gap-3 text-sm text-body">
            <span className="rounded-full border border-hairline px-3 py-1.5">No auth</span>
            <span className="rounded-full border border-hairline px-3 py-1.5">No backend coupling</span>
            <span className="rounded-full border border-hairline px-3 py-1.5">Responsive UI</span>
          </div>
        </div>

        <Card className="overflow-hidden">
          <div className="border-b border-hairline px-5 py-4">
            <p className="text-[11px] uppercase tracking-[0.28em] text-mute">Live preview</p>
            <p className="mt-1 text-sm text-ink-strong">Widget + query stack</p>
          </div>
          <div className="grid gap-4 p-5">
            {featureTiles.map(({ icon, title, text }) => (
              <div key={title} className="flex gap-4 rounded-xl border border-hairline bg-canvas px-4 py-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary">
                  {icon}
                </span>
                <div>
                  <p className="font-medium text-ink-strong">{title}</p>
                  <p className="mt-1 text-sm leading-6 text-body">{text}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </section>

      <section className="py-14">
        <SectionTitle eyebrow="Features" title="Everything needed for a serious public SaaS launch." description="A tight public website that explains the product, workflow, value, and pricing without introducing account friction." />
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {["Website indexing workflow", "Embedded widget demo", "Analytics preview"].map((item) => (
            <Card key={item} className="p-5">
              <p className="text-sm font-medium text-ink-strong">{item}</p>
              <p className="mt-2 text-sm leading-6 text-body">Built as reusable sections so the site stays consistent across all pages.</p>
            </Card>
          ))}
        </div>
      </section>

      <section className="grid gap-4 py-14 lg:grid-cols-2">
        <Card className="p-6">
          <p className="text-[11px] uppercase tracking-[0.28em] text-primary">How it works</p>
          <div className="mt-5 space-y-4 text-sm text-body">
            {["Add a site", "Crawl and chunk", "Embed the widget", "Answer with sources"].map((item, index) => (
              <div key={item} className="flex items-center gap-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-full border border-primary/20 bg-primary/10 text-xs font-semibold text-primary">{index + 1}</span>
                <p>{item}</p>
              </div>
            ))}
          </div>
        </Card>
        <Card className="p-6">
          <p className="text-[11px] uppercase tracking-[0.28em] text-primary">Widget demo</p>
          <div className="mt-5 rounded-2xl border border-hairline bg-canvas p-4">
            <div className="flex items-center justify-between border-b border-hairline pb-3">
              <p className="text-sm font-medium text-ink-strong">Ask WebGenius</p>
              <span className="rounded-full border border-primary/20 px-2 py-1 text-[10px] uppercase tracking-[0.25em] text-primary">Active</span>
            </div>
            <div className="mt-4 space-y-3 text-sm text-body">
              <div className="ml-auto max-w-[85%] rounded-2xl bg-primary px-4 py-3 text-on-primary">How do I index my website?</div>
              <div className="max-w-[85%] rounded-2xl border border-hairline bg-canvas-soft px-4 py-3">Add a URL, crawl it, chunk the content, and wire the generated widget into your site.</div>
            </div>
          </div>
        </Card>
      </section>

      <section className="grid gap-4 py-14 lg:grid-cols-[1fr_0.9fr]">
        <Card className="p-6">
          <p className="text-[11px] uppercase tracking-[0.28em] text-primary">Website indexing workflow</p>
          <div className="mt-5 grid gap-3 text-sm text-body">
            {["robots.txt and sitemap discovery", "URL extraction and crawl planning", "Cleaning, chunking, and embeddings", "Collection sync and source traceability"].map((item) => (
              <div key={item} className="flex items-center gap-3 rounded-xl border border-hairline px-4 py-3">
                <span className="text-primary">✓</span>
                <span>{item}</span>
              </div>
            ))}
          </div>
        </Card>
        <Card className="p-6">
          <p className="text-[11px] uppercase tracking-[0.28em] text-primary">RAG workflow</p>
          <div className="mt-5 space-y-4">
            {["Retrieve relevant chunks", "Attach sources and confidence", "Generate a response with context"].map((item, index) => (
              <div key={item} className="flex gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-sm font-semibold text-primary">{index + 1}</div>
                <div>
                  <p className="font-medium text-ink-strong">{item}</p>
                  <p className="mt-1 text-sm text-body">Designed to explain the loop in a way buyers can understand at a glance.</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </section>

      <section className="py-14">
        <SectionTitle eyebrow="Pricing preview" title="Simple tiers, no mystery math." description="The public site presents pricing as a clear purchase decision, not a product tour maze." align="center" />
        <div className="mt-8 grid gap-4 lg:grid-cols-3">
          {[
            ["Starter", "$29", "For demos and lightweight site indexing."],
            ["Growth", "$79", "For teams that want widgets and analytics."],
            ["Scale", "$199", "For high-volume sites and advanced workflows."],
          ].map(([name, price, text]) => (
            <Card key={name} className="p-6">
              <p className="text-sm font-medium text-ink-strong">{name}</p>
              <p className="mt-4 text-4xl font-semibold text-primary">{price}</p>
              <p className="mt-3 text-sm leading-6 text-body">{text}</p>
            </Card>
          ))}
        </div>
      </section>

      <section className="py-14">
        <SectionTitle eyebrow="FAQ" title="Common questions, answered quickly." align="center" />
        <div className="mt-8 grid gap-4 lg:grid-cols-2">
          {[
            ["Does this use authentication?", "No. Phase 1 is a public website only."],
            ["Does it connect to backend APIs?", "No. The site is self-contained and marketing-focused."],
            ["Is the UI dark only?", "Yes. The entire site stays on the WebGenius dark canvas."],
            ["Are dashboard pages included?", "Not in this phase. Public marketing pages only."],
          ].map(([q, a]) => (
            <Card key={q} className="p-5">
              <p className="font-medium text-ink-strong">{q}</p>
              <p className="mt-2 text-sm leading-6 text-body">{a}</p>
            </Card>
          ))}
        </div>
      </section>

      <section className="py-14">
        <Card className="flex flex-col gap-6 px-6 py-8 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.28em] text-primary">Call to action</p>
            <h3 className="mt-3 text-2xl font-semibold text-ink-strong">Launch the public site before the rest of the platform.</h3>
            <p className="mt-2 text-sm leading-6 text-body">This phase gives the project a credible SaaS front door while the dashboard and backend evolve later.</p>
          </div>
          <button onClick={() => onNavigate("/docs")} className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-on-primary">
            Open documentation &rarr;
          </button>
        </Card>
      </section>
    </div>
  );
}
