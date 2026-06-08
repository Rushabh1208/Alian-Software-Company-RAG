import { useEffect, useMemo, useState } from "react";
import { checkGuardrails } from "../lib/api";

const DEFAULT_ROLE = "You are a retrieval-augmented QA assistant.";

function parseConstraints(value) {
  return String(value || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.replace(/^\s*[-*]+\s*/, ""));
}

function PromptSettingsModal({
  open,
  onClose,
  onSave,
  onResetDefaults,
  settings,
  saving = false,
  resetting = false,
}) {
  const [role, setRole] = useState(DEFAULT_ROLE);
  const [constraintsText, setConstraintsText] = useState("");
  const [guardrailsStatus, setGuardrailsStatus] = useState(null); 
  const normalizedConstraints = useMemo(() => parseConstraints(constraintsText), [constraintsText]);// null = not checked, 'passed', 'failed'
  const [guardrailsViolations, setGuardrailsViolations] = useState([]);
  const [guardrailsLoading, setGuardrailsLoading] = useState(false);

  

  useEffect(() => {
    if (!open) {
      return;
    }

    setRole(String(settings?.role || DEFAULT_ROLE));
    setConstraintsText(Array.isArray(settings?.constraints) ? settings.constraints.join("\n") : "");
  }, [open, settings]);

  if (!open) {
    return null;
  }

  const handleSave = () => {
    onSave?.({
      role,
      constraints: normalizedConstraints,
    });
  };

  const handleGuardrailsCheck = async () => {
  setGuardrailsLoading(true);
  setGuardrailsStatus(null);
  setGuardrailsViolations([]);
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      <div className="relative z-10 w-full max-w-3xl overflow-hidden rounded-[2rem] border border-white/10 bg-ink-950/95 shadow-[0_30px_120px_rgba(0,0,0,0.55)]">
        <div className="flex items-start justify-between gap-4 border-b border-white/10 px-6 py-5">
          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-cyan-200/70">Prompt Settings</p>
            <h3 className="mt-2 text-2xl font-semibold text-white">Customize grounded prompting</h3>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
              The backend always preserves grounding rules and citation structure. You can adjust the assistant role and add extra constraints.
            </p>
            {guardrailsStatus === "failed" && (
            <div className="rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-4">
              <p className="text-xs uppercase tracking-[0.35em] text-rose-300">⚠ Guardrails Check Failed</p>
              <ul className="mt-2 space-y-1">
                {guardrailsViolations.map((v, i) => (
                  <li key={i} className="text-sm text-rose-200">• {v}</li>
                ))}
              </ul>
            </div>
          )}

          {guardrailsStatus === "passed" && (
            <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-4">
              <p className="text-sm text-emerald-300">✓ Guardrails check passed. You can now save.</p>
            </div>
          )}
          </div>
          <button
            className="rounded-full border border-white/10 px-3 py-2 text-sm text-slate-200 transition hover:border-white/20 hover:bg-white/5"
            onClick={onClose}
            type="button"
          >
            Close
          </button>
        </div>

        <div className="grid gap-5 px-6 py-6">
          <label className="grid gap-2">
            <span className="text-xs uppercase tracking-[0.35em] text-slate-400">Role</span>
            <textarea
              className="min-h-28 rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm leading-6 text-white outline-none placeholder:text-slate-500 focus:border-mint/40"
              maxLength={500}
              onChange={(e) => { setRole(e.target.value); setGuardrailsStatus(null); }}
              placeholder={DEFAULT_ROLE}
              value={role}
            />
          </label>

          <label className="grid gap-2">
            <span className="text-xs uppercase tracking-[0.35em] text-slate-400">Additional Constraints</span>
            <textarea
              className="min-h-44 rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm leading-6 text-white outline-none placeholder:text-slate-500 focus:border-mint/40"
              placeholder="Add one constraint per line"
              value={constraintsText}
              onChange={(e) => { setConstraintsText(e.target.value); setGuardrailsStatus(null); }}
            />
            <p className="text-xs leading-5 text-slate-400">
              The backend will always append the grounded defaults, remove duplicates, and sanitize unsafe markup.
            </p>
          </label>

          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <p className="text-xs uppercase tracking-[0.35em] text-slate-400">Preview</p>
            <p className="mt-2 text-sm text-slate-300">
              {normalizedConstraints.length ? `${normalizedConstraints.length} custom constraint${normalizedConstraints.length === 1 ? "" : "s"} ready to save.` : "No custom constraints yet."}
            </p>
          </div>
        </div>
          
        <div className="flex flex-col gap-3 border-t border-white/10 px-6 py-5 md:flex-row md:items-center md:justify-between">
          <button
            className="rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm font-semibold text-rose-100 transition hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={resetting || saving}
            onClick={onResetDefaults}
            type="button"
          >
            {resetting ? "Resetting..." : "Reset Defaults"}
          </button>

          <div className="flex flex-col gap-3 md:flex-row">

            {/* ADD THIS BUTTON */}
            <button
              className="rounded-2xl border border-cyan-400/20 bg-cyan-500/10 px-4 py-3 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={guardrailsLoading || saving}
              onClick={handleGuardrailsCheck}
              type="button"
            >
              {guardrailsLoading ? "Checking..." : "🛡 Guardrails Check"}
            </button>

            <button
              className="rounded-2xl border border-white/10 px-4 py-3 text-sm font-semibold text-slate-200 transition hover:bg-white/5"
              onClick={onClose}
              type="button"
            >
              Cancel
            </button>

            {/* ADD disabled condition */}
            <button
              className="rounded-2xl bg-gradient-to-r from-mint to-cyan-300 px-5 py-3 text-sm font-semibold text-ink-950 transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={saving || guardrailsStatus !== "passed"}
              onClick={handleSave}
              type="button"
            >
              {saving ? "Saving..." : "Save Settings"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PromptSettingsModal;
