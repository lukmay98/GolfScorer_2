"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.push("/round");
    router.refresh();
  }

  return (
    <main className="flex-1 flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 h-12 w-12 rounded-full flex items-center justify-center" style={{ background: "var(--color-fairway)" }}>
            <FlagIcon />
          </div>
          <h1 className="font-display text-2xl font-bold" style={{ color: "var(--color-fairway)" }}>
            Golf Round Tracker
          </h1>
          <p className="mt-1 text-sm" style={{ color: "var(--color-text-muted)" }}>
            Log in to your group&apos;s scorebook
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
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border px-3.5 py-2.5 text-sm outline-none focus:ring-2"
              style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}
              placeholder="••••••••"
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
            {loading ? "Logging in…" : "Log in"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm" style={{ color: "var(--color-text-muted)" }}>
          New to the group?{" "}
          <Link href="/signup" className="font-medium" style={{ color: "var(--color-fairway)" }}>
            Create an account
          </Link>
        </p>
      </div>
    </main>
  );
}

function FlagIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="21" x2="5" y2="3" />
      <path d="M5 4h13l-3 4 3 4H5" />
    </svg>
  );
}
