import { useEffect, useState } from "react";
import {
  deleteWebsite,
  getWebsites,
  indexWebsite,
  queryRag,
} from "./lib/api";
import WebsiteSidebar from "./components/WebsiteSidebar";
import SourceAccordion from "./components/SourceAccordion";

const BASE_COLLECTION_ID = "alian_software";

function confidenceTone(confidence = 0) {
  if (confidence >= 0.75) return "text-mint";
  if (confidence >= 0.5) return "text-gold";
  return "text-rose-200";
}

function confidenceLabel(confidenceLabelValue) {
  return confidenceLabelValue || "low";
}

function App() {
  const [websites, setWebsites] = useState([]);
  const [selectedWebsiteId, setSelectedWebsiteId] = useState(null);
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [question, setQuestion] = useState("");

  // Chats: persistent history stored in localStorage
  const [chats, setChats] = useState([]);
  const [currentChatId, setCurrentChatId] = useState(null);

  function loadChatsFromStorage() {
    try {
      const raw = localStorage.getItem("rag_chats");
      const parsed = raw ? JSON.parse(raw) : null;
      if (Array.isArray(parsed) && parsed.length) {
        setChats(parsed);
        setCurrentChatId(parsed[0].id);
        return parsed;
      }
    } catch (e) {
      // ignore
    }

    // create default blank chat
    const defaultChat = {
      id: crypto.randomUUID(),
      name: "Chat",
      websiteId: null,
      createdAt: Date.now(),
      messages: [],
    };

    setChats([defaultChat]);
    setCurrentChatId(defaultChat.id);
    localStorage.setItem("rag_chats", JSON.stringify([defaultChat]));
    return [defaultChat];
  }

  function saveChatsToStorage(nextChats) {
    try {
      localStorage.setItem("rag_chats", JSON.stringify(nextChats));
    } catch (e) {
      console.warn("Failed to save chats", e);
    }
  }
  const [loading, setLoading] = useState(false);
  const [indexing, setIndexing] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    loadChatsFromStorage();
    loadWebsitesFromStorage();
    void refreshWebsites();
  }, []);

  function loadWebsitesFromStorage() {
    try {
      const raw = localStorage.getItem("rag_websites");
      const parsed = raw ? JSON.parse(raw) : null;
      if (Array.isArray(parsed) && parsed.length) {
        setWebsites(parsed);
      }
    } catch (e) {
      // ignore
    }
  }

  function saveWebsitesToStorage(next) {
    try {
      localStorage.setItem("rag_websites", JSON.stringify(next));
    } catch (e) {
      // ignore
    }
  }

  async function refreshWebsites() {
    try {
      const payload = await getWebsites();
      const payloadWebsites = payload.websites || [];
      setWebsites(payloadWebsites);
      saveWebsitesToStorage(payloadWebsites);
      setError("");
    } catch (err) {
      // fallback to cached websites
      setError(err.message || "Failed to load websites.");
    }
  }

  async function handleIndexWebsite(event) {
    event.preventDefault();
    if (!websiteUrl.trim()) return;

    setIndexing(true);
    setError("");
    try {
      const payload = await indexWebsite(websiteUrl.trim());
      setWebsiteUrl("");
      await refreshWebsites();
      if (payload?.website?.id) {
        setSelectedWebsiteId(payload.website.id);
      }
    } catch (err) {
      setError(err.message || "Website indexing failed.");
    } finally {
      setIndexing(false);
    }
  }

  async function handleDeleteWebsite(id) {
    if (!id || id === BASE_COLLECTION_ID) return;
    if (!window.confirm("Delete this indexed website and its collection?")) return;

    setError("");
    try {
      await deleteWebsite(id);
      if (selectedWebsiteId === id) {
        setSelectedWebsiteId(null);
      }
      await refreshWebsites();
    } catch (err) {
      setError(err.message || "Delete failed.");
    }
  }

  async function handleAskQuestion(event) {
    event.preventDefault();
    if (!question.trim() || loading) return;

    const userMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: question.trim(),
      payload: null,
    };

    // append message to current chat
    const updateChatWithMessage = (chatId, message) => {
      setChats((prev) => {
        const next = prev.map((c) => (c.id === chatId ? { ...c, messages: [...c.messages, message] } : c));
        saveChatsToStorage(next);
        return next;
      });
    };

    let currentId = currentChatId || (chats[0] && chats[0].id);
    if (!currentId) {
      const newChat = {
        id: crypto.randomUUID(),
        name: "Chat",
        websiteId: selectedWebsiteId || null,
        createdAt: Date.now(),
        messages: [userMessage],
      };
      currentId = newChat.id;
      setChats((prev) => {
        const next = [newChat, ...prev];
        saveChatsToStorage(next);
        return next;
      });
      setCurrentChatId(newChat.id);
    } else {
      updateChatWithMessage(currentId, userMessage);
    }

    // insert assistant placeholder message for typing/buffering UI
    const placeholderId = crypto.randomUUID();
    const placeholderMessage = {
      id: placeholderId,
      role: "assistant",
      content: "",
      payload: null,
      status: "pending",
    };

    const replaceMessageInChat = (chatId, messageId, newMessage) => {
      setChats((prev) => {
        const next = prev.map((c) => {
          if (c.id !== chatId) return c;
          const messages = c.messages.map((m) => (m.id === messageId ? newMessage : m));
          const updated = { ...c, messages };
          return updated;
        });
        saveChatsToStorage(next);
        return next;
      });
    };

    const appendPlaceholder = (chatId, placeholder) => {
      setChats((prev) => {
        const next = prev.map((c) => (c.id === chatId ? { ...c, messages: [...c.messages, placeholder] } : c));
        saveChatsToStorage(next);
        return next;
      });
    };

    appendPlaceholder(currentId, placeholderMessage);

    setQuestion("");
    setLoading(true);
    setError("");

    const chatId = currentId || (chats[0] && chats[0].id);

    try {
      const payload = await queryRag({
        question: userMessage.content,
        websiteId: selectedWebsiteId || BASE_COLLECTION_ID,
        topK: 5,
      });

      const result = payload.result || payload;
      const assistantMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: String(result.answer || "No answer returned."),
        payload: result,
      };
      if (chatId) replaceMessageInChat(chatId, placeholderId, assistantMessage);
    } catch (err) {
      setError(err.message || "Query failed.");
      const errorMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: `Error: ${err.message || "Query failed."}`,
        payload: null,
      };
      if (chatId) replaceMessageInChat(chatId, placeholderId, errorMessage);
    } finally {
      setLoading(false);
    }
  }

  function handleNewChat() {
    const newChat = {
      id: crypto.randomUUID(),
      name: `Chat ${new Date().toLocaleString()}`,
      websiteId: null,
      createdAt: Date.now(),
      messages: [],
    };
    setChats((prev) => {
      const next = [newChat, ...prev];
      saveChatsToStorage(next);
      return next;
    });
    setCurrentChatId(newChat.id);
  }

  function handleSelectChat(id) {
    setCurrentChatId(id);
  }

  function handleDeleteChat(id) {
    if (!window.confirm("Delete this chat?")) return;
    setChats((prev) => {
      const next = prev.filter((c) => c.id !== id);
      saveChatsToStorage(next);
      if (currentChatId === id) setCurrentChatId(next[0] ? next[0].id : null);
      return next;
    });
  }

  const selectedWebsite = selectedWebsiteId
    ? websites.find((item) => item.id === selectedWebsiteId)
    : null;

  const currentChat = chats.find((c) => c.id === currentChatId) || chats[0] || { messages: [] };

  return (
    <div className="min-h-screen px-4 py-4 text-slate-100 md:px-6 lg:px-8">
      <div className="mx-auto flex h-[calc(100vh-2rem)] max-w-[1600px] flex-col gap-4 overflow-hidden">
        <header className="rounded-[2rem] border border-white/10 bg-white/5 px-5 py-4 shadow-glow backdrop-blur-xl">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.4em] text-cyan-200/70">
                MERN RAG Control Room
              </p>
              <h1 className="mt-2 text-2xl font-semibold text-white md:text-3xl">
                RAG MODEL
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
                Index a website into its own Chroma collection, then query either the default Alian Software corpus or the selected website collection without changing the underlying RAG pipeline.
              </p>
            </div>

            <form className="flex w-full flex-col gap-3 xl:max-w-2xl" onSubmit={handleIndexWebsite}>
              <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-ink-900/40 p-3 md:flex-row">
                <input
                  className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-mint/40"
                  onChange={(event) => setWebsiteUrl(event.target.value)}
                  placeholder="Website URL"
                  value={websiteUrl}
                />
                <button
                  className="rounded-xl bg-gradient-to-r from-mint to-cyan-300 px-5 py-3 text-sm font-semibold text-ink-950 transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={indexing || !websiteUrl.trim()}
                  type="submit"
                >
                  {indexing ? "Indexing..." : "Index Website"}
                </button>
              </div>
            </form>
          </div>
        </header>

        {error ? (
          <div className="rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
            {error}
          </div>
        ) : null}

        <main className="grid flex-1 min-h-0 gap-4 overflow-hidden xl:grid-cols-[320px_1fr]">
          <WebsiteSidebar
            onDeleteWebsite={handleDeleteWebsite}
            onSelectWebsite={setSelectedWebsiteId}
            selectedWebsiteId={selectedWebsiteId}
            websites={websites}
            // chat props
            chats={chats}
            currentChatId={currentChatId}
            onNewChat={handleNewChat}
            onSelectChat={handleSelectChat}
            onDeleteChat={handleDeleteChat}
          />

          <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[2rem] border border-white/10 bg-white/5 shadow-glow backdrop-blur-xl">
            <div className="flex items-center justify-between gap-4 border-b border-white/10 px-5 py-4">
              <div>
                <p className="text-xs uppercase tracking-[0.35em] text-slate-500">Query scope</p>
                <h2 className="mt-1 text-lg font-semibold text-white">
                  {selectedWebsite ? selectedWebsite.domain : "Alian Software"}
                </h2>
                <p className="mt-1 text-xs text-slate-400">
                  {selectedWebsite ? selectedWebsite.collection_name : BASE_COLLECTION_ID}
                </p>
              </div>
              <div className="rounded-full border border-white/10 bg-black/20 px-4 py-2 text-xs text-slate-300">
                {loading ? "Searching..." : "Ready"}
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 md:px-6">
              <div className="space-y-4">
                {currentChat.messages.length ? (
                  currentChat.messages.map((message) => (
                    <MessageCard key={message.id} message={message} />
                  ))
                ) : (
                  <div className="rounded-3xl border border-dashed border-white/10 bg-black/20 p-8 text-center text-sm text-slate-400">
                    Start a chat by asking a question below.
                  </div>
                )}
              </div>
            </div>

            <form className="border-t border-white/10 p-4 md:p-5" onSubmit={handleAskQuestion}>
              <div className="flex flex-col gap-3 rounded-3xl border border-white/10 bg-ink-900/45 p-3 md:flex-row md:items-center">
                <input
                  className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-black/20 px-4 py-4 text-sm text-white outline-none placeholder:text-slate-500 focus:border-mint/40"
                  onChange={(event) => setQuestion(event.target.value)}
                  placeholder="Ask a question about the selected collection..."
                  value={question}
                />
                <button
                  className="rounded-2xl bg-white px-5 py-4 text-sm font-semibold text-ink-950 transition hover:bg-cyan-100 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={loading || !question.trim()}
                  type="submit"
                >
                  {loading ? "Thinking..." : "Ask"}
                </button>
              </div>
            </form>
          </section>
        </main>
      </div>
    </div>
  );
}

