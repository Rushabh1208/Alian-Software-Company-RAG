import { useEffect, useState } from "react";
import { Card } from "../../components/marketing/MarketingPrimitives";
import { DashboardShell } from "../../components/dashboard/DashboardShell";
import { getWidgetSettingsApi, updateWidgetSettingsApi } from "../../lib/api";
import { Skeleton, Toast } from "../../components/ui/Feedback";

const DEFAULTS = {
  theme: "dark",
  accentColor: "#00d992",
  welcomeMessage: "Hi, how can I help?",
  suggestedQuestions: [],
  widgetTitle: "WebGenius Assistant",
};

const PRESET_COLORS = ["#00d992", "#6366f1", "#f59e0b", "#ef4444", "#3b82f6", "#ec4899"];

export function ChatbotSettingsPage() {
  const [settings, setSettings] = useState(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [sugInput, setSugInput] = useState("");

  // Load settings from backend on mount
  useEffect(() => {
    getWidgetSettingsApi()
      .then((payload) => {
        // Backend returns a flat camelCase object (theme, accentColor, welcomeMessage, …)
        // It may be wrapped in payload.settings or returned directly — handle both.
        const raw = payload?.settings ?? payload ?? {};
        setSettings({
          theme: raw.theme || DEFAULTS.theme,
          accentColor: raw.accentColor || raw.accent_color || DEFAULTS.accentColor,
          welcomeMessage: raw.welcomeMessage ?? raw.welcome_message ?? DEFAULTS.welcomeMessage,
          suggestedQuestions: Array.isArray(raw.suggestedQuestions)
            ? raw.suggestedQuestions
            : Array.isArray(raw.suggested_questions)
            ? raw.suggested_questions
            : [],
          widgetTitle: raw.widgetTitle || raw.widget_title || DEFAULTS.widgetTitle,
        });
      })
      .catch((e) => showToast(e.message || "Failed to load settings.", "error"))
      .finally(() => setLoading(false));
  }, []);

  function showToast(message, tone = "success") {
    setToast({ message, tone, key: Date.now() });
    window.setTimeout(() => setToast(null), 3500);
  }

  const save = async () => {
    setSaving(true);
    try {
      // Send camelCase — backend PUT /api/widget-settings expects camelCase
      const payload = await updateWidgetSettingsApi({
        theme: settings.theme,
        accentColor: settings.accentColor,
        welcomeMessage: settings.welcomeMessage,
        suggestedQuestions: settings.suggestedQuestions,
        widgetTitle: settings.widgetTitle,
      });
      // Normalize response the same way as on load
      const raw = payload?.settings ?? payload ?? {};
      setSettings({
        theme: raw.theme || DEFAULTS.theme,
        accentColor: raw.accentColor || raw.accent_color || DEFAULTS.accentColor,
        welcomeMessage: raw.welcomeMessage ?? raw.welcome_message ?? DEFAULTS.welcomeMessage,
        suggestedQuestions: Array.isArray(raw.suggestedQuestions)
          ? raw.suggestedQuestions
          : Array.isArray(raw.suggested_questions)
          ? raw.suggested_questions
          : [],
        widgetTitle: raw.widgetTitle || raw.widget_title || DEFAULTS.widgetTitle,
      });
      showToast("✓ Settings saved — your embedded widget will reflect changes within 20 seconds.");
    } catch (e) {
      showToast(e.message || "Failed to save settings.", "error");
    } finally {
      setSaving(false);
    }
  };

  const addSuggested = () => {
    const q = sugInput.trim();
    if (!q) return;
    setSettings((s) => ({ ...s, suggestedQuestions: [...s.suggestedQuestions, q] }));
    setSugInput("");
  };

  const removeSuggested = (i) =>
    setSettings((s) => ({
      ...s,
      suggestedQuestions: s.suggestedQuestions.filter((_, idx) => idx !== i),
    }));

  const accent = settings.accentColor || DEFAULTS.accentColor;
  const isDark = settings.theme === "dark";

  return (
    <DashboardShell
      eyebrow="Settings"
      title="Chatbot settings"
      description="Customise how your embedded chatbot looks and behaves. Changes are pushed to every embedded widget automatically."
    >
      {toast ? (
        <div className="fixed right-4 top-4 z-50">
          <Toast tone={toast.tone === "error" ? "error" : "success"}>{toast.message}</Toast>
        </div>
      ) : null}

      {loading ? (
        <Skeleton className="h-96" />
      ) : (
        <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
          {/* ── Settings form ── */}
          <Card className="space-y-6 p-6">
            {/* Widget Title */}
            <div>
              <label className="text-sm font-medium text-ink-strong" htmlFor="widgetTitle">
                Chatbot Title
              </label>
              <input
                id="widgetTitle"
                className="mt-2 w-full rounded-xl border border-hairline bg-canvas-soft px-4 py-3 text-sm text-ink outline-none focus:border-primary/60 transition"
                placeholder="e.g. Support Assistant"
                value={settings.widgetTitle}
                onChange={(e) => setSettings((s) => ({ ...s, widgetTitle: e.target.value }))}
              />
            </div>

            {/* Welcome Message */}
            <div>
              <label className="text-sm font-medium text-ink-strong" htmlFor="welcomeMsg">
                Welcome Message
              </label>
              <input
                id="welcomeMsg"
                className="mt-2 w-full rounded-xl border border-hairline bg-canvas-soft px-4 py-3 text-sm text-ink outline-none focus:border-primary/60 transition"
                placeholder="e.g. Hi, how can I help you today?"
                value={settings.welcomeMessage}
                onChange={(e) => setSettings((s) => ({ ...s, welcomeMessage: e.target.value }))}
              />
            </div>

            {/* Theme */}
            <div>
              <p className="text-sm font-medium text-ink-strong mb-2">Theme</p>
              <div className="flex gap-3">
                {["dark", "light"].map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setSettings((s) => ({ ...s, theme: t }))}
                    className={[
                      "flex-1 rounded-xl border px-4 py-3 text-sm font-medium capitalize transition",
                      settings.theme === t
                        ? "border-primary/60 bg-primary/10 text-ink-strong"
                        : "border-hairline bg-canvas-soft text-body hover:border-primary/30",
                    ].join(" ")}
                  >
                    {t === "dark" ? "🌙 Dark" : "☀️ Light"}
                  </button>
                ))}
              </div>
            </div>

            {/* Accent Color */}
            <div>
              <p className="text-sm font-medium text-ink-strong mb-2">Accent Color</p>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  className="h-10 w-12 cursor-pointer rounded-lg border border-hairline bg-canvas-soft p-1"
                  value={settings.accentColor}
                  onChange={(e) => setSettings((s) => ({ ...s, accentColor: e.target.value }))}
                />
                <input
                  type="text"
                  className="w-28 rounded-xl border border-hairline bg-canvas-soft px-3 py-2.5 font-mono text-sm text-ink outline-none focus:border-primary/60 transition"
                  value={settings.accentColor}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (/^#[0-9a-fA-F]{0,6}$/.test(v))
                      setSettings((s) => ({ ...s, accentColor: v }));
                  }}
                />
                <div className="flex gap-2">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      title={c}
                      onClick={() => setSettings((s) => ({ ...s, accentColor: c }))}
                      style={{ backgroundColor: c }}
                      className={[
                        "h-6 w-6 rounded-full border-2 transition hover:scale-110",
                        settings.accentColor === c ? "border-white scale-110" : "border-transparent",
                      ].join(" ")}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Suggested Questions */}
            <div>
              <p className="text-sm font-medium text-ink-strong mb-2">Suggested Questions</p>
              <div className="space-y-2 mb-3">
                {settings.suggestedQuestions.length === 0 && (
                  <p className="text-xs text-body">No suggested questions yet — add some below.</p>
                )}
                {settings.suggestedQuestions.map((q, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="flex-1 rounded-xl border border-hairline bg-canvas-soft px-3 py-2 text-sm text-ink">
                      {q}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeSuggested(i)}
                      className="rounded-lg border border-red-500/30 bg-red-500/10 px-2.5 py-1.5 text-xs font-semibold text-red-300 hover:bg-red-500/20 transition"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  className="flex-1 rounded-xl border border-hairline bg-canvas-soft px-3 py-2.5 text-sm text-ink outline-none focus:border-primary/60 transition"
                  placeholder="Type a question and press Enter or Add"
                  value={sugInput}
                  onChange={(e) => setSugInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addSuggested(); } }}
                />
                <button
                  type="button"
                  disabled={!sugInput.trim()}
                  onClick={addSuggested}
                  className="rounded-xl border border-hairline bg-canvas-soft px-4 py-2.5 text-sm font-medium text-ink hover:border-primary/40 transition disabled:opacity-40"
                >
                  Add
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="rounded-full bg-primary px-6 py-3 text-sm font-semibold text-on-primary transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save Settings"}
            </button>
          </Card>

          {/* ── Live Preview ── */}
          <div className="space-y-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-primary">Live Preview</p>
            <div
              className="overflow-hidden rounded-2xl border"
              style={{
                backgroundColor: isDark ? "#0f172a" : "#f8fafc",
                borderColor: isDark ? "#1e293b" : "#e2e8f0",
              }}
            >
              {/* Header */}
              <div
                className="flex items-center gap-2.5 px-4 py-3"
                style={{
                  backgroundColor: accent + "22",
                  borderBottom: `1px solid ${accent}44`,
                }}
              >
                <div
                  className="flex h-8 w-8 items-center justify-center rounded-full text-sm"
                  style={{ backgroundColor: accent }}
                >
                  💬
                </div>
                <span
                  className="text-sm font-semibold"
                  style={{ color: isDark ? "#f1f5f9" : "#0f172a" }}
                >
                  {settings.widgetTitle || "Assistant"}
                </span>
                <div className="ml-auto flex gap-1">
                  <div className="h-2 w-2 rounded-full bg-white/20" />
                  <div className="h-2 w-2 rounded-full bg-white/20" />
                  <div className="h-2 w-2 rounded-full bg-white/20" />
                </div>
              </div>

              {/* Messages area */}
              <div className="min-h-[180px] space-y-3 p-4">
                {settings.welcomeMessage ? (
                  <div className="flex items-start gap-2">
                    <div
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px]"
                      style={{ backgroundColor: accent }}
                    >
                      🤖
                    </div>
                    <div
                      className="max-w-[85%] rounded-2xl rounded-tl-none px-3 py-2 text-xs leading-5"
                      style={{
                        backgroundColor: isDark ? "#1e293b" : "#e2e8f0",
                        color: isDark ? "#e2e8f0" : "#1e293b",
                      }}
                    >
                      {settings.welcomeMessage}
                    </div>
                  </div>
                ) : (
                  <p className="text-center text-xs" style={{ color: isDark ? "#475569" : "#94a3b8" }}>
                    No welcome message set
                  </p>
                )}

                {/* Suggested questions */}
                {settings.suggestedQuestions.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pl-8">
                    {settings.suggestedQuestions.slice(0, 3).map((q, i) => (
                      <span
                        key={i}
                        className="rounded-full border px-2.5 py-1 text-[10px] font-medium"
                        style={{
                          borderColor: accent + "66",
                          color: accent,
                          backgroundColor: accent + "11",
                        }}
                      >
                        {q.length > 30 ? q.slice(0, 27) + "…" : q}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Input bar */}
              <div
                className="flex items-center gap-2 px-3 py-2.5 border-t"
                style={{
                  borderColor: isDark ? "#1e293b" : "#e2e8f0",
                  backgroundColor: isDark ? "#0f172a" : "#f8fafc",
                }}
              >
                <div
                  className="flex-1 rounded-xl px-3 py-2 text-xs"
                  style={{
                    backgroundColor: isDark ? "#1e293b" : "#e2e8f0",
                    color: isDark ? "#475569" : "#94a3b8",
                  }}
                >
                  Ask a question…
                </div>
                <div
                  className="flex h-7 w-7 items-center justify-center rounded-xl text-xs font-bold"
                  style={{ backgroundColor: accent, color: "#0f172a" }}
                >
                  ↑
                </div>
              </div>
            </div>
            <p className="text-center text-[10px] text-body">
              Preview updates live. Save to push changes to all embedded chatbots.
            </p>
          </div>
        </div>
      )}
    </DashboardShell>
  );
}