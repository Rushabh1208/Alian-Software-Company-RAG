import { useEffect, useMemo, useState } from "react";
import { DashboardShell } from "../../components/dashboard/DashboardShell";
import { Card } from "../../components/marketing/MarketingPrimitives";
import { getAdminConfigApi, updateAdminConfigApi } from "../../lib/api";
import { Skeleton, Toast } from "../../components/ui/Feedback";

const SECTION_ORDER = [
  { id: "prompt_seed", label: "Prompt Seed", description: "Default prompt copied to new clients." },
  { id: "ingestion", label: "Ingestion", description: "Chunking and batch settings." },
  { id: "retrieval", label: "Retrieval", description: "Candidate fetch and final selection." },
  { id: "reranking", label: "Reranking", description: "Second-pass ordering controls." },
  { id: "embedding", label: "Embedding", description: "Model used by the indexer and query flow." },
  { id: "registration", label: "Registration", description: "Signup defaults and user limits." },
];

const DEFAULT_CONFIG = {
  prompt_seed: {
    role:
      "You are a friendly, helpful website assistant. You speak naturally like a real customer support representative. You are warm, professional, concise and easy to understand. You help users find information available on the website while maintaining a natural conversation.",
    constraints: [
      "Answer only using information supported by the website knowledge.",
      "Speak naturally like a real customer support representative.",
      "Be warm, friendly and professional.",
      "Address the user directly using 'you' and 'your'.",
      "Write short paragraphs or clean bullet points.",
      "Never create large walls of text.",
      "If information exists, answer confidently.",
      "If information is partial, share what is available.",
      "If related information exists, use it to provide guidance.",
      "Always try to be helpful before refusing.",
      "Never mention chunks, context, retrieval, sources or internal systems.",
      "Never expose technical implementation details.",
      "Never invent facts not supported by retrieved information.",
    ],
  },
  ingestion: {
    chunk_size: 500,
    chunk_overlap: 100,
    batch_size: 100,
    batch_pause_seconds: 5,
    embedding_batch_size: 32,
    max_retries: 3,
    backoff_multiplier: 2,
    timeout: 30,
    recursive_fallback_depth: 2,
    recursive_fallback_pages: 80,
    max_backoff_seconds: 120,
    rate_limit_retries: 5,
    rate_limit_base_seconds: 30,
  },
  retrieval: {
    vector_top_k: 20,
    final_top_k: 5,
    max_search_distance: 1.15,
  },
  reranking: {
    enabled: true,
    backend: "auto",
    model: "cross-encoder/ms-marco-MiniLM-L-6-v2",
  },
  embedding: {
    provider: "huggingface",
    model: "BAAI/bge-small-en-v1.5",
    batch_size: 32,
    normalize_embeddings: true,
  },
  registration: {
    enabled: true,
    signup_default_model: "gemini-3.1-flash-lite",
    signup_default_token_limit: 50000,
    max_website_contexts_per_user: 2,
    max_chatbots_per_user: 2,
    cooldown_minutes: 120,
  },
};

