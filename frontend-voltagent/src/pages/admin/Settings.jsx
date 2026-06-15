import { useEffect, useMemo, useState } from "react";
import { DashboardShell } from "../../components/dashboard/DashboardShell";
import { Card } from "../../components/marketing/MarketingPrimitives";
import { getAdminConfigApi, updateAdminConfigApi } from "../../lib/api";
import { Skeleton, Toast } from "../../components/ui/Feedback";

const SECTION_ORDER = [
  { id: "prompt_seed", label: "Prompt Seed", description: "Default prompt copied to new clients." },
  { id: "ingestion", label: "Ingestion", description: "Chunking, batch settings, and retry strategies." },
  { id: "retrieval", label: "Retrieval", description: "Candidate fetch, distances, and final selection." },
  { id: "reranking", label: "Reranking", description: "Second-pass ordering controls." },
  { id: "embedding", label: "Embedding", description: "Model used by the indexer and query flow." },
  { id: "registration", label: "Registration", description: "Signup defaults and user limits." },
];

const DEFAULT_CONFIG = {
  prompt_seed: {
    role: "You are a friendly, helpful website assistant. You speak naturally like a real customer support representative. You are warm, professional, concise and easy to understand. You help users find information available on the website while maintaining a natural conversation.",
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
      signup_default_token_limit: numberValue(payload?.registration?.signup_default_token_limit, DEFAULT_CONFIG.registration.signup_default_token_limit),
      max_website_contexts_per_user: numberValue(payload?.registration?.max_website_contexts_per_user, DEFAULT_CONFIG.registration.max_website_contexts_per_user),
      max_chatbots_per_user: numberValue(payload?.registration?.max_chatbots_per_user, DEFAULT_CONFIG.registration.max_chatbots_per_user),
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
  return String(text || "").split("\n").map((line) => line.trim()).filter(Boolean);
}

function sectionTitle(section) {
  return SECTION_ORDER.find((item) => item.id === section)?.label || section;
}

function Field({ label, hint, children }) {
  return (
    <div className="space-y-2 flex-1">
      <div>
        <label className="text-sm font-semibold text-ink-strong">{label}</label>
        {hint ? <p className="mt-1 text-[13px] leading-relaxed text-body">{hint}</p> : null}
      </div>
      {children}
    </div>
  );
}

function ToggleSwitch({ checked, onChange, label, hint }) {
  return (
    <div className="flex items-start justify-between gap-6 rounded-2xl border border-hairline bg-canvas-soft/40 p-5 shadow-sm transition hover:border-hairline/80">
      <div className="flex-1">
        <p className="text-[15px] font-semibold text-ink-strong">{label}</p>
        {hint && <p className="mt-1 text-[13px] leading-relaxed text-body">{hint}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={[
          "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2",
          checked ? "bg-primary" : "bg-ink/20"
        ].join(" ")}
      >
        <span
          aria-hidden="true"
          className={[
            "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
            checked ? "translate-x-5" : "translate-x-0"
          ].join(" ")}
        />
      </button>
    </div>
  );
}

function NumberInput({ value, onChange, min = undefined, step = "1", placeholder = "" }) {
  return (
    <input
      type="number"
      min={min}
      step={step}
      value={value}
      placeholder={placeholder}
      onChange={(event) => onChange(numberValue(event.target.value, value))}
      className="w-full rounded-xl border border-hairline bg-canvas px-4 py-3 text-sm text-ink outline-none shadow-sm transition focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
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
      className="w-full rounded-xl border border-hairline bg-canvas px-4 py-3 text-sm text-ink outline-none shadow-sm transition focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
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
      className="w-full rounded-xl border border-hairline bg-canvas px-4 py-3 text-sm leading-6 text-ink outline-none shadow-sm transition focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
    />
  );
}

function SectionCard({ title, children }) {
  return (
    <Card className="space-y-6 p-6 md:p-8 shadow-sm">
      {title && <h3 className="text-lg font-semibold text-ink-strong mb-4">{title}</h3>}
      {children}
    </Card>
  );
}

export function AdminSettingsPage({ onNavigate }) {
  const [config, setConfig] = useState(DEFAULT_CONFIG);

  const searchParams = new URLSearchParams(window.location.search);
  const urlSection = searchParams.get("section");
  const [activeSection, setActiveSection] = useState(urlSection || "prompt_seed");

  useEffect(() => {
    const currentUrlSection = new URLSearchParams(window.location.search).get("section");
    if (currentUrlSection && currentUrlSection !== activeSection) {
      setActiveSection(currentUrlSection);
    }
  }, [window.location.search]);

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
        message: `${sectionTitle(section)} saved successfully.`,
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
      title="Platform Settings"
      description="System-wide defaults for AI models, crawler pipelines, and user registration."
    >
      {toast ? (
        <div className="fixed right-4 top-4 z-50">
          <Toast tone={toast.tone === "error" ? "error" : "success"}>{toast.message}</Toast>
        </div>
      ) : null}

      {loading ? (
        <Skeleton className="h-[70vh]" />
      ) : (
        <div className="relative pb-24">
          <div className="max-w-5xl space-y-8">
            <Card className="border-0 bg-gradient-to-br from-primary/5 to-transparent p-6 shadow-none md:p-8">
              <div className="flex items-start justify-between">
                <div>
                  <h1 className="text-3xl font-bold text-ink-strong tracking-tight">{activeMeta.label}</h1>
                  <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-body">{activeMeta.description}</p>
                </div>
              </div>
            </Card>

            {activeSection === "prompt_seed" && (
              <div className="space-y-6">
                <SectionCard title="System Persona">
                  <Field label="Role definition" hint="The core identity provided to the assistant. New clients inherit this automatically.">
                    <TextArea value={config.prompt_seed.role} onChange={(value) => patchSection("prompt_seed", { role: value })} rows={5} />
                  </Field>
                </SectionCard>
                <SectionCard title="Behavioral Constraints">
                  <Field label="Rules (one per line)" hint="These rules limit AI hallucinations and dictate the tone of responses.">
                    <TextArea value={promptConstraintsText} onChange={(value) => patchSection("prompt_seed", { constraints: splitLines(value) })} rows={12} />
                  </Field>
                </SectionCard>
              </div>
            )}

            {activeSection === "ingestion" && (
              <div className="space-y-6">
                <SectionCard title="Chunking Strategy">
                  <div className="grid gap-6 md:grid-cols-2">
                    <Field label="Chunk Size" hint="Maximum tokens per document chunk.">
                      <NumberInput value={config.ingestion.chunk_size} onChange={(value) => patchSection("ingestion", { chunk_size: value })} min={50} />
                    </Field>
                    <Field label="Chunk Overlap" hint="Overlap tokens to preserve context between chunks.">
                      <NumberInput value={config.ingestion.chunk_overlap} onChange={(value) => patchSection("ingestion", { chunk_overlap: value })} min={0} />
                    </Field>
                  </div>
                </SectionCard>

                <SectionCard title="Batch Processing">
                  <div className="grid gap-6 md:grid-cols-3">
                    <Field label="Batch Size" hint="Documents parsed per batch cycle.">
                      <NumberInput value={config.ingestion.batch_size} onChange={(value) => patchSection("ingestion", { batch_size: value })} min={1} />
                    </Field>
                    <Field label="Embedding Batch" hint="Chunks vectorized together.">
                      <NumberInput value={config.ingestion.embedding_batch_size} onChange={(value) => patchSection("ingestion", { embedding_batch_size: value })} min={1} />
                    </Field>
                    <Field label="Batch Pause (sec)" hint="Delay between batches.">
                      <NumberInput value={config.ingestion.batch_pause_seconds} onChange={(value) => patchSection("ingestion", { batch_pause_seconds: value })} min={0} step="0.5" />
                    </Field>
                  </div>
                </SectionCard>

                <SectionCard title="Crawler Reliability">
                  <div className="grid gap-6 md:grid-cols-3">
                    <Field label="Timeout (sec)" hint="Crawler HTTP timeout limit.">
                      <NumberInput value={config.ingestion.timeout} onChange={(value) => patchSection("ingestion", { timeout: value })} min={1} />
                    </Field>
                    <Field label="Max Retries" hint="Base retry attempts.">
                      <NumberInput value={config.ingestion.max_retries} onChange={(value) => patchSection("ingestion", { max_retries: value })} min={0} />
                    </Field>
                    <Field label="Backoff Multiplier" hint="Exponential scaling factor.">
                      <NumberInput value={config.ingestion.backoff_multiplier} onChange={(value) => patchSection("ingestion", { backoff_multiplier: value })} min={1} step="0.1" />
                    </Field>
                    <Field label="Max Backoff (sec)" hint="Cap on exponential delay.">
                      <NumberInput value={config.ingestion.max_backoff_seconds} onChange={(value) => patchSection("ingestion", { max_backoff_seconds: value })} min={1} />
                    </Field>
                  </div>
                </SectionCard>

                <SectionCard title="Fallback & Rate Limits">
                  <div className="grid gap-6 md:grid-cols-2">
                    <Field label="Fallback Depth" hint="Link traversal depth on sitemap failure.">
                      <NumberInput value={config.ingestion.recursive_fallback_depth} onChange={(value) => patchSection("ingestion", { recursive_fallback_depth: value })} min={0} />
                    </Field>
                    <Field label="Fallback Pages" hint="Max pages to scrape recursively.">
                      <NumberInput value={config.ingestion.recursive_fallback_pages} onChange={(value) => patchSection("ingestion", { recursive_fallback_pages: value })} min={1} />
                    </Field>
                    <Field label="Rate Limit Retries" hint="Retries on 429 Too Many Requests.">
                      <NumberInput value={config.ingestion.rate_limit_retries} onChange={(value) => patchSection("ingestion", { rate_limit_retries: value })} min={0} />
                    </Field>
                    <Field label="Rate Limit Wait (sec)" hint="Base wait time for 429s.">
                      <NumberInput value={config.ingestion.rate_limit_base_seconds} onChange={(value) => patchSection("ingestion", { rate_limit_base_seconds: value })} min={1} />
                    </Field>
                  </div>
                </SectionCard>
              </div>
            )}

            {activeSection === "retrieval" && (
              <SectionCard title="Vector Search Parameters">
                <div className="grid gap-6 md:grid-cols-3">
                  <Field label="Vector Top K" hint="Raw chunks fetched from the vector DB.">
                    <NumberInput value={config.retrieval.vector_top_k} onChange={(value) => patchSection("retrieval", { vector_top_k: value })} min={1} />
                  </Field>
                  <Field label="Final Top K" hint="Chunks forwarded to the LLM context.">
                    <NumberInput value={config.retrieval.final_top_k} onChange={(value) => patchSection("retrieval", { final_top_k: value })} min={1} />
                  </Field>
                  <Field label="Search Distance" hint="Threshold for vector similarity.">
                    <NumberInput value={config.retrieval.max_search_distance} onChange={(value) => patchSection("retrieval", { max_search_distance: value })} min={0.1} step="0.01" />
                  </Field>
                </div>
              </SectionCard>
            )}

            {activeSection === "reranking" && (
              <div className="space-y-6">
                <ToggleSwitch
                  label="Enable Reranking Pipeline"
                  hint="When enabled, vector candidates are rescored by a cross-encoder before selection."
                  checked={config.reranking.enabled}
                  onChange={(checked) => patchSection("reranking", { enabled: checked })}
                />

                <SectionCard title="Model Specifications">
                  <div className="grid gap-6 md:grid-cols-2">
                    <Field label="Backend Provider" hint="Engine running the reranker (e.g. 'auto', 'huggingface').">
                      <TextInput value={config.reranking.backend} onChange={(value) => patchSection("reranking", { backend: value })} placeholder="auto" />
                    </Field>
                    <Field label="Cross-Encoder Model" hint="The specific huggingface or provider model ID.">
                      <TextInput value={config.reranking.model} onChange={(value) => patchSection("reranking", { model: value })} placeholder="cross-encoder/ms-marco-MiniLM-L-6-v2" />
                    </Field>
                  </div>
                </SectionCard>
              </div>
            )}

            {activeSection === "embedding" && (
              <div className="space-y-6">
                <ToggleSwitch
                  label="Normalize Embeddings"
                  hint="Projects vectors onto a unit hypersphere. Recommended for cosine similarity search."
                  checked={config.embedding.normalize_embeddings}
                  onChange={(checked) => patchSection("embedding", { normalize_embeddings: checked })}
                />

                <SectionCard title="Vectorization Engine">
                  <div className="grid gap-6 md:grid-cols-2">
                    <Field label="Embedding Provider" hint="Provider running the embeddings (e.g. 'huggingface', 'openai').">
                      <TextInput value={config.embedding.provider} onChange={(value) => patchSection("embedding", { provider: value })} placeholder="huggingface" />
                    </Field>
                    <Field label="Model ID" hint="The semantic model mapping text to vectors.">
                      <TextInput value={config.embedding.model} onChange={(value) => patchSection("embedding", { model: value })} placeholder="BAAI/bge-small-en-v1.5" />
                    </Field>
                  </div>
                  <div className="mt-6 md:w-1/2">
                    <Field label="Inference Batch Size" hint="Concurrent strings sent to the embedding model.">
                      <NumberInput value={config.embedding.batch_size} onChange={(value) => patchSection("embedding", { batch_size: value })} min={1} />
                    </Field>
                  </div>
                </SectionCard>
              </div>
            )}

            {activeSection === "registration" && (
              <div className="space-y-6">
                <ToggleSwitch
                  label="Allow Open Registration"
                  hint="Disable this to restrict platform access to invite-only or manually created accounts."
                  checked={config.registration.enabled}
                  onChange={(checked) => patchSection("registration", { enabled: checked })}
                />

                <SectionCard title="User Tier Defaults">
                  <div className="grid gap-6 md:grid-cols-2">
                    <Field label="Default LLM Model" hint="Assigned to new users upon signup.">
                      <TextInput value={config.registration.signup_default_model} onChange={(value) => patchSection("registration", { signup_default_model: value })} />
                    </Field>
                    <Field label="Starting Token Limit" hint="Monthly token allowance granted by default.">
                      <NumberInput value={config.registration.signup_default_token_limit} onChange={(value) => patchSection("registration", { signup_default_token_limit: value })} min={1} />
                    </Field>
                    <Field label="Max Website Contexts" hint="The total number of knowledge bases a user can crawl.">
                      <NumberInput value={config.registration.max_website_contexts_per_user} onChange={(value) => patchSection("registration", { max_website_contexts_per_user: value })} min={0} />
                    </Field>
                    <Field label="Max Chatbot Instances" hint="The number of unique widgets a user can deploy.">
                      <NumberInput value={config.registration.max_chatbots_per_user} onChange={(value) => patchSection("registration", { max_chatbots_per_user: value })} min={0} />
                    </Field>
                  </div>
                </SectionCard>

                <SectionCard title="Security & Rate Limiting">
                  <div className="md:w-1/2">
                    <Field label="New Account Cooldown (minutes)" hint="Delay before a newly created account can initiate heavy crawler jobs.">
                      <NumberInput value={config.registration.cooldown_minutes} onChange={(value) => patchSection("registration", { cooldown_minutes: value })} min={0} />
                    </Field>
                  </div>
                </SectionCard>
              </div>
            )}
          </div>

          {/* Sticky Save Bar */}
          <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-hairline bg-canvas/80 px-6 py-4 backdrop-blur-xl lg:left-72">
            <div className="mx-auto flex max-w-[1800px] items-center justify-between">
              <div className="hidden sm:block">
                <p className="text-sm font-medium text-ink-strong">Unsaved changes will be lost</p>
                <p className="text-xs text-body">Apply settings to the {activeMeta.label} configuration</p>
              </div>
              <button
                type="button"
                onClick={() => saveSection(activeSection)}
                disabled={savingSection === activeSection}
                className="flex items-center gap-2 rounded-full bg-primary px-8 py-3 text-[15px] font-semibold text-on-primary shadow-lg shadow-primary/20 transition-all hover:bg-primary/90 hover:shadow-primary/30 active:scale-95 disabled:pointer-events-none disabled:opacity-60 w-full sm:w-auto justify-center"
              >
                {savingSection === activeSection ? (
                  <>
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>
                    Saving...
                  </>
                ) : (
                  "Save Configuration"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardShell>
  );
}
