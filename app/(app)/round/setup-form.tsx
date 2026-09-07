"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Golfer = { id: string; name: string; handicap: number };
type Course = { id: string; name: string };
type Format = "4-2-0" | "matchplay" | "wolf" | "stableford";

const PLAYER_RANGE: Record<Format, { min: number; max: number }> = {
  "4-2-0": { min: 3, max: 3 },
  matchplay: { min: 2, max: 2 },
  wolf: { min: 4, max: 4 },
  stableford: { min: 1, max: 4 },
};

export default function RoundSetupForm({ onCreated }: { onCreated: () => void }) {
  const supabase = useMemo(() => createClient(), []);

  const [userId, setUserId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    async function loadMe() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUserId(user?.id ?? null);
      const res = await fetch("/api/me");
      if (res.ok) {
        const data = await res.json();
        setIsAdmin(data.isAdmin);
      }
    }
    loadMe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [format, setFormat] = useState<Format>("4-2-0");
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
  const [showInfo, setShowInfo] = useState(false);

  const { min: minPlayers, max: maxPlayers } = PLAYER_RANGE[format];

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
    let query = supabase.from("golfers").select("id, name, handicap").ilike("name", `%${q.trim()}%`).limit(8);
    if (!isAdmin && userId) {
      query = query.eq("created_by", userId);
    }
    const { data } = await query;
    setPlayerResults(data ?? []);
  }

  function addPlayer(g: Golfer) {
    if (selectedPlayers.some((p) => p.id === g.id)) return;
    if (selectedPlayers.length >= maxPlayers) return;
    setSelectedPlayers((prev) => [...prev, g]);
    setPlayerQuery("");
    setPlayerResults([]);
  }

  function removePlayer(id: string) {
    setSelectedPlayers((prev) => prev.filter((p) => p.id !== id));
  }

  function handleFormatChange(f: Format) {
    setFormat(f);
    setSelectedPlayers([]);
    if (f !== "matchplay") setCap("");
  }

  const FORMAT_LABEL: Record<Format, string> = {
    "4-2-0": "4-2-0",
    matchplay: "Matchplay",
    wolf: "Wolf",
    stableford: "Stableford",
  };

  async function handleStart(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!selectedCourse) {
      setError("Choose a course.");
      return;
    }
    if (selectedPlayers.length < minPlayers || selectedPlayers.length > maxPlayers) {
      setError(
        minPlayers === maxPlayers
          ? `${FORMAT_LABEL[format]} needs exactly ${maxPlayers} golfers.`
          : `${FORMAT_LABEL[format]} needs between ${minPlayers} and ${maxPlayers} golfers.`
      );
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
        created_by: userId,
      })
      .select()
      .single();

    if (roundError || !round) {
      setSaving(false);
      setError(
        roundError?.code === "23505"
          ? "You already have an active round. Finish or pause it first."
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
        <div className="flex items-center justify-between mb-1.5">
          <label className="block text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>
            Game format
          </label>
          <button
            type="button"
            onClick={() => setShowInfo((s) => !s)}
            className="flex items-center justify-center h-4 w-4 rounded-full text-[10px] font-bold"
            style={{ background: "var(--color-fairway)", color: "white" }}
            aria-label="How do these formats work?"
          >
            i
          </button>
        </div>

        {showInfo && (
          <div
            className="mb-2 rounded-lg border p-3 text-xs space-y-3"
            style={{ borderColor: "var(--color-border)", background: "var(--color-fairway-soft)", color: "var(--color-fairway)" }}
          >
            <div>
              <p className="font-semibold">4-2-0</p>
              <p>Three golfers. On every hole, best net score gets 4 points, second gets 2, worst gets 0. Ties
                split the points for the ranks they occupy.</p>
            </div>
            <div>
              <p className="font-semibold">Matchplay</p>
              <p>Two golfers. Lower net score wins the hole for 1 point; a tie is worth 0. An optional cap limits
                how far the leader can pull ahead.</p>
            </div>
            <div>
              <p className="font-semibold">Wolf</p>
              <p>Four golfers, tee order fixed at the start. One player is the Wolf each hole (rotating through
                that order), and picks one of three moves:</p>
              <ul className="list-disc list-inside mt-1 space-y-0.5">
                <li><strong>Team</strong> — partners with one other golfer, 2v2 best net. Winning pair gets 1 point each; a tie scores nothing.</li>
                <li><strong>Lone Wolf</strong> — plays alone against the other three after seeing their tee shots. Wolf gets 2 points for winning outright; anything else (loss or tie) gives the other three 1 point each.</li>
                <li><strong>Blind Wolf</strong> — declares solo before anyone has hit, for higher risk. Wolf gets 3 points for winning outright; anything else gives the other three 1 point each.</li>
              </ul>
            </div>
            <div>
              <p className="font-semibold">Stableford</p>
              <p>1 to 4 golfers, each scored independently against par — no head-to-head comparison. Every hole is
                worth 2 points at par, +1 for each stroke better, −1 for each stroke worse, down to a minimum of 0
                (so one disaster hole can&apos;t sink your round). Tracked separately for gross and net (handicap-adjusted)
                scores, with a running strokes-to-par tally for gross.</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-2">
          {(["4-2-0", "matchplay", "wolf", "stableford"] as const).map((f) => (
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
              {f === "4-2-0"
                ? "4-2-0 (3 golfers)"
                : f === "matchplay"
                ? "Matchplay (2 golfers)"
                : f === "wolf"
                ? "Wolf (4 golfers)"
                : "Stableford (1–4 golfers)"}
            </button>
          ))}
        </div>
        {format === "wolf" && (
          <p className="mt-1.5 text-xs" style={{ color: "var(--color-text-muted)" }}>
            The order you add players below sets the tee order — the Wolf rotates through that order, one player
            per hole, for the whole round.
          </p>
        )}
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
          Players ({selectedPlayers.length}/{maxPlayers}{minPlayers !== maxPlayers ? `, min ${minPlayers}` : ""})
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
        {selectedPlayers.length < maxPlayers && (
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