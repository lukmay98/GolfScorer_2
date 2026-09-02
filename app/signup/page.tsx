"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signUp({ email, password });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <main className="flex-1 flex items-center justify-center px-6 py-12 text-center">
        <div className="max-w-sm">
          <h1 className="font-display text-xl font-bold mb-2" style={{ color: "var(--color-fairway)" }}>
            Check your email
          </h1>
          <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
            We sent a confirmation link to {email}. Confirm it, then log in.
          </p>
          <Link href="/login" className="inline-block mt-6 text-sm font-medium" style={{ color: "var(--color-fairway)" }}>
            Back to login
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="font-display text-2xl font-bold" style={{ color: "var(--color-fairway)" }}>
            Join the scorebook
          </h1>
          <p className="mt-1 text-sm" style={{ color: "var(--color-text-muted)" }}>
            Create an account to start tracking rounds
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border px-3.5 py-2.5 text-sm outline-none focus:ring-2"
              style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Password</label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border px-3.5 py-2.5 text-sm outline-none focus:ring-2"
              style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}
              placeholder="At least 6 characters"
            />
          </div>

          {error && (
            <p className="text-sm rounded-lg px-3 py-2" style={{ background: "var(--color-flag-soft)", color: "var(--color-flag)" }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg py-2.5 text-sm font-semibold text-white transition disabled:opacity-60"
            style={{ background: "var(--color-fairway)" }}
          >
            {loading ? "Creating account…" : "Create account"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm" style={{ color: "var(--color-text-muted)" }}>
          Already have an account?{" "}
          <Link href="/login" className="font-medium" style={{ color: "var(--color-fairway)" }}>
            Log in
          </Link>
        </p>
      </div>
    </main>
  );
}
