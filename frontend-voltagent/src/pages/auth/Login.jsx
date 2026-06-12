import { useState } from "react";
import { Card } from "../../components/marketing/MarketingPrimitives";

export function LoginPage({ onLogin, onNavigate, loading, error }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <div className="mx-auto max-w-lg px-4 py-16 sm:px-6 lg:px-8">
      <Card className="p-6">
        <p className="text-[11px] uppercase tracking-[0.28em] text-primary">Login</p>
        <h1 className="mt-3 text-3xl font-semibold text-ink-strong">Welcome back</h1>
        <p className="mt-2 text-sm text-body">Sign in to reach your dashboard or admin workspace.</p>
        <form
          className="mt-6 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            onLogin?.({ email, password });
          }}
        >
          <input className="w-full rounded-xl border border-hairline bg-canvas-soft px-4 py-3 text-sm text-ink outline-none" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input className="w-full rounded-xl border border-hairline bg-canvas-soft px-4 py-3 text-sm text-ink outline-none" placeholder="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          {error ? <p className="text-sm text-red-300">{error}</p> : null}
          <button className="w-full rounded-full bg-primary px-4 py-3 text-sm font-semibold text-on-primary" disabled={loading} type="submit">
            {loading ? "Signing in..." : "Login"}
          </button>
        </form>
        <button className="mt-4 text-sm text-primary" onClick={() => onNavigate?.("/signup")}>Need an account? Sign up</button>
      </Card>
    </div>
  );
}
