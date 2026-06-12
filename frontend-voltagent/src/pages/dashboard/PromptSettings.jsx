import { useEffect, useMemo, useState } from "react";
import { DashboardShell } from "../../components/dashboard/DashboardShell";
import { Card } from "../../components/marketing/MarketingPrimitives";
import { Toast, Skeleton } from "../../components/ui/Feedback";
import {
  getPromptSettings,
  updatePromptSettings,
  resetPromptSettings,
  checkGuardrails,
  getWebsites,
} from "../../lib/api";

const DEFAULT_ROLE = "You are a retrieval-augmented QA assistant.";
const DEFAULT_PROMPT_SETTINGS = { role: DEFAULT_ROLE, constraints: [] };

function parseConstraints(value) {
  return String(value || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.replace(/^\s*[-*]+\s*/, ""));
}

export function PromptSettingsPage() {
  const [settings, setSettings] = useState(DEFAULT_PROMPT_SETTINGS);
  const [role, setRole] = useState(DEFAULT_ROLE);
  const [constraintsText, setConstraintsText] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [guardrailsLoading, setGuardrailsLoading] = useState(false);
  const [guardrailsStatus, setGuardrailsStatus] = useState(null); // null | "passed" | "failed"
  const [guardrailsViolations, setGuardrailsViolations] = useState([]);
  const [successMsg, setSuccessMsg] = useState("");
  const [error, setError] = useState("");
  const [websites, setWebsites] = useState([]);
  const [selectedCollection, setSelectedCollection] = useState("");

  const normalizedConstraints = useMemo(() => parseConstraints(constraintsText), [constraintsText]);

  // Load the user's websites on mount, default selection to first owned site.
  useEffect(() => {
    getWebsites()
      .then((payload) => {
        const sites = Array.isArray(payload?.websites) ? payload.websites : [];
        setWebsites(sites);
        const firstOwned = sites[0];
        if (firstOwned) {
          setSelectedCollection((current) => current || firstOwned.id || firstOwned.collection_name || "");
        }
      })
      .catch(() => {});
  }, []);

  // Load (or reload) prompt settings whenever the selected website changes.
  useEffect(() => {
    if (!selectedCollection) {
      setSettings(DEFAULT_PROMPT_SETTINGS);
      setRole(DEFAULT_ROLE);
      setConstraintsText("");
      setGuardrailsStatus(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    getPromptSettings(selectedCollection)
      .then((payload) => {
        const next = {
          role: String(payload?.role || DEFAULT_ROLE),
          constraints: Array.isArray(payload?.constraints) ? payload.constraints : [],
        };
        setSettings(next);
        setRole(next.role);
        setConstraintsText(next.constraints.join("\n"));
        setGuardrailsStatus(null);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [selectedCollection]);

  const clearFeedback = () => {
    setGuardrailsStatus(null);
    setGuardrailsViolations([]);
    setSuccessMsg("");
    setError("");
  };

  const handleGuardrailsCheck = async () => {
    setGuardrailsLoading(true);
    setGuardrailsStatus(null);
    setGuardrailsViolations([]);
    setError("");
    try {
      const result = await checkGuardrails({ role, constraints: constraintsText });
      if (result.passed) {
        setGuardrailsStatus("passed");
      } else {
        setGuardrailsStatus("failed");
        setGuardrailsViolations(result.violations || []);
      }
    } catch {
      setGuardrailsStatus("failed");
      setGuardrailsViolations(["Server error during guardrails check."]);
    } finally {
      setGuardrailsLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");
    setSuccessMsg("");
    try {
      const payload = await updatePromptSettings({ role, constraints: normalizedConstraints, collection: selectedCollection });
      const next = {
        role: String(payload?.role || DEFAULT_ROLE),
        constraints: Array.isArray(payload?.constraints) ? payload.constraints : [],
      };
      setSettings(next);
      setRole(next.role);
      setConstraintsText(next.constraints.join("\n"));
      setGuardrailsStatus(null);
      setSuccessMsg("Prompt settings saved successfully.");
    } catch (err) {
      setError(err.message || "Failed to save prompt settings.");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!window.confirm("Reset prompt settings to defaults?")) return;
    setResetting(true);
    setError("");
    setSuccessMsg("");
    try {
      const payload = await resetPromptSettings(selectedCollection);
      const next = {
        role: String(payload?.role || DEFAULT_ROLE),
        constraints: Array.isArray(payload?.constraints) ? payload.constraints : [],
      };
      setSettings(next);
      setRole(next.role);
      setConstraintsText(next.constraints.join("\n"));
      setGuardrailsStatus(null);
      setSuccessMsg("Prompt settings reset to defaults.");
    } catch (err) {
      setError(err.message || "Failed to reset prompt settings.");
    } finally {
      setResetting(false);
    }
  };

  const isDirty =
    role !== settings.role ||
    normalizedConstraints.join("\n") !== settings.constraints.join("\n");

  return (
    <DashboardShell
      eyebrow="Settings"
      title="Prompt settings"
      description="Customize the assistant role and add extra constraints. The backend always preserves grounding rules."
    >
      {error ? <Toast tone="error">{error}</Toast> : null}
      {successMsg ? <Toast>{successMsg}</Toast> : null}

      {/* Website / collection selector — prompt settings are per-website */}
      <Card className="p-4">
        <label className="block text-[11px] font-semibold uppercase tracking-[0.25em] text-mute mb-2">
          Website
        </label>
        <select
          className="w-full rounded-xl border border-hairline bg-canvas-soft px-4 py-2 text-sm text-ink outline-none focus:border-primary/50 transition"
          value={selectedCollection}
          onChange={(e) => setSelectedCollection(e.target.value)}
          disabled={websites.length === 0}
        >
          <option value="">{websites.length === 0 ? "No websites available" : "Select a website"}</option>
          {websites.map((site) => (
            <option key={site.id || site.collection_name} value={site.id || site.collection_name}>
              {site.url || site.id || site.collection_name}
            </option>
          ))}
        </select>
        <p className="mt-1.5 text-xs text-mute">Each website has its own prompt role and constraints.</p>
      </Card>

      {/* Guardrails feedback bar */}
      {guardrailsStatus === "failed" && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/5 px-5 py-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-red-400">Guardrails Failed</p>
          <ul className="mt-2 space-y-1">
            {guardrailsViolations.map((v, i) => (
              <li key={i} className="text-sm text-red-300">• {v}</li>
            ))}
          </ul>
        </div>
      )}
      {guardrailsStatus === "passed" && (
        <div className="rounded-xl border border-primary/30 bg-primary/5 px-5 py-3">
          <p className="text-sm text-primary">✓ Guardrails check passed. You may now save.</p>
        </div>
      )}

      {loading ? (
        <Skeleton className="h-96" />
      ) : (
        <div className="grid gap-5 xl:grid-cols-[1fr_0.85fr]">
          {/* Left: editor */}
          <Card className="space-y-5 p-5">
            {/* Role */}
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-[0.25em] text-mute mb-2">
                Assistant Role
              </label>
              <textarea
                className="w-full min-h-[100px] rounded-xl border border-hairline bg-canvas-soft px-4 py-3 text-sm leading-6 text-ink outline-none placeholder:text-mute focus:border-primary/50 transition resize-none"
                maxLength={500}
                value={role}
                onChange={(e) => { setRole(e.target.value); clearFeedback(); }}
                placeholder={DEFAULT_ROLE}
              />
              <p className="mt-1 text-xs text-mute">{role.length}/500 characters</p>
            </div>

            {/* Constraints */}
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-[0.25em] text-mute mb-2">
                Additional Constraints
              </label>
              <textarea
                className="w-full min-h-[140px] rounded-xl border border-hairline bg-canvas-soft px-4 py-3 text-sm leading-6 text-ink outline-none placeholder:text-mute focus:border-primary/50 transition resize-none"
                placeholder={"Add one constraint per line\n— Only answer questions about the indexed content\n— Always cite your sources"}
                value={constraintsText}
                onChange={(e) => { setConstraintsText(e.target.value); clearFeedback(); }}
              />
              <p className="mt-1.5 text-xs text-mute">
                The backend appends grounded defaults, removes duplicates, and sanitizes unsafe markup.
              </p>
            </div>

            {/* Action buttons */}
            <div className="flex items-center justify-between gap-3 pt-2 border-t border-hairline">
              <button
                className="rounded-xl border border-red-500/30 bg-red-500/8 px-4 py-2 text-sm font-semibold text-red-300 transition hover:bg-red-500/15 disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={handleReset}
                type="button"
                disabled={resetting || saving || !selectedCollection}
              >
                {resetting ? "Resetting…" : "Reset Defaults"}
              </button>

              <div className="flex items-center gap-2">
                <button
                  className="rounded-xl border border-hairline px-4 py-2 text-sm font-semibold text-mute transition hover:border-primary/40 hover:text-ink disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={guardrailsLoading || saving || !selectedCollection}
                  onClick={handleGuardrailsCheck}
                  type="button"
                >
                  {guardrailsLoading ? "Checking…" : "Guardrails Check"}
                </button>
                <button
                  className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-on-primary transition hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={saving || guardrailsStatus !== "passed" || !selectedCollection}
                  onClick={handleSave}
                  type="button"
                  title={guardrailsStatus !== "passed" ? "Run a guardrails check first" : ""}
                >
                  {saving ? "Saving…" : "Save Settings"}
                </button>
              </div>
            </div>
          </Card>

          {/* Right: preview + live constraints */}
          <div className="space-y-4">
            {/* Constraints preview */}
            <Card className="p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-mute mb-3">Constraints Preview</p>
              {normalizedConstraints.length ? (
                <ul className="space-y-2">
                  {normalizedConstraints.map((c, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                      <p className="text-sm text-ink leading-5">{c}</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-mute">No custom constraints added yet.</p>
              )}
              <div className="mt-4 pt-3 border-t border-hairline">
                <p className="text-xs text-mute">
                  {normalizedConstraints.length} custom constraint{normalizedConstraints.length !== 1 ? "s" : ""} active.
                </p>
              </div>
            </Card>

            {/* Current saved state */}
            <Card className="p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-mute mb-3">Saved Configuration</p>
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-mute mb-1">Role</p>
                  <p className="text-sm text-ink leading-5 line-clamp-3">{settings.role}</p>
                </div>
                <div>
                  <p className="text-xs text-mute mb-1">Constraints</p>
                  <p className="text-sm text-ink">
                    {settings.constraints.length
                      ? `${settings.constraints.length} constraint${settings.constraints.length !== 1 ? "s" : ""}`
                      : "None"}
                  </p>
                </div>
              </div>
              {isDirty && (
                <div className="mt-4 pt-3 border-t border-hairline">
                  <p className="text-xs text-yellow-400">⚠ You have unsaved changes.</p>
                </div>
              )}
            </Card>

            {/* Guardrails info */}
            <Card className="p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-mute mb-3">How Guardrails Work</p>
              <ul className="space-y-2 text-xs text-mute leading-5">
                <li className="flex items-start gap-2">
                  <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-mute" />
                  Run a guardrails check before saving to validate your prompt.
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-mute" />
                  The backend enforces grounding rules regardless of custom settings.
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-mute" />
                  Duplicate constraints are automatically removed on save.
                </li>
              </ul>
            </Card>
          </div>
        </div>
      )}
    </DashboardShell>
  );
}
