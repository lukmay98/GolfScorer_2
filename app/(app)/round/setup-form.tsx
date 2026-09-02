"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Golfer = { id: string; name: string; handicap: number };
type Course = { id: string; name: string };

const REQUIRED_PLAYERS: Record<string, number> = { "4-2-0": 3, matchplay: 2 };

export default function RoundSetupForm({ onCreated }: { onCreated: () => void }) {
  const supabase = useMemo(() => createClient(), []);

  const [format, setFormat] = useState<"4-2-0" | "matchplay">("4-2-0");
  const [holeRange, setHoleRange] = useState<"front9" | "back9" | "full18">("full18");
  const [allowance, setAllowance] = useState("100");
  const [cap, setCap] = useState("");

  const [courseQuery, setCourseQuery] = useState("");
  const [courseResults, setCourseResults] = useState<(Course & { holeCount: number; totalPar: number })[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<(Course & { holeCount: number; totalPar: number }) | null>(null);

  const [playerQuery, setPlayerQuery] = useState("");
  const [playerResults, setPlayerResults] = useState<Golfer[]>([]);
  const [selectedPlayers, setSelectedPlayers] = useState<Golfer[]>([]);

  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const requiredCount = REQUIRED_PLAYERS[format];

  async function searchCourses(q: string) {
    setCourseQuery(q);
    if (!q.trim()) {
      setCourseResults([]);
      return;
    }
    const { data: courses } = await supabase
      .from("courses")
      .select("id, name")
      .ilike("name", `%${q.trim()}%`)
      .limit(8);
    if (!courses) return;

    const withHoles = await Promise.all(
      courses.map(async (c) => {
        const { data: holes } = await supabase
          .from("course_holes")
          .select("par")
          .eq("course_id", c.id);
        return {
          ...c,
          holeCount: holes?.length ?? 0,
          totalPar: holes?.reduce((s, h) => s + h.par, 0) ?? 0,
        };
      })
    );
    setCourseResults(withHoles);
  }

  async function searchPlayers(q: string) {
    setPlayerQuery(q);
    if (!q.trim()) {
      setPlayerResults([]);
      return;
    }
    const { data } = await supabase
      .from("golfers")
      .select("id, name, handicap")
      .ilike("name", `%${q.trim()}%`)
      .limit(8);
    setPlayerResults(data ?? []);
  }

  function addPlayer(g: Golfer) {
    if (selectedPlayers.some((p) => p.id === g.id)) return;
    if (selectedPlayers.length >= requiredCount) return;
    setSelectedPlayers((prev) => [...prev, g]);
    setPlayerQuery("");
    setPlayerResults([]);
  }

  function removePlayer(id: string) {
    setSelectedPlayers((prev) => prev.filter((p) => p.id !== id));
  }

  function handleFormatChange(f: "4-2-0" | "matchplay") {
    setFormat(f);
    setSelectedPlayers([]);
    if (f === "4-2-0") setCap("");
  }

  async function handleStart(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!selectedCourse) {
      setError("Choose a course.");
      return;
    }
    if (selectedPlayers.length !== requiredCount) {
      setError(`${format === "4-2-0" ? "4-2-0" : "Matchplay"} needs exactly ${requiredCount} golfers.`);
      return;
    }
    const allowanceNum = Number(allowance);
    if (Number.isNaN(allowanceNum) || allowanceNum < 0 || allowanceNum > 100) {
      setError("Handicap allowance must be between 0 and 100.");
      return;
    }
    let capNum: number | null = null;
    if (format === "matchplay" && cap.trim()) {
      capNum = Number(cap);
      if (Number.isNaN(capNum) || capNum < 1 || capNum > 18) {
        setError("Matchplay cap must be between 1 and 18.");
        return;
      }
    }

    const holeStart = holeRange === "back9" ? 10 : 1;
    const holeEnd = holeRange === "front9" ? 9 : 18;

    setSaving(true);
    const { data: round, error: roundError } = await supabase
      .from("rounds")
      .insert({
        format,
        course_id: selectedCourse.id,
        hole_start: holeStart,
        hole_end: holeEnd,
        handicap_allowance: allowanceNum,
        matchplay_cap: capNum,
        status: "active",
      })
      .select()
      .single();

    if (roundError || !round) {
      setSaving(false);
      setError(
        roundError?.code === "23505"
          ? "A round is already active. Finish or pause it first."
          : roundError?.message ?? "Could not start round."
      );
      return;
    }

    const roundPlayers = selectedPlayers.map((p, i) => ({
      round_id: round.id,
      golfer_id: p.id,
      handicap_snapshot: p.handicap,
      player_order: i,
    }));
    const { error: playersError } = await supabase.from("round_players").insert(roundPlayers);
    setSaving(false);

    if (playersError) {
      setError(playersError.message);
      await supabase.from("rounds").delete().eq("id", round.id);
      return;
    }

    onCreated();
  }

  return (
    <form
      onSubmit={handleStart}
      className="rounded-xl border p-4 space-y-4"
      style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}
    >
      <h2 className="text-sm font-semibold">Start a round</h2>

      {/* Format */}
      <div>
        <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--color-text-muted)" }}>
          Game format
        </label>
        <div className="grid grid-cols-2 gap-2">
          {(["4-2-0", "matchplay"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => handleFormatChange(f)}
              className="rounded-lg border py-2 text-sm font-medium capitalize"
              style={{
                borderColor: format === f ? "var(--color-fairway)" : "var(--color-border)",
                background: format === f ? "var(--color-fairway-soft)" : "transparent",
                color: format === f ? "var(--color-fairway)" : "var(--color-text)",
              }}
            >
              {f === "4-2-0" ? "4-2-0 (3 golfers)" : "Matchplay (2 golfers)"}
            </button>
          ))}
        </div>
      </div>

      {/* Course */}
      <div>
        <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--color-text-muted)" }}>
          Course
        </label>
        {selectedCourse ? (
          <div
            className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm"
            style={{ borderColor: "var(--color-border)" }}
          >
            <span>
              {selectedCourse.name}{" "}
              <span className="tabular" style={{ color: "var(--color-text-muted)" }}>
                · {selectedCourse.holeCount} holes · Par {selectedCourse.totalPar}
              </span>
            </span>
            <button type="button" onClick={() => setSelectedCourse(null)} className="text-xs font-medium" style={{ color: "var(--color-flag)" }}>
              Remove
            </button>
          </div>
        ) : (
          <>
            <input
              value={courseQuery}
              onChange={(e) => searchCourses(e.target.value)}
              placeholder="Search courses…"
              className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
              style={{ borderColor: "var(--color-border)" }}
            />
            {courseResults.length > 0 && (
              <ul className="mt-1.5 rounded-lg border divide-y overflow-hidden" style={{ borderColor: "var(--color-border)" }}>
                {courseResults.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCourse(c);
                        setCourseQuery("");
                        setCourseResults([]);
                      }}
                      className="w-full text-left px-3 py-2 text-sm"
                      style={{ background: "var(--color-surface)" }}
                    >
                      {c.name}{" "}
                      <span className="tabular" style={{ color: "var(--color-text-muted)" }}>
                        · {c.holeCount} holes · Par {c.totalPar}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>

      {/* Hole range */}
      <div>
        <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--color-text-muted)" }}>
          Holes
        </label>
        <div className="grid grid-cols-3 gap-2">
          {(["front9", "back9", "full18"] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setHoleRange(r)}
              className="rounded-lg border py-2 text-xs font-medium"
              style={{
                borderColor: holeRange === r ? "var(--color-fairway)" : "var(--color-border)",
                background: holeRange === r ? "var(--color-fairway-soft)" : "transparent",
                color: holeRange === r ? "var(--color-fairway)" : "var(--color-text)",
              }}
            >
              {r === "front9" ? "Front 9" : r === "back9" ? "Back 9" : "Full 18"}
            </button>
          ))}
        </div>
      </div>

      {/* Players */}
      <div>
        <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--color-text-muted)" }}>
          Players ({selectedPlayers.length}/{requiredCount})
        </label>
        {selectedPlayers.length > 0 && (
          <ul className="space-y-1.5 mb-2">
            {selectedPlayers.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between rounded-lg border px-3 py-1.5 text-sm"
                style={{ borderColor: "var(--color-border)" }}
              >
                <span>
                  {p.name} <span className="tabular text-xs" style={{ color: "var(--color-text-muted)" }}>· Hcp {p.handicap}</span>
                </span>
                <button type="button" onClick={() => removePlayer(p.id)} className="text-xs font-medium" style={{ color: "var(--color-flag)" }}>
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
        {selectedPlayers.length < requiredCount && (
          <>
            <input
              value={playerQuery}
              onChange={(e) => searchPlayers(e.target.value)}
              placeholder="Search golfers…"
              className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
              style={{ borderColor: "var(--color-border)" }}
            />
            {playerResults.length > 0 && (
              <ul className="mt-1.5 rounded-lg border divide-y overflow-hidden" style={{ borderColor: "var(--color-border)" }}>
                {playerResults.map((g) => (
                  <li key={g.id}>
                    <button
                      type="button"
                      onClick={() => addPlayer(g)}
                      className="w-full text-left px-3 py-2 text-sm"
                      style={{ background: "var(--color-surface)" }}
                    >
                      {g.name} <span className="tabular text-xs" style={{ color: "var(--color-text-muted)" }}>· Hcp {g.handicap}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>

      {/* Handicap allowance */}
      <div>
        <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--color-text-muted)" }}>
          Handicap allowance (%)
        </label>
        <input
          value={allowance}
          onChange={(e) => setAllowance(e.target.value)}
          inputMode="numeric"
          className="w-full rounded-lg border px-3 py-2 text-sm outline-none tabular"
          style={{ borderColor: "var(--color-border)" }}
        />
      </div>

      {/* Matchplay cap */}
      {format === "matchplay" && (
        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--color-text-muted)" }}>
            Points cap (optional, 1–18)
          </label>
          <input
            value={cap}
            onChange={(e) => setCap(e.target.value)}
            inputMode="numeric"
            placeholder="No cap"
            className="w-full rounded-lg border px-3 py-2 text-sm outline-none tabular"
            style={{ borderColor: "var(--color-border)" }}
          />
        </div>
      )}

      {error && (
        <p className="text-xs rounded-lg px-3 py-2" style={{ background: "var(--color-flag-soft)", color: "var(--color-flag)" }}>
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={saving}
        className="w-full rounded-lg py-2.5 text-sm font-semibold text-white disabled:opacity-60"
        style={{ background: "var(--color-fairway)" }}
      >
        {saving ? "Starting…" : "Start round"}
      </button>
    </form>
  );
}
