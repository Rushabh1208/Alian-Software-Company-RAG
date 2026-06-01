import { useState } from "react";
// SourceAccordion removed from sidebar - chunks shown via modal

function confidenceTone(confidence = 0) {
  if (confidence >= 0.75) return "text-mint";
  if (confidence >= 0.5) return "text-gold";
  return "text-rose-200";
}

function Metric({ label, value, tone = "text-white", onClick, isExpanded, children }) {
  return (
    <div className="space-y-2">
      <button
        onClick={onClick}
        className="w-full rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] px-4 py-3 transition hover:border-white/20 text-left"
      >
        <div className="flex items-center justify-between">
          <p className="text-[11px] uppercase tracking-[0.35em] text-slate-400 font-medium">{label}</p>
          <span className={`text-sm text-slate-400 transition ${isExpanded ? "rotate-180" : ""}`}>▼</span>
        </div>
        <p className={`mt-2 text-base font-bold ${tone}`}>{value}</p>
      </button>
      {isExpanded && children}
    </div>
  );
}

function FactorCard({ label, value }) {
  const percent = Number(value || 0).toFixed(1);
  const isHigh = percent >= 70;
  const isMedium = percent >= 40;
  return (
    <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] px-4 py-3 transition hover:border-white/20">
      <div className="flex items-center justify-between gap-2 mb-2">
        <p className="text-xs uppercase tracking-[0.35em] text-slate-400 font-medium">{label}</p>
        <p className="text-sm font-bold text-white">{percent}%</p>
      </div>
      <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${
            isHigh ? "bg-mint" : isMedium ? "bg-gold" : "bg-rose-400"
          }`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

function RightSidebar({ message }) {
  const [expandedMetrics, setExpandedMetrics] = useState({});

  const toggleMetric = (metricName) => {
    setExpandedMetrics((prev) => ({
      ...prev,
      [metricName]: !prev[metricName],
    }));
  };

  if (!message || message.role === "user") {
    return (
      <aside className="sticky top-4 self-start h-full overflow-hidden flex flex-col gap-4 rounded-3xl border border-white/10 bg-gradient-to-b from-white/8 to-white/[0.03] p-5 shadow-glow backdrop-blur-xl">
        <div>
          <p className="text-xs uppercase tracking-[0.4em] text-cyan-300/60 font-bold">Query Metrics</p>
          <h2 className="mt-3 text-xl font-bold text-white">Analytics</h2>
        </div>
        <div className="rounded-3xl border border-dashed border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] p-6 text-center text-sm text-slate-400 mt-4">
          <p className="text-3xl mb-3">✨</p>
          <p className="font-medium">Ask a question to see analytics,</p>
          <p className="text-xs mt-1">confidence metrics & retrieved sources</p>
        </div>
      </aside>
    );
  }

  const result = message.payload || {};
  const confidence = Number(result.confidence || 0);
  const confidenceLabelValue = result.confidence_label || "low";
  const sources = Array.isArray(result.chunks) ? result.chunks : [];
  const metrics = result.metrics || {};

  return (
    <aside className="sticky top-4 self-start h-full overflow-hidden flex flex-col gap-4 rounded-3xl border border-white/10 bg-gradient-to-b from-white/8 to-white/[0.03] p-5 shadow-glow backdrop-blur-xl">
      <div>
        <p className="text-xs uppercase tracking-[0.4em] text-cyan-300/60 font-bold">Query Metrics</p>
        <h2 className="mt-3 text-xl font-bold text-white">Analytics</h2>
      </div>

      <div className="grid gap-3">
        <Metric
          label="Confidence Score"
          value={`${confidence.toFixed(2)} / ${confidenceLabelValue.toUpperCase()}`}
          tone={confidenceTone(confidence)}
          onClick={() => toggleMetric("confidence")}
          isExpanded={expandedMetrics.confidence}
        >
          <div className="mt-2 rounded-xl border border-white/10 bg-white/[0.03] p-3 space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-400">Semantic Match:</span>
              <span className="font-semibold">{(result.confidence_factors?.semantic || 0).toFixed(1)}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Rerank Score:</span>
              <span className="font-semibold">{(result.confidence_factors?.rerank || 0).toFixed(1)}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Top Relevance:</span>
              <span className="font-semibold">{(result.confidence_factors?.top_score || 0).toFixed(1)}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Answerability:</span>
              <span className="font-semibold">{(result.confidence_factors?.answerability || 0).toFixed(1)}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Grounding:</span>
              <span className="font-semibold">{(result.confidence_factors?.grounding || 0).toFixed(1)}%</span>
            </div>
          </div>
        </Metric>

        <Metric
          label="Tokens Used"
          value={String(metrics.total_tokens || 0)}
          onClick={() => toggleMetric("tokens")}
          isExpanded={expandedMetrics.tokens}
        >
          <div className="mt-2 rounded-xl border border-white/10 bg-white/[0.03] p-3 space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-400">Input Tokens:</span>
              <span className="font-semibold">{metrics.input_tokens || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Output Tokens:</span>
              <span className="font-semibold">{metrics.output_tokens || 0}</span>
            </div>
            <div className="flex justify-between border-t border-white/5 pt-2 mt-2">
              <span className="text-slate-300">Total:</span>
              <span className="font-bold text-mint">{metrics.total_tokens || 0}</span>
            </div>
          </div>
        </Metric>

        <Metric
          label="Response Time"
          value={`${Number(metrics.total_latency_ms || 0).toFixed(0)}ms`}
          onClick={() => toggleMetric("latency")}
          isExpanded={expandedMetrics.latency}
        >
          <div className="mt-2 rounded-xl border border-white/10 bg-white/[0.03] p-3 space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-400">Retrieval Time:</span>
              <span className="font-semibold">{metrics.retrieval_latency_ms || 0}ms</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Processing Time:</span>
              <span className="font-semibold">{metrics.processing_latency_ms || 0}ms</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">LLM Time:</span>
              <span className="font-semibold">{metrics.llm_latency_ms || 0}ms</span>
            </div>
            {Object.keys(metrics)
              .filter((k) => k.endsWith("_ms") && !["retrieval_latency_ms", "processing_latency_ms", "llm_latency_ms", "total_latency_ms"].includes(k))
              .map((k) => (
                <div className="flex justify-between" key={k}>
                  <span className="text-slate-400">{k.replace(/_/g, ' ')}:</span>
                  <span className="font-semibold">{metrics[k]}ms</span>
                </div>
              ))}
            <div className="flex justify-between border-t border-white/5 pt-2 mt-2">
              <span className="text-slate-300">Total:</span>
              <span className="font-bold text-mint">{metrics.total_latency_ms || 0}ms</span>
            </div>
          </div>
        </Metric>
      </div>
   
    </aside>
  );
}

export default RightSidebar;
