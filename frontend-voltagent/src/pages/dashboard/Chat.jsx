import { useEffect, useRef, useState, useCallback } from "react";
import { DashboardShell } from "../../components/dashboard/DashboardShell";
import { queryRag, getWebsites, listChatsApi, createChatApi, updateChatApi, deleteChatApi, addMessageApi } from "../../lib/api";

const BASE_COLLECTION_ID = "alian_software";

// ─── Typing dots ─────────────────────────────────────────────────────────────
function TypingDots() {
  const [dots, setDots] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setDots((d) => (d + 1) % 4), 400);
    return () => clearInterval(iv);
  }, []);
  return (
    <span className="inline-flex items-center gap-1 text-sm text-mute">
      <span className="font-mono">Thinking{".".repeat(dots)}</span>
      <span className="h-3.5 w-px bg-primary animate-pulse" />
    </span>
  );
}

// ─── Chunk Modal ─────────────────────────────────────────────────────────────
function ChunkModal({ open, onClose, chunks = [] }) {
  const [selected, setSelected] = useState(null);
  useEffect(() => { if (open) setSelected(null); }, [open, chunks]);
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 flex w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-hairline bg-canvas shadow-2xl" style={{ maxHeight: "88vh" }}>
        <div className="flex items-center justify-between border-b border-hairline px-6 py-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-mute">Retrieved Context</p>
            <h3 className="mt-1 text-base font-semibold text-ink-strong">
              Source Chunks
              <span className="ml-2 rounded-full border border-hairline px-2 py-0.5 text-[11px] font-normal text-mute">{chunks.length}</span>
            </h3>
          </div>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-xl border border-hairline text-xs text-mute transition hover:border-primary/40 hover:text-primary" type="button">✕</button>
        </div>
        <div className="grid flex-1 min-h-0 gap-0 md:grid-cols-[280px_1fr]">
          <div className="overflow-y-auto border-r border-hairline py-2">
            {chunks.length ? chunks.map((c, i) => (
              <button key={c.chunk_id || i} onClick={() => setSelected(c)}
                className={["w-full border-b border-hairline px-4 py-3 text-left transition last:border-0", selected === c ? "bg-primary/8 border-l-2 border-l-primary" : "hover:bg-canvas-soft"].join(" ")}
                type="button">
                <p className={`text-sm font-medium truncate ${selected === c ? "text-primary" : "text-ink"}`}>{c.title || c.heading || `Chunk ${i + 1}`}</p>
                <p className="text-[11px] text-mute mt-0.5 truncate">{c.source_url || c.metadata?.source_url || ""}</p>
                {c.score !== undefined && <p className="text-[10px] font-mono text-mute mt-0.5">score: {Number(c.score).toFixed(3)}</p>}
              </button>
            )) : <div className="px-4 py-6 text-sm text-mute">No chunks retrieved.</div>}
          </div>
          <div className="overflow-y-auto px-6 py-5">
            {selected ? (
              <div className="space-y-4">
                <div><p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-mute mb-1">Chunk ID</p><p className="font-mono text-xs text-ink break-all">{selected.chunk_id || "n/a"}</p></div>
                <div><p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-mute mb-1">Source URL</p><p className="text-sm text-primary break-all">{selected.source_url || selected.metadata?.source_url || "unknown"}</p></div>
                {(selected.title || selected.heading) && <div><p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-mute mb-1">Title</p><p className="text-sm text-ink">{[selected.title, selected.heading].filter(Boolean).join(" — ")}</p></div>}
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-mute mb-2">Content</p>
                  <div className="rounded-xl border border-hairline bg-canvas-soft p-4"><pre className="whitespace-pre-wrap font-mono text-xs leading-5 text-ink">{selected.document || selected.metadata?.document || selected.metadata?.text || "—"}</pre></div>
                </div>
                {selected.metadata && Object.keys(selected.metadata).length > 0 && (
                  <div><p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-mute mb-2">Metadata</p><div className="rounded-xl border border-hairline bg-canvas-soft p-4"><pre className="whitespace-pre-wrap font-mono text-xs text-mute">{JSON.stringify(selected.metadata, null, 2)}</pre></div></div>
                )}
              </div>
            ) : (
              <div className="flex h-full items-center justify-center">
                <div className="rounded-2xl border border-dashed border-hairline p-8 text-center"><p className="text-sm text-mute">Select a chunk to inspect its content</p></div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Analytics Sidebar ────────────────────────────────────────────────────────
function confidenceColor(c = 0) {
  if (c >= 0.75) return "text-primary";
  if (c >= 0.5) return "text-yellow-400";
  return "text-red-400";
}
function MetricBar({ value, max = 100 }) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  const color = pct >= 70 ? "bg-primary" : pct >= 40 ? "bg-yellow-400" : "bg-red-400";
  return <div className="h-0.5 w-full rounded-full bg-hairline overflow-hidden"><div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} /></div>;
}
function CollapseSection({ title, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-hairline last:border-0">
      <button onClick={() => setOpen(!open)} className="flex w-full items-center justify-between px-5 py-3 text-left transition hover:bg-canvas-soft" type="button">
        <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-mute">{title}</p>
        <span className={`text-[10px] text-mute transition-transform ${open ? "rotate-180" : ""}`}>▼</span>
      </button>
      {open && <div className="px-5 pb-4">{children}</div>}
    </div>
  );
}
function AnalyticsSidebar({ message }) {
  if (!message || message.role === "user") {
    return (
      <aside className="flex h-full flex-col overflow-hidden rounded-2xl border border-hairline bg-canvas">
        <div className="border-b border-hairline px-5 py-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-mute">Query Metrics</p>
          <h2 className="mt-2 text-base font-semibold text-ink-strong">Analytics</h2>
        </div>
        <div className="flex flex-1 flex-col items-center justify-center p-6 text-center">
          <div className="rounded-2xl border border-dashed border-hairline p-6"><p className="text-xs text-mute leading-5">Ask a question to see confidence metrics, token usage, and retrieved sources.</p></div>
        </div>
      </aside>
    );
  }
  const result = message.payload || {};
  const confidence = Number(result.confidence || 0);
  const sources = Array.isArray(result.chunks) ? result.chunks : [];
  const metrics = result.metrics || {};
  const factors = result.confidence_factors || {};
  return (
    <aside className="flex h-full flex-col overflow-hidden rounded-2xl border border-hairline bg-canvas">
      <div className="border-b border-hairline px-5 py-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-mute">Query Metrics</p>
        <h2 className="mt-2 text-base font-semibold text-ink-strong">Analytics</h2>
      </div>
      <div className="flex-1 overflow-y-auto">
        <CollapseSection title="Confidence" defaultOpen>
          <div className="rounded-xl border border-hairline bg-canvas-soft p-3">
            <div className="flex items-end justify-between mb-2">
              <span className="text-[11px] text-mute uppercase tracking-[0.25em]">Score</span>
              <div className="text-right">
                <span className={`text-lg font-semibold font-mono ${confidenceColor(confidence)}`}>{confidence.toFixed(2)}</span>
                <span className="ml-2 rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-primary">{result.confidence_label || "low"}</span>
              </div>
            </div>
            <MetricBar value={confidence * 100} />
          </div>
          {Object.keys(factors).length > 0 && (
            <div className="mt-3 divide-y divide-hairline rounded-xl border border-hairline">
              {Object.entries(factors).map(([k, v]) => (
                <div key={k} className="px-3 py-2">
                  <div className="flex justify-between mb-1"><span className="text-[11px] text-mute capitalize">{k.replace(/_/g, " ")}</span><span className="text-[11px] font-semibold font-mono text-ink">{Number(v).toFixed(1)}%</span></div>
                  <MetricBar value={Number(v)} />
                </div>
              ))}
            </div>
          )}
        </CollapseSection>
        <CollapseSection title="Token Usage">
          <div className="divide-y divide-hairline rounded-xl border border-hairline">
            {[["Input", metrics.input_tokens || 0], ["Output", metrics.output_tokens || 0]].map(([l, v]) => (
              <div key={l} className="flex items-center justify-between py-2 px-3"><span className="text-[11px] text-mute">{l}</span><span className="text-xs font-semibold text-ink">{v}</span></div>
            ))}
            <div className="flex items-center justify-between py-2 px-3"><span className="text-[11px] text-mute">Total</span><span className="text-xs font-semibold text-primary font-mono">{metrics.total_tokens || 0}</span></div>
          </div>
        </CollapseSection>
        <CollapseSection title="Response Time">
          <div className="divide-y divide-hairline rounded-xl border border-hairline">
            <div className="flex items-center justify-between py-2 px-3"><span className="text-[11px] text-mute">Retrieval</span><span className="text-xs font-semibold text-ink">{metrics.retrieval_latency_ms || 0}ms</span></div>
            {Object.keys(metrics).filter((k) => k.endsWith("_ms") && !["retrieval_latency_ms","total_latency_ms"].includes(k)).map((k) => (
              <div key={k} className="flex items-center justify-between py-2 px-3"><span className="text-[11px] text-mute capitalize">{k.replace(/_ms$/, "").replace(/_/g, " ")}</span><span className="text-xs font-semibold text-ink">{metrics[k]}ms</span></div>
            ))}
            <div className="flex items-center justify-between py-2 px-3"><span className="text-[11px] text-mute">Total</span><span className="text-xs font-semibold text-primary font-mono">{metrics.total_latency_ms || 0}ms</span></div>
          </div>
        </CollapseSection>
        {sources.length > 0 && (
          <CollapseSection title={`Sources (${sources.length})`}>
            <div className="flex flex-col gap-2">
              {sources.slice(0, 5).map((src, i) => (
                <div key={src.chunk_id || i} className="rounded-xl border border-hairline p-3">
                  <p className="text-xs font-medium text-ink truncate">{src.title || src.heading || src.source_url || `Chunk ${i + 1}`}</p>
                  {src.score !== undefined && <p className="text-[10px] text-mute font-mono mt-1">score: {Number(src.score).toFixed(3)}</p>}
                </div>
              ))}
            </div>
          </CollapseSection>
        )}
      </div>
    </aside>
  );
}

// ─── Message Card ─────────────────────────────────────────────────────────────
function MessageCard({ message, onOpenChunks }) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-2xl rounded-2xl border border-hairline bg-canvas-soft px-4 py-3">
          <p className="text-sm leading-6 text-ink">{message.content}</p>
        </div>
      </div>
    );
  }
  return (
    <div className="flex justify-start">
      <div className="max-w-4xl w-full rounded-2xl border border-hairline bg-canvas">
        <div className="border-b border-hairline px-4 py-2 flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-primary" />
          <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-mute">Answer</p>
        </div>
        <div className="px-4 py-4">
          {message.status === "pending" ? (
            <TypingDots />
          ) : (
            <p className="whitespace-pre-wrap text-sm leading-7 text-ink">{message.content}</p>
          )}
          {Array.isArray(message.payload?.chunks) && message.payload.chunks.length > 0 && (
            <div className="mt-4 pt-3 border-t border-hairline">
              <button type="button" className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary/70 transition hover:text-primary" onClick={() => onOpenChunks?.(message.payload.chunks)}>
                View {message.payload.chunks.length} source chunks →
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── History Sidebar ──────────────────────────────────────────────────────────
function HistorySidebar({ chats, currentChatId, onSelectChat, onNewChat, onDeleteChat, loading }) {
  return (
    <aside className="flex h-full w-56 shrink-0 flex-col overflow-hidden rounded-2xl border border-hairline bg-canvas">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-hairline px-4 py-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-mute">History</p>
          <h2 className="mt-1 text-sm font-semibold text-ink-strong">Conversations</h2>
        </div>
        <button
          onClick={onNewChat}
          type="button"
          title="New chat"
          disabled={loading}
          className="flex h-7 w-7 items-center justify-center rounded-xl border border-hairline bg-canvas-soft text-sm font-semibold text-ink transition hover:border-primary/50 hover:text-primary disabled:opacity-40"
        >
          +
        </button>
      </div>
      {/* Chat list */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {loading && (
          <p className="px-3 py-4 text-xs text-mute text-center">Loading…</p>
        )}
        {!loading && chats.length === 0 && (
          <p className="px-3 py-4 text-xs text-mute text-center">No conversations yet.</p>
        )}
        {!loading && chats.map((chat) => {
          const active = chat.id === currentChatId;
          return (
            <div
              key={chat.id}
              className={[
                "group flex items-center gap-1 rounded-xl border px-3 py-2.5 transition cursor-pointer",
                active ? "border-primary/40 bg-primary/10" : "border-transparent hover:border-hairline hover:bg-canvas-soft",
              ].join(" ")}
            >
              <button className="flex-1 min-w-0 text-left" onClick={() => onSelectChat(chat.id)} type="button">
                <p className={`truncate text-sm font-medium ${active ? "text-primary" : "text-ink"}`}>
                  {chat.title || chat.name}
                </p>
                <p className="text-[11px] text-mute truncate">{(chat.messages || []).length} messages</p>
              </button>
              <button
                className="hidden group-hover:flex h-5 w-5 shrink-0 items-center justify-center rounded-lg border border-hairline text-[10px] text-mute transition hover:border-red-500/40 hover:text-red-400"
                onClick={() => onDeleteChat(chat.id)}
                type="button"
              >
                ✕
              </button>
            </div>
          );
        })}
      </div>
    </aside>
  );
}

// ─── Main Chat Page ───────────────────────────────────────────────────────────
export function ChatPage() {
  const [websites, setWebsites] = useState([]);
  const [selectedWebsiteId, setSelectedWebsiteId] = useState(null);
  // chats: array of { id, title, messages: [] } — all owned by the current user, loaded from DB
  const [chats, setChats] = useState([]);
  const [currentChatId, setCurrentChatId] = useState(null);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [chatsLoading, setChatsLoading] = useState(true);
  const [error, setError] = useState("");
  const [chunkModalOpen, setChunkModalOpen] = useState(false);
  const [modalChunks, setModalChunks] = useState([]);
  const chatEndRef = useRef(null);

  // ── Load user's chats from DB on mount ─────────────────────────────────────
  useEffect(() => {
    setChatsLoading(true);
    listChatsApi()
      .then((payload) => {
        const loaded = Array.isArray(payload.conversations) ? payload.conversations : [];
        setChats(loaded);
        if (loaded.length > 0) setCurrentChatId(loaded[0].id);
      })
      .catch(() => {
        // If auth fails or network error, start with empty state
        setChats([]);
      })
      .finally(() => setChatsLoading(false));
  }, []);

  useEffect(() => {
    getWebsites().then((payload) => setWebsites(payload.websites || [])).catch(() => {});
  }, []);

  const currentChat = chats.find((c) => c.id === currentChatId) || chats[0] || { messages: [] };

  useEffect(() => {
    requestAnimationFrame(() => {
      chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    });
  }, [currentChat?.messages?.length]);

  const selectedWebsite = websites.find((w) => w.id === selectedWebsiteId) || null;
  const collectionId = selectedWebsite?.collection_name || BASE_COLLECTION_ID;
  const collectionLabel = selectedWebsite?.domain || selectedWebsite?.collection_name || "Default Collection";

  // ── Chat management ────────────────────────────────────────────────────────
  const handleNewChat = useCallback(async () => {
    const title = `Chat ${new Date().toLocaleString("en", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}`;
    try {
      const { conversation } = await createChatApi({ title, source: "Dashboard" });
      setChats((prev) => [conversation, ...prev]);
      setCurrentChatId(conversation.id);
      setSelectedWebsiteId(null);
    } catch (err) {
      setError(err.message || "Failed to create conversation.");
    }
  }, []);

  const handleSelectChat = useCallback((id) => setCurrentChatId(id), []);

  const handleDeleteChat = useCallback(async (id) => {
    if (!window.confirm("Delete this conversation?")) return;
    try {
      await deleteChatApi(id);
      setChats((prev) => {
        const next = prev.filter((c) => c.id !== id);
        if (currentChatId === id) {
          setCurrentChatId(next.length > 0 ? next[0].id : null);
        }
        return next;
      });
    } catch (err) {
      setError(err.message || "Failed to delete conversation.");
    }
  }, [currentChatId]);

  // ── Ask question ───────────────────────────────────────────────────────────
  const handleAsk = async (e) => {
    e.preventDefault();
    if (!question.trim() || loading) return;

    const questionText = question.trim();
    setQuestion("");
    setLoading(true);
    setError("");

    // Determine whether we need to create a new chat first
    let chatId = currentChatId;
    let isNewChat = false;
    if (!chatId) {
      try {
        const title = questionText.slice(0, 38) + (questionText.length > 38 ? "…" : "");
        const { conversation } = await createChatApi({ title, source: "Dashboard" });
        setChats((prev) => [conversation, ...prev]);
        setCurrentChatId(conversation.id);
        chatId = conversation.id;
        isNewChat = true;
      } catch (err) {
        setError(err.message || "Failed to create conversation.");
        setLoading(false);
        return;
      }
    }

    // Optimistic local user message
    const optimisticUserId = `opt_${crypto.randomUUID()}`;
    const placeholderId = `opt_${crypto.randomUUID()}`;
    const userMsgOptimistic = { id: optimisticUserId, role: "user", content: questionText, payload: null };
    const placeholder = { id: placeholderId, role: "assistant", content: "", payload: null, status: "pending" };

    setChats((prev) => prev.map((c) => {
      if (c.id !== chatId) return c;
      const messages = [...(c.messages || []), userMsgOptimistic, placeholder];
      // Auto-rename chat on first real message
      const isFirstMsg = (c.messages || []).length === 0;
      const title = !isNewChat && isFirstMsg
        ? (questionText.slice(0, 38) + (questionText.length > 38 ? "…" : ""))
        : c.title;
      return { ...c, title, messages };
    }));

    try {
      // Persist user message to DB
      const { message: savedUserMsg } = await addMessageApi(chatId, { role: "user", content: questionText });

      // Rename the chat if this is the first message
      const currentChat = chats.find((c) => c.id === chatId);
      if (!isNewChat && (!currentChat?.messages || currentChat.messages.length === 0)) {
        const newTitle = questionText.slice(0, 38) + (questionText.length > 38 ? "…" : "");
        try {
          const { conversation: renamed } = await updateChatApi(chatId, { title: newTitle });
          setChats((prev) => prev.map((c) => c.id === chatId ? { ...c, title: renamed.title } : c));
        } catch {}
      }

      // Replace optimistic user message with saved one
      setChats((prev) => prev.map((c) =>
        c.id !== chatId ? c : {
          ...c,
          messages: c.messages.map((m) => m.id === optimisticUserId ? { ...savedUserMsg, payload: null } : m),
        }
      ));

      // Run RAG query
      const rawPayload = await queryRag({ question: questionText, websiteId: collectionId, topK: 10 });
      const result = rawPayload.result || rawPayload;
      const answerContent = String(result.answer || "No answer returned.");

      // Persist assistant message to DB
      const { message: savedAssistantMsg } = await addMessageApi(chatId, { role: "assistant", content: answerContent });

      // Replace placeholder with final assistant message (keep payload for analytics)
      setChats((prev) => prev.map((c) =>
        c.id !== chatId ? c : {
          ...c,
          messages: c.messages.map((m) =>
            m.id === placeholderId
              ? { ...savedAssistantMsg, payload: result }
              : m
          ),
        }
      ));
    } catch (err) {
      setError(err.message || "Query failed.");
      // Remove the placeholder but keep the optimistic user message visible
      setChats((prev) => prev.map((c) =>
        c.id !== chatId ? c : { ...c, messages: c.messages.filter((m) => m.id !== placeholderId) }
      ));
    } finally {
      setLoading(false);
    }
  };

  const lastMessage = (currentChat?.messages || [])[(currentChat?.messages || []).length - 1] || null;

  return (
    <DashboardShell
      eyebrow="Chat"
      title="Chat with collections"
      description="Ask questions about your indexed collections and inspect retrieved source chunks."
    >
      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/8 px-4 py-3">
          <p className="text-sm text-red-300">{error}</p>
        </div>
      )}

      {/* Collection selector */}
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-sm text-mute shrink-0">Collection:</p>
        <button
          type="button"
          onClick={() => setSelectedWebsiteId(null)}
          className={["rounded-full border px-4 py-2 text-sm font-medium transition", !selectedWebsiteId ? "border-primary/40 bg-primary/10 text-primary" : "border-hairline text-body hover:text-ink"].join(" ")}
        >
          Default
        </button>
        {websites.map((site) => (
          <button
            key={site.id}
            type="button"
            onClick={() => setSelectedWebsiteId(site.id)}
            className={["rounded-full border px-4 py-2 text-sm font-medium transition", selectedWebsiteId === site.id ? "border-primary/40 bg-primary/10 text-primary" : "border-hairline text-body hover:text-ink"].join(" ")}
          >
            {site.domain || site.collection_name}
          </button>
        ))}
      </div>

      {/* Main layout: History | Chat | Analytics */}
      <div className="flex gap-4 h-[calc(100vh-220px)] min-h-[620px]">

        {/* ── Left: History sidebar ── */}
        <HistorySidebar
          chats={chats}
          currentChatId={currentChatId}
          onSelectChat={handleSelectChat}
          onNewChat={handleNewChat}
          onDeleteChat={handleDeleteChat}
          loading={chatsLoading}
        />

        {/* ── Center: Chat panel ── */}
        <div className="flex flex-1 min-w-0 flex-col rounded-2xl border border-hairline bg-canvas overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-hairline px-5 py-3 shrink-0">
            <div className="flex items-center gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-mute">Query Scope</p>
                <h2 className="mt-0.5 text-sm font-semibold text-ink-strong">{collectionLabel}</h2>
              </div>
              <span className="rounded-full border border-hairline px-2 py-0.5 font-mono text-[10px] text-mute">{collectionId}</span>
            </div>
            {loading && (
              <span className="flex items-center gap-1.5 text-[11px] text-mute">
                <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                Searching
              </span>
            )}
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-5 py-5" style={{ scrollBehavior: "smooth" }}>
            <div className="mx-auto max-w-3xl space-y-4">
              {(currentChat?.messages || []).length ? (
                (currentChat.messages || []).map((msg) => (
                  <MessageCard
                    key={msg.id}
                    message={msg}
                    onOpenChunks={(chunks) => { setModalChunks(chunks || []); setChunkModalOpen(true); }}
                  />
                ))
              ) : (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <div className="rounded-2xl border border-dashed border-hairline p-8">
                    <p className="text-sm font-medium text-ink">Start a conversation</p>
                    <p className="mt-1 text-xs text-mute">Ask a question about the selected collection</p>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
          </div>

          {/* Input */}
          <div className="shrink-0 border-t border-hairline px-5 py-4">
            <form onSubmit={handleAsk} className="mx-auto max-w-3xl">
              <div className="flex items-center gap-2 rounded-2xl border border-hairline bg-canvas-soft px-4 py-3 focus-within:border-primary/50 transition">
                <input
                  className="flex-1 min-w-0 bg-transparent text-sm text-ink outline-none placeholder:text-mute"
                  placeholder="Ask a question about the selected collection…"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  disabled={loading}
                />
                <button
                  type="submit"
                  className="shrink-0 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-on-primary transition hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={loading || !question.trim()}
                >
                  {loading ? "…" : "Ask"}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* ── Right: Analytics sidebar ── */}
        <div className="w-60 shrink-0 hidden xl:block h-full">
          <AnalyticsSidebar message={lastMessage} />
        </div>
      </div>

      {/* Chunk Modal */}
      <ChunkModal open={chunkModalOpen} onClose={() => setChunkModalOpen(false)} chunks={modalChunks} />
    </DashboardShell>
  );
}