function normalizeConfig(raw) {
  const payload = raw?.config ?? raw ?? {};
  return {
    prompt_seed: {
      role: payload?.prompt_seed?.role ?? DEFAULT_CONFIG.prompt_seed.role,
      constraints: Array.isArray(payload?.prompt_seed?.constraints) ? payload.prompt_seed.constraints : DEFAULT_CONFIG.prompt_seed.constraints,
    },
    ingestion: {
      chunk_size: numberValue(payload?.ingestion?.chunk_size, DEFAULT_CONFIG.ingestion.chunk_size),
      chunk_overlap: numberValue(payload?.ingestion?.chunk_overlap, DEFAULT_CONFIG.ingestion.chunk_overlap),
      batch_size: numberValue(payload?.ingestion?.batch_size, DEFAULT_CONFIG.ingestion.batch_size),
      batch_pause_seconds: numberValue(payload?.ingestion?.batch_pause_seconds, DEFAULT_CONFIG.ingestion.batch_pause_seconds),
      embedding_batch_size: numberValue(payload?.ingestion?.embedding_batch_size, DEFAULT_CONFIG.ingestion.embedding_batch_size),
      max_retries: numberValue(payload?.ingestion?.max_retries, DEFAULT_CONFIG.ingestion.max_retries),
      backoff_multiplier: numberValue(payload?.ingestion?.backoff_multiplier, DEFAULT_CONFIG.ingestion.backoff_multiplier),
      timeout: numberValue(payload?.ingestion?.timeout, DEFAULT_CONFIG.ingestion.timeout),
      recursive_fallback_depth: numberValue(payload?.ingestion?.recursive_fallback_depth, DEFAULT_CONFIG.ingestion.recursive_fallback_depth),
      recursive_fallback_pages: numberValue(payload?.ingestion?.recursive_fallback_pages, DEFAULT_CONFIG.ingestion.recursive_fallback_pages),
      max_backoff_seconds: numberValue(payload?.ingestion?.max_backoff_seconds, DEFAULT_CONFIG.ingestion.max_backoff_seconds),
      rate_limit_retries: numberValue(payload?.ingestion?.rate_limit_retries, DEFAULT_CONFIG.ingestion.rate_limit_retries),
      rate_limit_base_seconds: numberValue(payload?.ingestion?.rate_limit_base_seconds, DEFAULT_CONFIG.ingestion.rate_limit_base_seconds),
    },
    retrieval: {
      vector_top_k: numberValue(payload?.retrieval?.vector_top_k, DEFAULT_CONFIG.retrieval.vector_top_k),
      final_top_k: numberValue(payload?.retrieval?.final_top_k, DEFAULT_CONFIG.retrieval.final_top_k),
      max_search_distance: numberValue(payload?.retrieval?.max_search_distance, DEFAULT_CONFIG.retrieval.max_search_distance),
    },
    reranking: {
      enabled: Boolean(payload?.reranking?.enabled ?? DEFAULT_CONFIG.reranking.enabled),
      backend: String(payload?.reranking?.backend ?? DEFAULT_CONFIG.reranking.backend),
      model: String(payload?.reranking?.model ?? DEFAULT_CONFIG.reranking.model),
    },
    embedding: {
      provider: String(payload?.embedding?.provider ?? DEFAULT_CONFIG.embedding.provider),
      model: String(payload?.embedding?.model ?? DEFAULT_CONFIG.embedding.model),
      batch_size: numberValue(payload?.embedding?.batch_size, DEFAULT_CONFIG.embedding.batch_size),
      normalize_embeddings: Boolean(payload?.embedding?.normalize_embeddings ?? DEFAULT_CONFIG.embedding.normalize_embeddings),
    },
    registration: {
      enabled: Boolean(payload?.registration?.enabled ?? DEFAULT_CONFIG.registration.enabled),
      signup_default_model: String(payload?.registration?.signup_default_model ?? DEFAULT_CONFIG.registration.signup_default_model),
      signup_default_token_limit: numberValue(
        payload?.registration?.signup_default_token_limit,
        DEFAULT_CONFIG.registration.signup_default_token_limit
      ),
      max_website_contexts_per_user: numberValue(
        payload?.registration?.max_website_contexts_per_user,
        DEFAULT_CONFIG.registration.max_website_contexts_per_user
      ),
      max_chatbots_per_user: numberValue(
        payload?.registration?.max_chatbots_per_user,
        DEFAULT_CONFIG.registration.max_chatbots_per_user
      ),
      cooldown_minutes: numberValue(payload?.registration?.cooldown_minutes, DEFAULT_CONFIG.registration.cooldown_minutes),
    },
  };
}

