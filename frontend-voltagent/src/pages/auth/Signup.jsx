import { useState } from "react";
import { Card } from "../../components/marketing/MarketingPrimitives";

export function SignupPage({ onRegister, onNavigate, loading, error }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <div className="mx-auto max-w-lg px-4 py-16 sm:px-6 lg:px-8">
      <Card className="p-6">
        <p className="text-[11px] uppercase tracking-[0.28em] text-primary">Sign Up</p>
        <h1 className="mt-3 text-3xl font-semibold text-ink-strong">Create your account</h1>
        <p className="mt-2 text-sm text-body">Start as a user. Admins can be assigned in the backend.</p>
        <form
          className="mt-6 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            onRegister?.({ name, email, password, role: "User" });
          }}
        >
          <input className="w-full rounded-xl border border-hairline bg-canvas-soft px-4 py-3 text-sm text-ink outline-none" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
          <input className="w-full rounded-xl border border-hairline bg-canvas-soft px-4 py-3 text-sm text-ink outline-none" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input className="w-full rounded-xl border border-hairline bg-canvas-soft px-4 py-3 text-sm text-ink outline-none" placeholder="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          {error ? <p className="text-sm text-red-300">{error}</p> : null}
          <button className="w-full rounded-full bg-primary px-4 py-3 text-sm font-semibold text-on-primary" disabled={loading} type="submit">
            {loading ? "Creating..." : "Sign Up"}
          </button>
        </form>
        <button className="mt-4 text-sm text-primary" onClick={() => onNavigate?.("/login")}>Already have an account? Login</button>
      </Card>
    </div>
  );
}
