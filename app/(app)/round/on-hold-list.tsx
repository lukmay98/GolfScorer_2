"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type OnHoldRound = {
  id: string;
  format: "4-2-0" | "matchplay";
  handicap_allowance: number;
  matchplay_cap: number | null;
  course_name: string;
  players: string[];
  scoredHoles: number;
  totalHoles: number;
};

export default function OnHoldList({ onResumed }: { onResumed: () => void }) {
  const supabase = useMemo(() => createClient(), []);
  const [rounds, setRounds] = useState<OnHoldRound[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const { data: rawRounds } = await supabase
      .from("rounds")
      .select("id, format, handicap_allowance, matchplay_cap, hole_start, hole_end, course_id, courses(name)")
      .eq("status", "on_hold")
      .order("created_at", { ascending: false });

    if (!rawRounds) {
      setRounds([]);
      setLoading(false);
      return;
    }

    const enriched = await Promise.all(
      rawRounds.map(async (r) => {
        const { data: rp } = await supabase
          .from("round_players")
          .select("golfers(name)")
          .eq("round_id", r.id);
        const players = (rp ?? []).map((row) => {
          const g = row.golfers as unknown as { name: string } | { name: string }[];
          return Array.isArray(g) ? g[0]?.name : g?.name;
        }).filter(Boolean) as string[];

        const { data: scores } = await supabase
          .from("scores")
          .select("hole_number")
          .eq("round_id", r.id);
        const perHoleCount: Record<number, number> = {};
        for (const s of scores ?? []) {
          perHoleCount[s.hole_number] = (perHoleCount[s.hole_number] ?? 0) + 1;
        }
        const scoredHoles = Object.entries(perHoleCount).filter(
          ([, count]) => count >= players.length
        ).length;

        const course = r.courses as unknown as { name: string } | { name: string }[];
        const courseName = Array.isArray(course) ? course[0]?.name : course?.name;

        return {
          id: r.id,
          format: r.format,
          handicap_allowance: r.handicap_allowance,
          matchplay_cap: r.matchplay_cap,
          course_name: courseName ?? "Unknown course",
          players,
          scoredHoles,
          totalHoles: r.hole_end - r.hole_start + 1,
        };
      })
    );

    setRounds(enriched);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleResume(id: string) {
    setError(null);
    setBusyId(id);
    const { error } = await supabase.from("rounds").update({ status: "active" }).eq("id", id);
    setBusyId(null);
    if (error) {
      setError(
        error.code === "23505"
          ? "A round is already active. Finish or pause it first."
          : error.message
      );
      return;
    }
    onResumed();
  }

  async function handleDelete(id: string) {
    setBusyId(id);
    const { error } = await supabase.from("rounds").delete().eq("id", id);
    setBusyId(null);
    if (error) {
      setError(error.message);
      return;
    }
    setConfirmDeleteId(null);
    load();
  }

  if (loading) return null;
  if (rounds.length === 0) return null;

  return (
    <div className="space-y-2">
      <h2 className="text-sm font-semibold px-1">On hold</h2>
      {error && (
        <p className="text-xs rounded-lg px-3 py-2" style={{ background: "var(--color-flag-soft)", color: "var(--color-flag)" }}>
          {error}
        </p>
      )}
      {rounds.map((r) => (
        <div
          key={r.id}
          className="rounded-xl border p-3.5"
          style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium">
                {r.course_name} <span style={{ color: "var(--color-text-muted)" }}>· {r.format === "4-2-0" ? "4-2-0" : "Matchplay"}</span>
              </p>
              <p className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>
                {r.players.join(", ")}
              </p>
              <p className="text-xs mt-0.5 tabular" style={{ color: "var(--color-text-muted)" }}>
                Hcp allowance {r.handicap_allowance}%
                {r.matchplay_cap ? ` · Cap ${r.matchplay_cap}` : ""} · {r.scoredHoles}/{r.totalHoles} holes scored
              </p>
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => handleResume(r.id)}
              disabled={busyId === r.id}
              className="flex-1 rounded-lg py-1.5 text-xs font-semibold text-white disabled:opacity-60"
              style={{ background: "var(--color-fairway)" }}
            >
              Resume round
            </button>
            {confirmDeleteId === r.id ? (
              <>
                <button
                  onClick={() => handleDelete(r.id)}
                  disabled={busyId === r.id}
                  className="rounded-lg px-3 py-1.5 text-xs font-semibold"
                  style={{ background: "var(--color-flag-soft)", color: "var(--color-flag)" }}
                >
                  Confirm delete
                </button>
                <button
                  onClick={() => setConfirmDeleteId(null)}
                  className="rounded-lg px-3 py-1.5 text-xs font-semibold"
                  style={{ background: "var(--color-surface-tan)" }}
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                onClick={() => setConfirmDeleteId(r.id)}
                className="rounded-lg px-3 py-1.5 text-xs font-semibold"
                style={{ background: "var(--color-surface-tan)" }}
              >
                Delete
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