function numberValue(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function joinLines(lines) {
  return (Array.isArray(lines) ? lines : []).join("\n");
}

function splitLines(text) {
  return String(text || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function sectionTitle(section) {
  return SECTION_ORDER.find((item) => item.id === section)?.label || section;
}

function Field({ label, hint, children }) {
  return (
    <div className="space-y-2">
      <div>
        <label className="text-sm font-medium text-ink-strong">{label}</label>
        {hint ? <p className="mt-1 text-xs text-body">{hint}</p> : null}
      </div>
      {children}
    </div>
  );
}

function NumberInput({ value, onChange, min = undefined, step = "1" }) {
  return (
    <input
      type="number"
      min={min}
      step={step}
      value={value}
      onChange={(event) => onChange(numberValue(event.target.value, value))}
      className="w-full rounded-xl border border-hairline bg-canvas-soft px-4 py-3 text-sm text-ink outline-none transition focus:border-primary/60"
    />
  );
}

function TextInput({ value, onChange, placeholder = "" }) {
  return (
    <input
      type="text"
      value={value}
      placeholder={placeholder}
      onChange={(event) => onChange(event.target.value)}
      className="w-full rounded-xl border border-hairline bg-canvas-soft px-4 py-3 text-sm text-ink outline-none transition focus:border-primary/60"
    />
  );
}

function TextArea({ value, onChange, rows = 6, placeholder = "" }) {
  return (
    <textarea
      value={value}
      rows={rows}
      placeholder={placeholder}
      onChange={(event) => onChange(event.target.value)}
      className="w-full rounded-xl border border-hairline bg-canvas-soft px-4 py-3 text-sm leading-6 text-ink outline-none transition focus:border-primary/60"
    />
  );
}

export function AdminSettingsPage() {
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [activeSection, setActiveSection] = useState("prompt_seed");
  const [loading, setLoading] = useState(true);
  const [savingSection, setSavingSection] = useState("");
  const [toast, setToast] = useState(null);

  useEffect(() => {
    let mounted = true;
    getAdminConfigApi()
      .then((payload) => {
        if (!mounted) return;
        setConfig(normalizeConfig(payload));
      })
      .catch((error) => {
        if (!mounted) return;
        setToast({ tone: "error", message: error.message || "Failed to load configuration.", key: Date.now() });
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!toast) return undefined;
    const timeout = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const activeMeta = useMemo(
    () => SECTION_ORDER.find((item) => item.id === activeSection) || SECTION_ORDER[0],
    [activeSection]
  );

  function patchSection(section, values) {
    setConfig((current) => ({
      ...current,
      [section]: {
        ...current[section],
        ...values,
      },
    }));
  }

  async function saveSection(section) {
    setSavingSection(section);
    try {
      const payload = { [section]: config[section] };
      const response = await updateAdminConfigApi(payload);
      setConfig(normalizeConfig(response));
      setToast({
        tone: "success",
        message: `${sectionTitle(section)} saved. Runtime settings refresh on the next request.`,
        key: Date.now(),
      });
    } catch (error) {
      setToast({ tone: "error", message: error.message || "Failed to save configuration.", key: Date.now() });
    } finally {
      setSavingSection("");
    }
  }

  const promptConstraintsText = joinLines(config.prompt_seed.constraints);

  return (
    <DashboardShell
      eyebrow="Configuration"
      title="Admin configuration"
      description="Tune the live backend defaults for prompt seeding, ingestion, retrieval, reranking, embeddings, and registration."
    >
      {toast ? (
        <div className="fixed right-4 top-4 z-50">
          <Toast tone={toast.tone === "error" ? "error" : "success"}>{toast.message}</Toast>
        </div>
      ) : null}

      {loading ? (
        <Skeleton className="h-[70vh]" />
      ) : (
        <div className="grid gap-5 xl:grid-cols-[280px_1fr]">
          <Card className="border border-hairline bg-canvas-soft/70 p-4 xl:sticky xl:top-6 xl:h-fit">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-body">Configuration</p>
            <h2 className="mt-2 text-xl font-semibold text-ink-strong">Sections</h2>
            <p className="mt-2 text-sm text-body">Update the live defaults without changing the rest of the pipeline.</p>

            <div className="mt-5 space-y-2">
              {SECTION_ORDER.map((section) => {
                const active = section.id === activeSection;
                return (
                  <button
                    key={section.id}
                    type="button"
                    onClick={() => setActiveSection(section.id)}
                    className={[
                      "w-full rounded-2xl border px-4 py-3 text-left transition",
                      active
                        ? "border-primary/30 bg-primary/10 text-ink-strong"
                        : "border-hairline bg-canvas text-body hover:border-primary/30 hover:text-ink-strong",
                    ].join(" ")}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium">{section.label}</p>
                        <p className="mt-1 text-xs text-body">{section.description}</p>
                      </div>
                      <span className={active ? "text-primary" : "text-body"}>›</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </Card>

          <div className="space-y-5">
            <Card className="border border-hairline bg-canvas-soft/70 p-6">
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-primary">Configuration</p>
              <h1 className="mt-2 text-3xl font-semibold text-ink-strong">{activeMeta.label}</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-body">{activeMeta.description}</p>
            </Card>

            {activeSection === "prompt_seed" ? (
              <Card className="space-y-5 p-6">
                <Field
                  label="Role"
                  hint="This is the base prompt copied into the runtime seed for new clients."
                >
                  <TextArea
                    value={config.prompt_seed.role}
                    onChange={(value) => patchSection("prompt_seed", { role: value })}
                    rows={6}
                  />
                </Field>

                <Field
                  label="Constraints"
                  hint="One rule per line. These are carried into the fallback prompt seed."
                >
                  <TextArea
                    value={promptConstraintsText}
                    onChange={(value) => patchSection("prompt_seed", { constraints: splitLines(value) })}
                    rows={10}
                  />
                </Field>

                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs text-body">Applies to the shared prompt seed that new clients inherit.</p>
                  <button
                    type="button"
                    onClick={() => saveSection("prompt_seed")}
                    disabled={savingSection === "prompt_seed"}
                    className="rounded-full bg-primary px-6 py-3 text-sm font-semibold text-on-primary transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {savingSection === "prompt_seed" ? "Saving..." : "Save"}
                  </button>
                </div>
              </Card>
            ) : null}

            {activeSection === "ingestion" ? (
              <Card className="space-y-6 p-6">
                <div className="grid gap-5 md:grid-cols-2">
                  <Field label="Chunk Size" hint="Maximum tokens per chunk during website ingestion.">
                    <NumberInput
                      value={config.ingestion.chunk_size}
                      onChange={(value) => patchSection("ingestion", { chunk_size: value })}
                      min={50}
                    />
                  </Field>
                  <Field label="Chunk Overlap" hint="Shared tokens between consecutive chunks.">
                    <NumberInput
                      value={config.ingestion.chunk_overlap}
                      onChange={(value) => patchSection("ingestion", { chunk_overlap: value })}
                      min={0}
                    />
                  </Field>
                  <Field label="Batch Size" hint="How many URLs or chunks to process per batch.">
                    <NumberInput
                      value={config.ingestion.batch_size}
                      onChange={(value) => patchSection("ingestion", { batch_size: value })}
                      min={1}
                    />
                  </Field>
                  <Field label="Batch Pause (seconds)" hint="Pause between batches to reduce pressure on crawlers.">
                    <NumberInput
                      value={config.ingestion.batch_pause_seconds}
                      onChange={(value) => patchSection("ingestion", { batch_pause_seconds: value })}
                      min={0}
                      step="0.5"
                    />
                  </Field>
                  <Field label="Embedding Batch Size" hint="Documents embedded together before flushing to Chroma.">
                    <NumberInput
                      value={config.ingestion.embedding_batch_size}
                      onChange={(value) => patchSection("ingestion", { embedding_batch_size: value })}
                      min={1}
                    />
                  </Field>
                  <Field label="Timeout (seconds)" hint="Crawler timeout per request.">
                    <NumberInput
                      value={config.ingestion.timeout}
                      onChange={(value) => patchSection("ingestion", { timeout: value })}
                      min={1}
                    />
                  </Field>
                </div>

                <div className="grid gap-5 md:grid-cols-3">
                  <Field label="Retries" hint="Retry count for crawler and ingestion work.">
                    <NumberInput
                      value={config.ingestion.max_retries}
                      onChange={(value) => patchSection("ingestion", { max_retries: value })}
                      min={0}
                    />
                  </Field>
                  <Field label="Backoff Multiplier" hint="Exponential retry backoff factor.">
                    <NumberInput
                      value={config.ingestion.backoff_multiplier}
                      onChange={(value) => patchSection("ingestion", { backoff_multiplier: value })}
                      min={1}
                      step="0.1"
                    />
                  </Field>
                  <Field label="Rate Limit Retries" hint="How many 429s to tolerate before skipping.">
                    <NumberInput
                      value={config.ingestion.rate_limit_retries}
                      onChange={(value) => patchSection("ingestion", { rate_limit_retries: value })}
                      min={0}
                    />
                  </Field>
                </div>

                <button
                  type="button"
                  onClick={() => saveSection("ingestion")}
                  disabled={savingSection === "ingestion"}
                  className="rounded-full bg-primary px-6 py-3 text-sm font-semibold text-on-primary transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {savingSection === "ingestion" ? "Saving..." : "Save"}
                </button>
              </Card>
            ) : null}

            {activeSection === "retrieval" ? (
              <Card className="space-y-6 p-6">
                <div className="grid gap-5 md:grid-cols-3">
                  <Field label="Vector Top K" hint="Candidate chunks fetched from Chroma for each sub-query.">
                    <NumberInput
                      value={config.retrieval.vector_top_k}
                      onChange={(value) => patchSection("retrieval", { vector_top_k: value })}
                      min={1}
                    />
                  </Field>
                  <Field label="Final Top K" hint="Maximum chunks kept after reranking and filtering.">
                    <NumberInput
                      value={config.retrieval.final_top_k}
                      onChange={(value) => patchSection("retrieval", { final_top_k: value })}
                      min={1}
                    />
                  </Field>
                  <Field label="Max Search Distance" hint="Higher values broaden retrieval; lower values tighten it.">
                    <NumberInput
                      value={config.retrieval.max_search_distance}
                      onChange={(value) => patchSection("retrieval", { max_search_distance: value })}
                      min={0.1}
                      step="0.01"
                    />
                  </Field>
                </div>

                <button
                  type="button"
                  onClick={() => saveSection("retrieval")}
                  disabled={savingSection === "retrieval"}
                  className="rounded-full bg-primary px-6 py-3 text-sm font-semibold text-on-primary transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {savingSection === "retrieval" ? "Saving..." : "Save"}
                </button>
              </Card>
            ) : null}

            {activeSection === "reranking" ? (
              <Card className="space-y-6 p-6">
                <div className="rounded-2xl border border-hairline bg-canvas px-4 py-4">
                  <label className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium text-ink-strong">Enable reranking</p>
                      <p className="mt-1 text-xs text-body">Turn this on to reorder candidate chunks before the answer is generated.</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={config.reranking.enabled}
                      onChange={(event) => patchSection("reranking", { enabled: event.target.checked })}
                      className="h-4 w-4 accent-primary"
                    />
                  </label>
                </div>

                <div className="grid gap-5 md:grid-cols-2">
                  <Field label="Backend" hint="Usually auto, unless you want to force a specific reranker backend.">
                    <TextInput
                      value={config.reranking.backend}
                      onChange={(value) => patchSection("reranking", { backend: value })}
                      placeholder="auto"
                    />
                  </Field>
                  <Field label="Model" hint="Cross-encoder model used for reranking.">
                    <TextInput
                      value={config.reranking.model}
                      onChange={(value) => patchSection("reranking", { model: value })}
                      placeholder="cross-encoder/ms-marco-MiniLM-L-6-v2"
                    />
                  </Field>
                </div>

                <button
                  type="button"
                  onClick={() => saveSection("reranking")}
                  disabled={savingSection === "reranking"}
                  className="rounded-full bg-primary px-6 py-3 text-sm font-semibold text-on-primary transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {savingSection === "reranking" ? "Saving..." : "Save"}
                </button>
              </Card>
            ) : null}

            {activeSection === "embedding" ? (
              <Card className="space-y-6 p-6">
                <div className="grid gap-5 md:grid-cols-2">
                  <Field label="Embedding Model" hint="Used by ingestion and query-time embeddings.">
                    <TextInput
                      value={config.embedding.model}
                      onChange={(value) => patchSection("embedding", { model: value })}
                      placeholder="BAAI/bge-small-en-v1.5"
                    />
                  </Field>
                  <Field label="Batch Size" hint="Embedding batch size used by the indexer.">
                    <NumberInput
                      value={config.embedding.batch_size}
                      onChange={(value) => patchSection("embedding", { batch_size: value })}
                      min={1}
                    />
                  </Field>
                </div>

                <div className="rounded-2xl border border-hairline bg-canvas px-4 py-4">
                  <label className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium text-ink-strong">Normalize embeddings</p>
                      <p className="mt-1 text-xs text-body">Keep this on for the current semantic-search pipeline.</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={config.embedding.normalize_embeddings}
                      onChange={(event) => patchSection("embedding", { normalize_embeddings: event.target.checked })}
                      className="h-4 w-4 accent-primary"
                    />
                  </label>
                </div>

                <button
                  type="button"
                  onClick={() => saveSection("embedding")}
                  disabled={savingSection === "embedding"}
                  className="rounded-full bg-primary px-6 py-3 text-sm font-semibold text-on-primary transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {savingSection === "embedding" ? "Saving..." : "Save"}
                </button>
              </Card>
            ) : null}

            {activeSection === "registration" ? (
              <Card className="space-y-6 p-6">
                <div className="rounded-2xl border border-hairline bg-canvas px-4 py-4">
                  <label className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium text-ink-strong">Registration enabled</p>
                      <p className="mt-1 text-xs text-body">Disable this to block new account sign-ups.</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={config.registration.enabled}
                      onChange={(event) => patchSection("registration", { enabled: event.target.checked })}
                      className="h-4 w-4 accent-primary"
                    />
                  </label>
                </div>

                <div className="grid gap-5 md:grid-cols-2">
                  <Field label="Signup default model" hint="Stored on new users as their default model policy.">
                    <TextInput
                      value={config.registration.signup_default_model}
                      onChange={(value) => patchSection("registration", { signup_default_model: value })}
                    />
                  </Field>
                  <Field label="Signup default token limit" hint="Saved on the new user record as a starting allowance.">
                    <NumberInput
                      value={config.registration.signup_default_token_limit}
                      onChange={(value) => patchSection("registration", { signup_default_token_limit: value })}
                      min={1}
                    />
                  </Field>
                  <Field label="Max website contexts per user" hint="Limits how many websites a user can register.">
                    <NumberInput
                      value={config.registration.max_website_contexts_per_user}
                      onChange={(value) => patchSection("registration", { max_website_contexts_per_user: value })}
                      min={0}
                    />
                  </Field>
                  <Field label="Max chatbots per user" hint="Limits how many widget configurations a user can create.">
                    <NumberInput
                      value={config.registration.max_chatbots_per_user}
                      onChange={(value) => patchSection("registration", { max_chatbots_per_user: value })}
                      min={0}
                    />
                  </Field>
                </div>

                <Field label="Cooldown duration (minutes)" hint="Optional delay before a new account can perform restricted actions.">
                  <NumberInput
                    value={config.registration.cooldown_minutes}
                    onChange={(value) => patchSection("registration", { cooldown_minutes: value })}
                    min={0}
                  />
                </Field>

                <button
                  type="button"
                  onClick={() => saveSection("registration")}
                  disabled={savingSection === "registration"}
                  className="rounded-full bg-primary px-6 py-3 text-sm font-semibold text-on-primary transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {savingSection === "registration" ? "Saving..." : "Save"}
                </button>
              </Card>
            ) : null}
          </div>
        </div>
      )}
    </DashboardShell>
  );
}
