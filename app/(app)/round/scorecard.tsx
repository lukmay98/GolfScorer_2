"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  CourseHole,
  RoundPlayerInfo,
  WolfDecision,
  fourTwoZeroHolePoints,
  holeRangeNumbers,
  matchplayRoundPoints,
  stablefordRoundTotals,
  strokesForRound,
  strokesForRoundAbsolute,
  wolfForHole,
  wolfRoundPoints,
} from "@/lib/scoring";

type RoundRow = {
  id: string;
  format: "4-2-0" | "matchplay" | "wolf" | "stableford";
  hole_start: number;
  hole_end: number;
  handicap_allowance: number;
  matchplay_cap: number | null;
  course_id: string;
};

const FORMAT_LABEL: Record<RoundRow["format"], string> = {
  "4-2-0": "4-2-0",
  matchplay: "Matchplay",
  wolf: "Wolf",
  stableford: "Stableford",
};

export default function ActiveRoundCard({
  roundId,
  onChanged,
}: {
  roundId: string;
  onChanged: () => void;
}) {
  const supabase = useMemo(() => createClient(), []);

  const [round, setRound] = useState<RoundRow | null>(null);
  const [courseName, setCourseName] = useState("");
  const [holes, setHoles] = useState<CourseHole[]>([]);
  const [players, setPlayers] = useState<RoundPlayerInfo[]>([]);
  // scores[golfer_id][hole_number] = gross
  const [scores, setScores] = useState<Record<string, Record<number, number>>>({});
  const [inputs, setInputs] = useState<Record<string, Record<number, string>>>({});
  // wolfDecisions[hole_number] = decision made for that hole, undefined = not decided
  const [wolfDecisions, setWolfDecisions] = useState<Record<number, WolfDecision | undefined>>({});
  const [loading, setLoading] = useState(true);
  const [currentHole, setCurrentHole] = useState<number | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    setLoading(true);
    const { data: r } = await supabase
      .from("rounds")
      .select("id, format, hole_start, hole_end, handicap_allowance, matchplay_cap, course_id")
      .eq("id", roundId)
      .single();
    if (!r) {
      setLoading(false);
      return;
    }
    setRound(r);
    setCurrentHole((prev) => prev ?? r.hole_start);

    const { data: course } = await supabase.from("courses").select("name").eq("id", r.course_id).single();
    setCourseName(course?.name ?? "");

    const { data: courseHoles } = await supabase
      .from("course_holes")
      .select("hole_number, par, handicap_index")
      .eq("course_id", r.course_id)
      .gte("hole_number", r.hole_start)
      .lte("hole_number", r.hole_end)
      .order("hole_number");
    setHoles(courseHoles ?? []);

    const { data: rp } = await supabase
      .from("round_players")
      .select("golfer_id, handicap_snapshot, player_order, golfers(name)")
      .eq("round_id", roundId)
      .order("player_order");
    const playerInfo: RoundPlayerInfo[] = (rp ?? []).map((row) => {
      const g = row.golfers as unknown as { name: string } | { name: string }[];
      const name = Array.isArray(g) ? g[0]?.name : g?.name;
      return { golfer_id: row.golfer_id, name: name ?? "Unknown", handicap_snapshot: row.handicap_snapshot };
    });
    setPlayers(playerInfo);

    const { data: scoreRows } = await supabase
      .from("scores")
      .select("golfer_id, hole_number, gross_score")
      .eq("round_id", roundId);
    const scoreMap: Record<string, Record<number, number>> = {};
    const inputMap: Record<string, Record<number, string>> = {};
    for (const p of playerInfo) {
      scoreMap[p.golfer_id] = {};
      inputMap[p.golfer_id] = {};
    }
    for (const s of scoreRows ?? []) {
      scoreMap[s.golfer_id] = { ...scoreMap[s.golfer_id], [s.hole_number]: s.gross_score };
      inputMap[s.golfer_id] = { ...inputMap[s.golfer_id], [s.hole_number]: String(s.gross_score) };
    }
    setScores(scoreMap);
    setInputs(inputMap);

    if (r.format === "wolf") {
      const { data: decisionRows } = await supabase
        .from("wolf_decisions")
        .select("hole_number, partner_golfer_id, decision_type")
        .eq("round_id", roundId);
      const decisionMap: Record<number, WolfDecision | undefined> = {};
      for (const d of decisionRows ?? []) {
        decisionMap[d.hole_number] = {
          type: d.decision_type as WolfDecision["type"],
          partnerId: d.partner_golfer_id,
        };
      }
      setWolfDecisions(decisionMap);
    }

    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roundId]);

  const holeNumbers = round ? holeRangeNumbers(round.hole_start, round.hole_end) : [];
  const strokes = round && players.length > 0 ? strokesForRound(players, round.handicap_allowance, holes) : {};
  const absoluteStrokes =
    round && players.length > 0 ? strokesForRoundAbsolute(players, round.handicap_allowance, holes) : {};
  const playerIdsInTeeOrder = players.map((p) => p.golfer_id);

  const netByGolfer = useMemo(() => {
    const result: Record<string, Record<number, number>> = {};
    for (const p of players) {
      result[p.golfer_id] = {};
      for (const h of holeNumbers) {
        const gross = scores[p.golfer_id]?.[h];
        if (gross === undefined) continue;
        const strokeCount = strokes[p.golfer_id]?.[h] ?? 0;
        result[p.golfer_id][h] = gross - strokeCount;
      }
    }
    return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scores, players, holes, round?.handicap_allowance]);

  // Stableford scores each player against a fixed target (par), not against
  // each other, so it needs each player's FULL handicap strokes rather than
  // the relative-to-lowest-in-round strokes the other formats use.
  const netByGolferAbsolute = useMemo(() => {
    const result: Record<string, Record<number, number>> = {};
    for (const p of players) {
      result[p.golfer_id] = {};
      for (const h of holeNumbers) {
        const gross = scores[p.golfer_id]?.[h];
        if (gross === undefined) continue;
        const strokeCount = absoluteStrokes[p.golfer_id]?.[h] ?? 0;
        result[p.golfer_id][h] = gross - strokeCount;
      }
    }
    return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scores, players, holes, round?.handicap_allowance]);

  const pointsResult = useMemo(() => {
    if (!round) return { totals: {} as Record<string, number>, perHole: {} as Record<number, Record<string, number>> };

    if (round.format === "4-2-0") {
      const totals: Record<string, number> = {};
      const perHole: Record<number, Record<string, number>> = {};
      for (const p of players) totals[p.golfer_id] = 0;
      for (const h of holeNumbers) {
        const nets = players
          .map((p) => ({ golfer_id: p.golfer_id, net: netByGolfer[p.golfer_id]?.[h] }))
          .filter((n): n is { golfer_id: string; net: number } => n.net !== undefined);
        if (nets.length !== players.length) continue;
        const holePoints = fourTwoZeroHolePoints(nets);
        perHole[h] = holePoints;
        for (const gid of Object.keys(holePoints)) totals[gid] += holePoints[gid];
      }
      return { totals, perHole };
    } else if (round.format === "matchplay") {
      const [a, b] = players.map((p) => p.golfer_id) as [string, string];
      if (!a || !b) return { totals: {}, perHole: {} };
      const { totals, perHole } = matchplayRoundPoints(holeNumbers, netByGolfer, [a, b], round.matchplay_cap);
      const perHoleGeneric: Record<number, Record<string, number>> = {};
      for (const [h, v] of Object.entries(perHole)) {
        perHoleGeneric[Number(h)] = { [a]: v.pointsA, [b]: v.pointsB };
      }
      return { totals, perHole: perHoleGeneric };
    } else if (round.format === "wolf") {
      const { totals, perHole } = wolfRoundPoints(holeNumbers, playerIdsInTeeOrder, wolfDecisions, netByGolfer);
      return { totals, perHole };
    } else {
      // Stableford's leaderboard uses stablefordResult below instead — this
      // branch just keeps the type happy for formats that don't use it.
      return { totals: {} as Record<string, number>, perHole: {} as Record<number, Record<string, number>> };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [netByGolfer, players, holeNumbers, round?.format, round?.matchplay_cap, wolfDecisions]);

  const stablefordResult = useMemo(() => {
    if (!round || round.format !== "stableford") return null;
    const parByHole: Record<number, number> = {};
    for (const h of holes) parByHole[h.hole_number] = h.par;
    return stablefordRoundTotals(holeNumbers, playerIdsInTeeOrder, scores, netByGolferAbsolute, parByHole);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scores, netByGolferAbsolute, holes, holeNumbers, round?.format]);

  const requiredCount = players.length;
  const allScored = holeNumbers.every((h) =>
    players.every((p) => scores[p.golfer_id]?.[h] !== undefined)
  );
  const allWolfDecided = holeNumbers.every((h) => wolfDecisions[h] !== undefined);
  const canFinish = round?.format === "wolf" ? allScored && allWolfDecided : allScored;

  async function saveScore(golferId: string, hole: number, value: string) {
    setInputs((prev) => ({ ...prev, [golferId]: { ...prev[golferId], [hole]: value } }));
    if (value.trim() === "") return;
    const gross = Number(value);
    if (Number.isNaN(gross) || gross < 1 || gross > 20) {
      setSaveError("Gross score must be between 1 and 20.");
      return;
    }
    setSaveError(null);
    const { error } = await supabase
      .from("scores")
      .upsert(
        { round_id: roundId, golfer_id: golferId, hole_number: hole, gross_score: gross },
        { onConflict: "round_id,golfer_id,hole_number" }
      );
    if (error) {
      setSaveError(error.message);
      return;
    }
    setScores((prev) => ({ ...prev, [golferId]: { ...prev[golferId], [hole]: gross } }));
  }

  async function setWolfDecision(hole: number, decision: WolfDecision) {
    setSaveError(null);
    const { error } = await supabase
      .from("wolf_decisions")
      .upsert(
        {
          round_id: roundId,
          hole_number: hole,
          decision_type: decision.type,
          partner_golfer_id: decision.partnerId,
        },
        { onConflict: "round_id,hole_number" }
      );
    if (error) {
      setSaveError(error.message);
      return;
    }
    setWolfDecisions((prev) => ({ ...prev, [hole]: decision }));
  }

  function clearWolfDecisionUI(hole: number) {
    setWolfDecisions((prev) => {
      const next = { ...prev };
      delete next[hole];
      return next;
    });
  }

  async function handlePause() {
    setBusy(true);
    await supabase.from("rounds").update({ status: "on_hold" }).eq("id", roundId);
    setBusy(false);
    onChanged();
  }

  async function handleFinish() {
    setBusy(true);
    await supabase
      .from("rounds")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("id", roundId);
    setBusy(false);
    onChanged();
  }

  if (loading || !round) {
    return <p className="text-sm px-1" style={{ color: "var(--color-text-muted)" }}>Loading round…</p>;
  }

  const hole = holes.find((h) => h.hole_number === currentHole);
  const holeIndex = currentHole ? holeNumbers.indexOf(currentHole) : -1;

  const sortedLeaderboard = [...players].sort((a, b) => {
    if (round.format === "stableford" && stablefordResult) {
      return (stablefordResult.netPoints[b.golfer_id] ?? 0) - (stablefordResult.netPoints[a.golfer_id] ?? 0);
    }
    return (pointsResult.totals[b.golfer_id] ?? 0) - (pointsResult.totals[a.golfer_id] ?? 0);
  });

  const currentWolfId =
    round.format === "wolf" && holeIndex >= 0 ? wolfForHole(playerIdsInTeeOrder, holeIndex) : null;
  const currentWolf = currentWolfId ? players.find((p) => p.golfer_id === currentWolfId) : null;
  const currentDecision = currentHole !== null ? wolfDecisions[currentHole] : undefined;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between px-1">
        <div>
          <p className="text-sm font-semibold">{courseName}</p>
          <p className="text-xs tabular" style={{ color: "var(--color-text-muted)" }}>
            {FORMAT_LABEL[round.format]} · Hcp {round.handicap_allowance}%
            {round.matchplay_cap ? ` · Cap ${round.matchplay_cap}` : ""}
          </p>
        </div>
        <button
          onClick={handlePause}
          disabled={busy}
          className="rounded-lg px-3 py-1.5 text-xs font-semibold"
          style={{ background: "var(--color-surface-tan)" }}
        >
          Pause round
        </button>
      </div>

      {/* Leaderboard */}
      <div
        className="rounded-xl border p-3.5"
        style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}
      >
        <p className="text-xs font-semibold mb-2" style={{ color: "var(--color-text-muted)" }}>
          Leaderboard
        </p>
        <ul className="space-y-1.5">
          {sortedLeaderboard.map((p, i) => (
            <li key={p.golfer_id} className="flex items-center justify-between text-sm">
              <span>
                <span className="tabular mr-1.5" style={{ color: "var(--color-text-muted)" }}>{i + 1}.</span>
                {p.name}
              </span>
              {round.format === "stableford" && stablefordResult ? (
                <span className="text-right">
                  <span className="font-semibold tabular" style={{ color: "var(--color-fairway)" }}>
                    {stablefordResult.netPoints[p.golfer_id] ?? 0} net
                  </span>
                  <span className="block text-xs tabular" style={{ color: "var(--color-text-muted)" }}>
                    {stablefordResult.grossPoints[p.golfer_id] ?? 0} gross ·{" "}
                    {(stablefordResult.toPar[p.golfer_id] ?? 0) > 0 ? "+" : ""}
                    {stablefordResult.toPar[p.golfer_id] ?? 0} to par
                  </span>
                </span>
              ) : (
                <span className="font-semibold tabular" style={{ color: "var(--color-fairway)" }}>
                  {pointsResult.totals[p.golfer_id] ?? 0}
                </span>
              )}
            </li>
          ))}
        </ul>
      </div>

      {/* Hole navigator */}
      <div
        className="rounded-xl border p-4"
        style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}
      >
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={() => setCurrentHole(holeNumbers[holeIndex - 1] ?? currentHole)}
            disabled={holeIndex <= 0}
            className="rounded-lg px-3 py-1.5 text-sm font-semibold disabled:opacity-30"
            style={{ background: "var(--color-surface-tan)" }}
          >
            ← Prev
          </button>
          <div className="text-center">
            <p className="font-display text-lg font-bold tabular" style={{ color: "var(--color-fairway)" }}>
              Hole {currentHole}
            </p>
            {hole && (
              <p className="text-xs tabular" style={{ color: "var(--color-text-muted)" }}>
                Par {hole.par} · Hcp index {hole.handicap_index}
              </p>
            )}
          </div>
          <button
            onClick={() => setCurrentHole(holeNumbers[holeIndex + 1] ?? currentHole)}
            disabled={holeIndex >= holeNumbers.length - 1}
            className="rounded-lg px-3 py-1.5 text-sm font-semibold disabled:opacity-30"
            style={{ background: "var(--color-surface-tan)" }}
          >
            Next →
          </button>
        </div>

        {/* Wolf decision — shown first so it's clear what to do before/while scoring this hole */}
        {round.format === "wolf" && currentWolf && currentHole !== null && (
          <div
            className="mb-3 rounded-lg border p-3"
            style={{ borderColor: "var(--color-fairway)", background: "var(--color-fairway-soft)" }}
          >
            {!currentDecision ? (
              <>
                <p className="text-sm font-semibold" style={{ color: "var(--color-fairway)" }}>
                  🐺 {currentWolf.name} is the Wolf this hole
                </p>
                <p className="text-xs mt-0.5 mb-2" style={{ color: "var(--color-fairway)" }}>
                  Pick a partner, go Lone Wolf after seeing everyone&apos;s tee shot, or declare Blind Wolf before
                  anyone hits (higher risk, higher reward).
                </p>
                <div className="flex flex-wrap gap-2">
                  {players
                    .filter((p) => p.golfer_id !== currentWolfId)
                    .map((p) => (
                      <button
                        key={p.golfer_id}
                        onClick={() => setWolfDecision(currentHole, { type: "team", partnerId: p.golfer_id })}
                        className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white"
                        style={{ background: "var(--color-fairway)" }}
                      >
                        Partner: {p.name}
                      </button>
                    ))}
                  <button
                    onClick={() => setWolfDecision(currentHole, { type: "lone", partnerId: null })}
                    className="rounded-lg px-3 py-1.5 text-xs font-semibold"
                    style={{ background: "var(--color-surface)", color: "var(--color-fairway)" }}
                  >
                    Lone Wolf
                  </button>
                  <button
                    onClick={() => setWolfDecision(currentHole, { type: "blind", partnerId: null })}
                    className="rounded-lg px-3 py-1.5 text-xs font-semibold"
                    style={{ background: "var(--color-surface)", color: "var(--color-flag)" }}
                  >
                    Blind Wolf
                  </button>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-between">
                <p className="text-sm" style={{ color: "var(--color-fairway)" }}>
                  🐺 <strong>{currentWolf.name}</strong>{" "}
                  {currentDecision.type === "team" ? (
                    <>partnered with <strong>{players.find((p) => p.golfer_id === currentDecision.partnerId)?.name}</strong></>
                  ) : currentDecision.type === "blind" ? (
                    <>went <strong>Blind Wolf</strong></>
                  ) : (
                    <>is playing <strong>Lone Wolf</strong></>
                  )}
                </p>
                <button
                  onClick={() => clearWolfDecisionUI(currentHole)}
                  className="text-xs font-medium"
                  style={{ color: "var(--color-fairway)" }}
                >
                  Change
                </button>
              </div>
            )}
          </div>
        )}

        <div className="space-y-2">
          {players.map((p) => {
            const isStableford = round.format === "stableford";
            const strokeCount = currentHole
              ? (isStableford ? absoluteStrokes : strokes)[p.golfer_id]?.[currentHole] ?? 0
              : 0;
            const net = currentHole
              ? (isStableford ? netByGolferAbsolute : netByGolfer)[p.golfer_id]?.[currentHole]
              : undefined;
            const holePoints =
              isStableford && currentHole !== null ? stablefordResult?.perHole[currentHole]?.[p.golfer_id] : undefined;
            return (
              <div
                key={p.golfer_id}
                className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2"
                style={{ borderColor: "var(--color-border)" }}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{p.name}</p>
                  <p className="text-xs tabular" style={{ color: "var(--color-text-muted)" }}>
                    {strokeCount > 0 ? `+${strokeCount} stroke${strokeCount > 1 ? "s" : ""}` : "No stroke"}
                    {net !== undefined ? ` · Net ${net}` : ""}
                    {holePoints !== undefined ? ` · ${holePoints.netPoints} pt${holePoints.netPoints === 1 ? "" : "s"}` : ""}
                  </p>
                </div>
                <input
                  value={currentHole ? inputs[p.golfer_id]?.[currentHole] ?? "" : ""}
                  onChange={(e) => currentHole && saveScore(p.golfer_id, currentHole, e.target.value)}
                  inputMode="numeric"
                  placeholder="Gross"
                  className="w-16 rounded-lg border px-2 py-1.5 text-sm text-center tabular outline-none"
                  style={{ borderColor: "var(--color-border)" }}
                />
              </div>
            );
          })}
        </div>

        {saveError && (
          <p className="mt-3 text-xs rounded-lg px-3 py-2" style={{ background: "var(--color-flag-soft)", color: "var(--color-flag)" }}>
            {saveError}
          </p>
        )}
      </div>

      <div>
        {canFinish ? (
          <button
            onClick={handleFinish}
            disabled={busy}
            className="w-full rounded-lg py-2.5 text-sm font-semibold text-white disabled:opacity-60"
            style={{ background: "var(--color-fairway)" }}
          >
            Finish round
          </button>
        ) : (
          <p className="text-center text-xs" style={{ color: "var(--color-text-muted)" }}>
            {!allScored
              ? <>Enter every golfer&apos;s score on every hole to finish the round
                  ({holeNumbers.filter((h) => players.every((p) => scores[p.golfer_id]?.[h] !== undefined)).length}/{holeNumbers.length} holes complete for all {requiredCount} golfers)</>
              : <>Decide the Wolf&apos;s move on every hole to finish the round
                  ({holeNumbers.filter((h) => wolfDecisions[h] !== undefined).length}/{holeNumbers.length} holes decided)</>}
          </p>
        )}
      </div>
    </div>
  );
}