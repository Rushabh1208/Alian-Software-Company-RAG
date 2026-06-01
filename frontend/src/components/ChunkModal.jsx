import React, { useEffect, useState } from "react";

function ChunkModal({ open, onClose, chunks = [] }) {
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    if (open) {
      setSelected(null);
    }
  }, [open, chunks]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      <div className="relative z-10 max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-2xl bg-white/5 p-4 shadow-xl backdrop-blur-md">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-white">Extracted Chunks</h3>
          <button onClick={onClose} className="text-slate-300">Close</button>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="col-span-1 md:col-span-1 overflow-y-auto max-h-[60vh] pr-2">
            {chunks.length ? (
              chunks.map((c, i) => (
                <button
                  key={c.chunk_id || i}
                  onClick={() => setSelected(c)}
                  className="w-full text-left rounded-xl border border-white/10 bg-white/5 p-3 mb-2 hover:bg-white/10"
                >
                  <p className="text-sm font-semibold text-white">
                    {c.title || c.heading || c.source_url || `Chunk ${i + 1}`}
                  </p>
                  <p className="text-xs text-slate-300 mt-1 truncate">
                    {c.document?.slice(0, 120) || c.metadata?.document?.slice(0, 120) || c.metadata?.text?.slice(0, 120) || ""}
                  </p>
                </button>
              ))
            ) : (
              <div className="rounded-xl border border-dashed border-white/10 p-4 text-sm text-slate-400">No chunks</div>
            )}
          </div>

          <div className="col-span-1 md:col-span-2 overflow-y-auto max-h-[60vh]">
            {selected ? (
              <div>
                <h4 className="text-sm font-semibold text-white mb-2">Chunk Details</h4>
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs text-slate-400">Chunk ID</p>
                  <p className="font-mono text-xs text-white mb-3 break-all">{selected.chunk_id || "n/a"}</p>

                  <p className="text-xs text-slate-400">Source URL</p>
                  <p className="text-sm text-white mb-3">{selected.source_url || selected.metadata?.source_url || "unknown"}</p>

                  {(selected.title || selected.heading) ? (
                    <>
                      <p className="text-xs text-slate-400">Title / Heading</p>
                      <p className="text-sm text-white mb-3">{[selected.title, selected.heading].filter(Boolean).join(" — ")}</p>
                    </>
                  ) : null}

                  <p className="text-xs text-slate-400">Text</p>
                  <pre className="whitespace-pre-wrap text-sm text-slate-200">{selected.document || selected.metadata?.document || selected.metadata?.text || "—"}</pre>

                  {selected.score !== undefined ? (
                    <div className="mt-3">
                      <p className="text-xs text-slate-400">Score</p>
                      <p className="text-sm font-semibold text-white">{String(selected.score)}</p>
                    </div>
                  ) : null}

                  {selected.metadata ? (
                    <div className="mt-3">
                      <p className="text-xs text-slate-400">Metadata</p>
                      <pre className="text-xs text-slate-200 whitespace-pre-wrap">{JSON.stringify(selected.metadata, null, 2)}</pre>
                    </div>
                  ) : null}
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-white/10 p-6 text-sm text-slate-400">
                Select a chunk to view details
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default ChunkModal;
