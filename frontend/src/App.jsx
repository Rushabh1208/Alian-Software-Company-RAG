import { useEffect, useState } from "react";
import {
  createWidget,
  deleteWebsite,
  getPromptSettings,
  getWebsites,
  getWidgets,
  indexWebsite,
  resetPromptSettings,
  queryRag,
  updatePromptSettings,
  updateWidget,
} from "./lib/api";
import WebsiteSidebar from "./components/WebsiteSidebar";
import RightSidebar from "./components/RightSidebar";
import ChunkModal from "./components/ChunkModal";
import PromptSettingsModal from "./components/PromptSettingsModal";

const BASE_COLLECTION_ID = "alian_software";
const DEFAULT_COLLECTION_LABEL = "Default Collection";
const DEFAULT_PROMPT_SETTINGS = {
  role: "You are a retrieval-augmented QA assistant.",
  constraints: [],
};

function App() {
  const [websites, setWebsites] = useState([]);
  const [selectedWebsiteId, setSelectedWebsiteId] = useState(null);
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [question, setQuestion] = useState("");
  const [widgets, setWidgets] = useState([]);
  const [widgetCollectionName, setWidgetCollectionName] = useState(BASE_COLLECTION_ID);
  const [widgetStatus, setWidgetStatus] = useState("active");
  const [widgetModalOpen, setWidgetModalOpen] = useState(false);
  const [widgetBusy, setWidgetBusy] = useState(false);
  const [widgetMessage, setWidgetMessage] = useState("");
  const [widgetCopied, setWidgetCopied] = useState(false);

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
  const [chunkModalOpen, setChunkModalOpen] = useState(false);
  const [modalChunks, setModalChunks] = useState([]);
  const [promptSettings, setPromptSettings] = useState(DEFAULT_PROMPT_SETTINGS);
  const [promptSettingsOpen, setPromptSettingsOpen] = useState(false);
  const [promptSettingsSaving, setPromptSettingsSaving] = useState(false);
  const [promptSettingsResetting, setPromptSettingsResetting] = useState(false);

  useEffect(() => {
    loadChatsFromStorage();
    loadWebsitesFromStorage();
    void loadPromptSettings();
    void refreshWebsites();
    void refreshWidgets();
  }, []);

  async function loadPromptSettings() {
    try {
      const payload = await getPromptSettings();
      setPromptSettings({
        role: String(payload?.role || DEFAULT_PROMPT_SETTINGS.role),
        constraints: Array.isArray(payload?.constraints) ? payload.constraints : [],
      });
    } catch (err) {
      setPromptSettings(DEFAULT_PROMPT_SETTINGS);
      console.warn("Failed to load prompt settings", err);
    }
  }

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

  async function refreshWidgets() {
    try {
      const payload = await getWidgets();
      const payloadWidgets = Array.isArray(payload?.widgets) ? payload.widgets : [];
      setWidgets(payloadWidgets);
      setWidgetMessage("");
    } catch (err) {
      setWidgets([]);
      setWidgetMessage(err.message || "Widget controls are unavailable right now.");
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
      await refreshWidgets();
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
      await refreshWidgets();
    } catch (err) {
      setError(err.message || "Delete failed.");
    }
  }

  function handleCopyWidgetScript(script) {
    if (!script) return;

    const writeText = navigator.clipboard?.writeText;
    if (!writeText) {
      setWidgetMessage("Clipboard access is not available in this browser.");
      return;
    }

    writeText
      .call(navigator.clipboard, script)
      .then(() => {
        setWidgetCopied(true);
        window.setTimeout(() => setWidgetCopied(false), 1800);
      })
      .catch((err) => {
        setWidgetMessage(err.message || "Failed to copy widget script.");
      });
  }

  async function handleGenerateWidget() {
    const targetCollection = widgetCollectionName || BASE_COLLECTION_ID;
    const targetWebsite = websites.find((item) => item.collection_name === targetCollection);
    const displayName = targetWebsite?.domain || targetWebsite?.collection_name || DEFAULT_COLLECTION_LABEL;

    setWidgetBusy(true);
    setWidgetMessage("");
    try {
      if (activeWidget?.widgetId) {
        await updateWidget(activeWidget.widgetId, {
          collection: targetCollection,
          displayName,
          status: widgetStatus,
        });
      } else {
        await createWidget({
          collection: targetCollection,
          displayName,
          status: widgetStatus,
        });
      }
      await refreshWidgets();
      setWidgetCopied(false);
    } catch (err) {
      setWidgetMessage(err.message || "Failed to generate widget.");
    } finally {
      setWidgetBusy(false);
    }
  }

  async function handleSavePromptSettings(nextSettings) {
    setPromptSettingsSaving(true);
    setError("");
    try {
      const payload = await updatePromptSettings(nextSettings);
      setPromptSettings({
        role: String(payload?.role || DEFAULT_PROMPT_SETTINGS.role),
        constraints: Array.isArray(payload?.constraints) ? payload.constraints : [],
      });
      setPromptSettingsOpen(false);
    } catch (err) {
      setError(err.message || "Failed to save prompt settings.");
    } finally {
      setPromptSettingsSaving(false);
    }
  }

  async function handleResetPromptSettings() {
    setPromptSettingsResetting(true);
    setError("");
    try {
      const payload = await resetPromptSettings();
      setPromptSettings({
        role: String(payload?.role || DEFAULT_PROMPT_SETTINGS.role),
        constraints: Array.isArray(payload?.constraints) ? payload.constraints : [],
      });
      setPromptSettingsOpen(false);
    } catch (err) {
      setError(err.message || "Failed to reset prompt settings.");
    } finally {
      setPromptSettingsResetting(false);
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

  const selectedCollectionName = selectedWebsite ? selectedWebsite.collection_name : BASE_COLLECTION_ID;
  const selectedCollectionLabel = selectedWebsite ? selectedWebsite.domain || selectedWebsite.collection_name : DEFAULT_COLLECTION_LABEL;
  const activeWidget = widgets.find((item) => item.collection === widgetCollectionName) || null;
  const widgetStatusLabel = activeWidget
    ? String(activeWidget.status || "active").charAt(0).toUpperCase() + String(activeWidget.status || "active").slice(1)
    : "Not generated";
  const widgetScript = activeWidget?.script || "";

  useEffect(() => {
    setWidgetCollectionName(selectedCollectionName);
  }, [selectedCollectionName]);

  useEffect(() => {
    setWidgetStatus(activeWidget?.status || "active");
  }, [activeWidget?.status, activeWidget?.widgetId]);

  const currentChat = chats.find((c) => c.id === currentChatId) || chats[0] || { messages: [] };

  return (
    <div className="min-h-screen px-4 py-4 text-slate-100 md:px-6 lg:px-8">
      <div className="mx-auto flex h-[calc(100vh-2rem)] max-w-[1600px] flex-col gap-4 overflow-hidden">
        <header className="rounded-2xl border border-white/10 bg-gradient-to-r from-white/8 via-white/5 to-white/8 px-6 py-5 shadow-lg shadow-white/5 backdrop-blur-xl">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.45em] text-cyan-300/70 font-bold">
                🚀 AI-Powered RAG System
              </p>
              <h1 className="mt-3 text-3xl font-black text-white md:text-4xl">
                Smart Knowledge Retrieval
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300 font-medium">
                Index websites into Chroma collections and query using advanced RAG techniques. Get intelligent, sourced answers powered by semantic search and confidence metrics.
              </p>
            </div>

            <div className="flex w-full flex-col gap-3 xl:max-w-md">
              <form onSubmit={handleIndexWebsite}>
                <div className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-gradient-to-b from-white/5 to-white/[0.02] p-3 md:flex-row">
                  <input
                    className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-400 focus:border-mint/60 focus:bg-black/40 transition"
                    onChange={(event) => setWebsiteUrl(event.target.value)}
                    placeholder="https://example.com"
                    value={websiteUrl}
                  />
                  <button
                    className="rounded-xl bg-gradient-to-r from-mint via-cyan-300 to-blue-300 px-6 py-3 text-sm font-bold text-ink-950 transition hover:shadow-lg hover:shadow-mint/50 hover:scale-105 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100"
                    disabled={indexing || !websiteUrl.trim()}
                    type="submit"
                  >
                    {indexing ? "🔄 Indexing..." : "📄 Index"}
                  </button>
                </div>
              </form>

              <div className="flex justify-start">
                <button
                  className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-slate-200 transition hover:border-white/20 hover:bg-white/10"
                  onClick={() => setWidgetModalOpen(true)}
                  type="button"
                >
                  Widget Management
                </button>
              </div>
            </div>

          </div>
        </header>

        {error ? (
          <div className="rounded-2xl border border-rose-400/30 bg-gradient-to-r from-rose-500/15 to-rose-600/10 px-5 py-4 text-sm text-rose-100 font-medium shadow-lg shadow-rose-500/10">
            <p className="flex items-center gap-2"><span>⚠️</span> {error}</p>
          </div>
        ) : null}

        <main className="grid flex-1 min-h-0 gap-4 overflow-hidden xl:grid-cols-[320px_1fr_320px]">
          <WebsiteSidebar
            onDeleteWebsite={handleDeleteWebsite}
            baseWebsiteId={BASE_COLLECTION_ID}
            onSelectWebsite={setSelectedWebsiteId}
            selectedWebsiteId={selectedWebsiteId}
            websites={websites}
            chats={chats}
            currentChatId={currentChatId}
            onNewChat={handleNewChat}
            onSelectChat={handleSelectChat}
            onDeleteChat={handleDeleteChat}
            onWebsitesSync={refreshWebsites}
          />

          <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-white/8 to-white/[0.03] shadow-xl shadow-black/30 backdrop-blur-xl">
            <div className="flex items-center justify-between gap-4 border-b border-white/10 px-6 py-4 bg-gradient-to-r from-white/5 to-white/[0.02]">
              <div>
                <p className="text-xs uppercase tracking-[0.4em] text-cyan-300/70 font-bold">📚 Query Scope</p>
                <h2 className="mt-2 text-xl font-bold text-white">
                  {selectedWebsite ? selectedWebsite.domain : DEFAULT_COLLECTION_LABEL}
                </h2>
                <p className="mt-1 text-xs text-slate-400 font-medium">
                  {selectedWebsite ? selectedWebsite.collection_name : BASE_COLLECTION_ID}
                </p>
              </div>
              <div className="rounded-full border border-cyan-400/30 bg-gradient-to-r from-cyan-400/10 to-mint/10 px-4 py-2 text-xs text-cyan-200 font-semibold shadow-lg shadow-cyan-500/10">
                {loading ? "🔄 Searching..." : "✅ Ready"}
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
              <div className="space-y-5">
                {currentChat.messages.length ? (
                  currentChat.messages.map((message) => (
                    <MessageCard key={message.id} message={message} onOpenChunks={(chunks) => { setModalChunks(chunks || []); setChunkModalOpen(true); }} />
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] p-10 text-center text-sm text-slate-400">
                    <p className="text-4xl mb-3">💬</p>
                    <p className="font-semibold">Start a conversation</p>
                    <p className="text-xs mt-1">Ask a question about the selected collection</p>
                  </div>
                )}
              </div>
            </div>

            <form className="border-t border-white/10 bg-gradient-to-t from-white/5 to-white/[0.02] p-5 md:p-6" onSubmit={handleAskQuestion}>
              <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-gradient-to-b from-white/5 to-white/[0.02] p-3 md:flex-row md:items-end">
                <input
                  className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-400 focus:border-mint/60 focus:bg-black/40 transition"
                  onChange={(event) => setQuestion(event.target.value)}
                  placeholder="Ask a question about the selected collection..."
                  value={question}
                />
                <button
                  className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-slate-200 transition hover:border-white/20 hover:bg-white/10"
                  onClick={() => setPromptSettingsOpen(true)}
                  type="button"
                >
                  Prompt Settings
                </button>
                <button
                  className="rounded-xl bg-gradient-to-r from-white to-cyan-100 px-6 py-3 text-sm font-bold text-ink-950 transition hover:shadow-lg hover:shadow-white/30 hover:scale-105 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100"
                  disabled={loading || !question.trim()}
                  type="submit"
                >
                  {loading ? "🤔 Thinking..." : "🚀 Ask"}
                </button>
              </div>
            </form>
          </section>

          <RightSidebar message={currentChat.messages[currentChat.messages.length - 1]} />
        </main>
        <PromptSettingsModal
          open={promptSettingsOpen}
          onClose={() => setPromptSettingsOpen(false)}
          onResetDefaults={handleResetPromptSettings}
          onSave={handleSavePromptSettings}
          resetting={promptSettingsResetting}
          saving={promptSettingsSaving}
          settings={promptSettings}
        />
        {widgetModalOpen ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6 backdrop-blur-md">
            <div className="flex w-full max-w-5xl max-h-[calc(100vh-3rem)] flex-col overflow-hidden rounded-3xl border border-white/10 bg-slate-950 shadow-2xl shadow-black/60">
              <div className="flex items-center justify-between gap-4 border-b border-white/10 px-5 py-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.45em] text-cyan-300/70 font-bold">🔗 Widget Management</p>
                  <h2 className="mt-2 text-xl font-bold text-white">Widget settings</h2>
                  <p className="mt-1 text-xs text-slate-400 font-medium">
                    {selectedCollectionLabel} · {selectedCollectionName}
                  </p>
                </div>
                <button
                  className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-white/20 hover:bg-white/10"
                  onClick={() => setWidgetModalOpen(false)}
                  type="button"
                >
                  Close
                </button>
              </div>

              <div className="grid min-h-0 gap-4 overflow-hidden p-5 lg:grid-cols-[300px_1fr]">
                <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <label className=" grid gap-2 text-sm text-slate-300">
                    <span className="text-xs uppercase tracking-[0.35em] text-slate-400 font-bold">Widget Status</span>
                    <select
                      className="rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none focus:border-mint/60 focus:bg-black/40 transition"
                      value={widgetStatus}
                      onChange={(event) => setWidgetStatus(event.target.value)}
                    >
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </label>

                  <div className="mt-4 rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-xs leading-6 text-slate-300">
                    <p className="font-semibold text-slate-100">Current mapping</p>
                    <p className="mt-1 text-slate-400">
                      {activeWidget
                        ? `${activeWidget.displayName || "Widget"} · ${activeWidget.collection || selectedCollectionName}`
                        : "No widget exists for this collection yet."}
                    </p>
                    <p className="mt-2 text-slate-400">
                      Status: <span className="text-slate-100">{widgetStatusLabel}</span>
                    </p>
                  </div>

                  <div className="mt-4 space-y-2">
                    <p className="text-xs uppercase tracking-[0.35em] text-slate-400 font-bold">Saved widgets</p>
                    <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
                      {widgets.length ? (
                        widgets.map((widget) => (
                          <button
                            key={widget.widgetId}
                            className={[
                              "w-full rounded-xl border px-4 py-3 text-left transition",
                              widget.collection === widgetCollectionName
                                ? "border-mint/40 bg-mint/10"
                                : "border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/10",
                            ].join(" ")}
                            onClick={() => {
                              setWidgetCollectionName(widget.collection);
                              setWidgetStatus(widget.status || "active");
                            }}
                            type="button"
                          >
                            <div className="text-sm font-semibold text-white">
                              {widget.displayName || widget.collection}
                            </div>
                            <div className="mt-1 text-xs text-slate-400">
                              {widget.collection} · {String(widget.status || "active")}
                            </div>
                          </button>
                        ))
                      ) : (
                        <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.03] px-4 py-3 text-xs text-slate-400">
                          No widget records yet.
                        </div>
                      )}
                    </div>
                  </div>
                </section>

                <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <div className="grid gap-4">
                    <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-xs leading-6 text-slate-300">
                      <p className="font-semibold text-slate-100">Embed script</p>
                      <p className="mt-1 break-all font-mono text-[11px] text-slate-400">
                        {widgetScript || "Generate or update a widget to create the embed snippet."}
                      </p>
                    </div>

                    <div className="flex flex-col gap-2 sm:flex-row">
                      <button
                        className="rounded-xl bg-gradient-to-r from-mint via-cyan-300 to-blue-300 px-4 py-3 text-sm font-bold text-ink-950 transition hover:shadow-lg hover:shadow-mint/50 hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100"
                        disabled={widgetBusy}
                        onClick={handleGenerateWidget}
                        type="button"
                      >
                        {widgetBusy ? "Saving..." : activeWidget ? "Update Widget" : "Generate Widget"}
                      </button>
                      <button
                        className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-slate-200 transition hover:border-white/20 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={!widgetScript}
                        onClick={() => handleCopyWidgetScript(widgetScript)}
                        type="button"
                      >
                        {widgetCopied ? "Copied" : "Copy Script"}
                      </button>
                    </div>

                    {widgetMessage ? <p className="text-xs text-amber-200">{widgetMessage}</p> : null}
                  </div>
                </section>
              </div>
            </div>
          </div>
        ) : null}
        <ChunkModal open={chunkModalOpen} onClose={() => setChunkModalOpen(false)} chunks={modalChunks} />
      </div>
    </div>
  );
}

