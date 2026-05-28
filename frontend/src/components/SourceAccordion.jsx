function SourceAccordion({ chunk, index }) {
  const score = Number(chunk.final_score || 0).toFixed(3);
  const semantic = Number(chunk.semantic_score || 0).toFixed(3);
  const rerank = Number(chunk.rerank_score || 0).toFixed(3);
  const title = chunk.title || "Untitled source";
  const heading = chunk.heading || "No heading";
  const url = chunk.source_url || chunk.metadata?.source_url || "";

  return (
    <details className="group rounded-2xl border border-white/10 bg-ink-900/45 p-4 transition open:border-mint/25">
      <summary className="cursor-pointer list-none">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-white">
              Source {index + 1}: {title}
            </p>
            <p className="mt-1 text-xs text-slate-400">{heading}</p>
          </div>
          <div className="text-right text-[11px] uppercase tracking-[0.25em] text-slate-400">
            <p>score {score}</p>
            <p className="mt-1 text-mint/90">expand</p>
          </div>
        </div>
      </summary>

      <div className="mt-4 space-y-4 border-t border-white/10 pt-4">
        <div className="grid grid-cols-3 gap-2 text-xs text-slate-300">
          <div className="rounded-xl bg-white/5 px-3 py-2">Semantic {semantic}</div>
          <div className="rounded-xl bg-white/5 px-3 py-2">Rerank {rerank}</div>
          <div className="rounded-xl bg-white/5 px-3 py-2">Final {score}</div>
        </div>

        {url ? (
          <a
            className="block break-all text-xs text-cyan-200 underline decoration-cyan-200/30 underline-offset-4 hover:text-cyan-100"
            href={url}
            rel="noreferrer"
            target="_blank"
          >
            {url}
          </a>
        ) : null}

        <pre className="max-h-72 overflow-auto rounded-2xl bg-black/30 p-4 text-xs leading-6 text-slate-200 whitespace-pre-wrap">
          {chunk.document || ""}
        </pre>
      </div>
    </details>
  );
}

export default SourceAccordion;
