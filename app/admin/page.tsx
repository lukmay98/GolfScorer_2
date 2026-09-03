"use client";

import { useEffect, useState } from "react";

type PendingUser = { id: string; email: string; created_at: string };

export default function AdminPage() {
  const [pending, setPending] = useState<PendingUser[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    setError(null);
    const res = await fetch("/api/admin/pending");
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Could not load pending signups.");
      return;
    }
    setPending(data.pending);
  }

  useEffect(() => {
    load();
  }, []);

  async function decide(userId: string, decision: "approved" | "rejected") {
    setBusyId(userId);
    const res = await fetch("/api/admin/decide", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, decision }),
    });
    setBusyId(null);
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Something went wrong.");
      return;
    }
    load();
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-8 space-y-5">
      <h1 className="font-display text-xl font-bold" style={{ color: "var(--color-fairway)" }}>
        Pending signups
      </h1>

      {error && (
        <p className="text-sm rounded-lg px-3 py-2" style={{ background: "var(--color-flag-soft)", color: "var(--color-flag)" }}>
          {error}
        </p>
      )}

      {pending === null ? (
        <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
          Loading…
        </p>
      ) : pending.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
          No signups waiting for approval.
        </p>
      ) : (
        <ul className="space-y-2">
          {pending.map((p) => (
            <li
              key={p.id}
              className="rounded-xl border p-3.5 flex items-center justify-between"
              style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}
            >
              <div>
                <p className="text-sm font-medium">{p.email}</p>
                <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                  Signed up {new Date(p.created_at).toLocaleDateString()}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => decide(p.id, "approved")}
                  disabled={busyId === p.id}
                  className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                  style={{ background: "var(--color-fairway)" }}
                >
                  Approve
                </button>
                <button
                  onClick={() => decide(p.id, "rejected")}
                  disabled={busyId === p.id}
                  className="rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-60"
                  style={{ background: "var(--color-surface-tan)" }}
                >
                  Reject
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}