function MessageCard({ message, onOpenChunks }) {
  if (message.role === "user") {
    return (
      <div className="ml-auto max-w-3xl rounded-2xl border border-cyan-300/25 bg-gradient-to-br from-cyan-300/15 to-cyan-300/5 px-5 py-4 text-right text-white shadow-lg shadow-cyan-500/10">
        <p className="text-[13px] leading-relaxed font-medium">{message.content}</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl rounded-2xl border border-white/10 bg-gradient-to-br from-white/8 to-white/[0.03] p-6 shadow-xl shadow-black/30">
      <div className="space-y-4">
        <div>
          <p className="text-xs uppercase tracking-[0.4em] text-cyan-300/70 font-bold mb-3">📝 Answer</p>
          <p className="whitespace-pre-wrap text-[15px] leading-8 text-slate-50 font-medium">
            {message.status === "pending" ? (
              <TypingDots />
            ) : (
              message.content
            )}
          </p>
        </div>
        <div>
          {Array.isArray(message.payload?.chunks) && message.payload.chunks.length ? (
            <button
              type="button"
              className="mt-2 text-sm text-slate-300 hover:text-white underline"
              onClick={() => onOpenChunks && onOpenChunks(message.payload.chunks)}
            >
              {message.payload.chunks.length} chunks
            </button>
          ) : null}
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

export default App;