function MessageCard({ message }) {
  if (message.role === "user") {
    return (
      <div className="ml-auto max-w-3xl rounded-3xl border border-cyan-300/15 bg-cyan-300/10 px-5 py-4 text-right text-white">
        {message.content}
      </div>
    );
  }

  const result = message.payload || {};
  const confidence = Number(result.confidence || 0);
  const confidenceLabelValue = confidenceLabel(result.confidence_label);
  const sources = Array.isArray(result.chunks) ? result.chunks : [];
  const metrics = result.metrics || {};

  return (
    <div className="max-w-5xl rounded-[1.75rem] border border-white/10 bg-ink-900/50 p-5 shadow-[0_10px_60px_rgba(2,8,23,0.45)]">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <p className="text-xs uppercase tracking-[0.35em] text-cyan-200/70">Answer</p>
          <p className="mt-3 whitespace-pre-wrap text-[15px] leading-7 text-slate-100">
            {message.status === "pending" ? (
              <TypingDots />
            ) : (
              message.content
            )}
          </p>
        </div>

        <div className="grid min-w-[220px] gap-3 rounded-3xl border border-white/10 bg-white/5 p-4 text-sm">
          <Metric
            label="Confidence"
            value={`${confidence.toFixed(2)} / ${confidenceLabelValue}`}
            tone={confidenceTone(confidence)}
          />
          <Metric label="Sources" value={String(sources.length)} />
          <Metric label="Tokens" value={String(metrics.total_tokens || 0)} />
          <Metric label="Latency" value={`${Number(metrics.total_latency_ms || 0).toFixed(0)} ms`} />
        </div>
      </div>

      {result.confidence_factors ? (
        <div className="mt-5 grid gap-3 md:grid-cols-5">
          <FactorCard label="Semantic" value={result.confidence_factors.semantic ?? 0} />
          <FactorCard label="Rerank" value={result.confidence_factors.rerank ?? 0} />
          <FactorCard label="Top score" value={result.confidence_factors.top_score ?? 0} />
          <FactorCard label="Answerability" value={result.confidence_factors.answerability ?? 0} />
          <FactorCard label="Grounding" value={result.confidence_factors.grounding ?? 0} />
        </div>
      ) : null}

      <div className="mt-6">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-[0.35em] text-slate-400">
            Retrieved sources
          </h3>
          <span className="text-xs text-slate-500">{sources.length} chunks</span>
        </div>

        <div className="space-y-3">
          {sources.length ? (
            sources.map((chunk, index) => (
              <SourceAccordion
                key={chunk.chunk_id || index}
                chunk={chunk}
                index={index}
              />
            ))
          ) : (
            <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 px-4 py-5 text-sm text-slate-400">
              No sources were accepted for this response.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TypingDots() {
  const [dots, setDots] = useState("");
  useEffect(() => {
    let i = 0;
    const interval = setInterval(() => {
      i = (i + 1) % 4;
      setDots(".".repeat(i));
    }, 400);
    return () => clearInterval(interval);
  }, []);

  return (
    <span className="inline-block text-lg font-semibold text-slate-200">{`Thinking${dots}`}</span>
  );
}

function Metric({ label, value, tone = "text-white" }) {
  return (
    <div className="rounded-2xl bg-black/20 px-3 py-2">
      <p className="text-[10px] uppercase tracking-[0.3em] text-slate-500">{label}</p>
      <p className={`mt-1 text-sm font-semibold ${tone}`}>{value}</p>
    </div>
  );
}

function FactorCard({ label, value }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
      <p className="text-xs uppercase tracking-[0.3em] text-slate-500">{label}</p>
      <p className="mt-2 text-lg font-semibold text-white">{Number(value || 0).toFixed(1)}%</p>
    </div>
  );
}

export default App;
