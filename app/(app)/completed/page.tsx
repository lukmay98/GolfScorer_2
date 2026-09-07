"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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

type CompletedRound = {
  id: string;
  format: "4-2-0" | "matchplay" | "wolf" | "stableford";
  hole_start: number;
  hole_end: number;
  handicap_allowance: number;
  matchplay_cap: number | null;
  course_id: string;
  course_name: string;
  completed_at: string;
  players: RoundPlayerInfo[];
};

type Golfer = { id: string; name: string };
type Course = { id: string; name: string };

function formatToPar(n: number): string {
  return n > 0 ? `+${n}` : `${n}`;
}

export default function CompletedPage() {
  const supabase = useMemo(() => createClient(), []);
  const [rounds, setRounds] = useState<CompletedRound[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // filters
  const [courseQuery, setCourseQuery] = useState("");
  const [courseResults, setCourseResults] = useState<Course[]>([]);
  const [courseFilter, setCourseFilter] = useState<Course | null>(null);

  const [golferQuery, setGolferQuery] = useState("");
  const [golferResults, setGolferResults] = useState<Golfer[]>([]);
  const [golferFilters, setGolferFilters] = useState<Golfer[]>([]);

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  async function load() {
    setLoading(true);

    const meRes = await fetch("/api/me");
    const me = meRes.ok ? await meRes.json() : { isAdmin: false, userId: null };

    let query = supabase
      .from("rounds")
      .select(
        "id, format, hole_start, hole_end, handicap_allowance, matchplay_cap, course_id, completed_at, courses(name)"
      )
      .eq("status", "completed")
      .order("completed_at", { ascending: false });
    if (!me.isAdmin) {
      query = query.eq("created_by", me.userId);
    }
    const { data: raw } = await query;

    if (!raw) {
      setRounds([]);
      setLoading(false);
      return;
    }

    const enriched = await Promise.all(
      raw.map(async (r) => {
        const { data: rp } = await supabase
          .from("round_players")
          .select("golfer_id, handicap_snapshot, player_order, golfers(name)")
          .eq("round_id", r.id)
          .order("player_order");
        const players: RoundPlayerInfo[] = (rp ?? []).map((row) => {
          const g = row.golfers as unknown as { name: string } | { name: string }[];
          const name = Array.isArray(g) ? g[0]?.name : g?.name;
          return { golfer_id: row.golfer_id, name: name ?? "Unknown", handicap_snapshot: row.handicap_snapshot };
        });
        const course = r.courses as unknown as { name: string } | { name: string }[];
        const courseName = Array.isArray(course) ? course[0]?.name : course?.name;
        return {
          id: r.id,
          format: r.format,
          hole_start: r.hole_start,
          hole_end: r.hole_end,
          handicap_allowance: r.handicap_allowance,
          matchplay_cap: r.matchplay_cap,
          course_id: r.course_id,
          course_name: courseName ?? "Unknown course",
          completed_at: r.completed_at,
          players,
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

  async function searchCourses(q: string) {
    setCourseQuery(q);
    if (!q.trim()) {
      setCourseResults([]);
      return;
    }
    const { data } = await supabase.from("courses").select("id, name").ilike("name", `%${q.trim()}%`).limit(8);
    setCourseResults(data ?? []);
  }

  async function searchGolfers(q: string) {
    setGolferQuery(q);
    if (!q.trim()) {
      setGolferResults([]);
      return;
    }
    const { data } = await supabase.from("golfers").select("id, name").ilike("name", `%${q.trim()}%`).limit(8);
    setGolferResults(data ?? []);
  }

  function clearAllFilters() {
    setCourseFilter(null);
    setGolferFilters([]);
    setStartDate("");
    setEndDate("");
  }

  const hasFilters = courseFilter || golferFilters.length > 0 || startDate || endDate;

  const filtered = rounds.filter((r) => {
    if (courseFilter && r.course_id !== courseFilter.id) return false;
    if (golferFilters.length > 0) {
      const roundGolferIds = new Set(r.players.map((p) => p.golfer_id));
      if (!golferFilters.every((g) => roundGolferIds.has(g.id))) return false;
    }
    if (startDate && r.completed_at < startDate) return false;
    if (endDate && r.completed_at > endDate + "T23:59:59") return false;
    return true;
  });

  return (
    <div className="mx-auto max-w-lg px-4 py-5 space-y-5">
      <div>
        <h1 className="font-display text-xl font-bold" style={{ color: "var(--color-fairway)" }}>
          Completed
        </h1>
        <p className="text-sm mt-0.5" style={{ color: "var(--color-text-muted)" }}>
          {filtered.length} of {rounds.length} round{rounds.length === 1 ? "" : "s"}
        </p>
      </div>

      {/* Filters */}
      <div
        className="rounded-xl border p-4 space-y-3"
        style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Filters</h2>
          {hasFilters && (
            <button onClick={clearAllFilters} className="text-xs font-medium" style={{ color: "var(--color-flag)" }}>
              Clear all
            </button>
          )}
        </div>

        {/* Course filter */}
        <div>
          {courseFilter ? (
            <div className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm" style={{ borderColor: "var(--color-border)" }}>
              <span>{courseFilter.name}</span>
              <button onClick={() => setCourseFilter(null)} className="text-xs font-medium" style={{ color: "var(--color-flag)" }}>
                Remove
              </button>
            </div>
          ) : (
            <>
              <input
                value={courseQuery}
                onChange={(e) => searchCourses(e.target.value)}
                placeholder="Filter by course…"
                className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
                style={{ borderColor: "var(--color-border)" }}
              />
              {courseResults.length > 0 && (
                <ul className="mt-1.5 rounded-lg border divide-y overflow-hidden" style={{ borderColor: "var(--color-border)" }}>
                  {courseResults.map((c) => (
                    <li key={c.id}>
                      <button
                        onClick={() => {
                          setCourseFilter(c);
                          setCourseQuery("");
                          setCourseResults([]);
                        }}
                        className="w-full text-left px-3 py-2 text-sm"
                      >
                        {c.name}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>

        {/* Golfer filter */}
        <div>
          {golferFilters.length > 0 && (
            <ul className="flex flex-wrap gap-1.5 mb-1.5">
              {golferFilters.map((g) => (
                <li key={g.id}>
                  <button
                    onClick={() => setGolferFilters((prev) => prev.filter((x) => x.id !== g.id))}
                    className="rounded-full px-2.5 py-1 text-xs font-medium"
                    style={{ background: "var(--color-fairway-soft)", color: "var(--color-fairway)" }}
                  >
                    {g.name} ×
                  </button>
                </li>
              ))}
            </ul>
          )}
          <input
            value={golferQuery}
            onChange={(e) => searchGolfers(e.target.value)}
            placeholder="Filter by golfer…"
            className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
            style={{ borderColor: "var(--color-border)" }}
          />
          {golferResults.length > 0 && (
            <ul className="mt-1.5 rounded-lg border divide-y overflow-hidden" style={{ borderColor: "var(--color-border)" }}>
              {golferResults
                .filter((g) => !golferFilters.some((f) => f.id === g.id))
                .map((g) => (
                  <li key={g.id}>
                    <button
                      onClick={() => {
                        setGolferFilters((prev) => [...prev, g]);
                        setGolferQuery("");
                        setGolferResults([]);
                      }}
                      className="w-full text-left px-3 py-2 text-sm"
                    >
                      {g.name}
                    </button>
                  </li>
                ))}
            </ul>
          )}
        </div>

        {/* Date range */}
        <div className="space-y-2">
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: "var(--color-text-muted)" }}>
              From
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="block w-full min-w-0 rounded-lg border px-2.5 py-1.5 text-sm outline-none"
              style={{ borderColor: "var(--color-border)", maxWidth: "100%" }}
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: "var(--color-text-muted)" }}>
              To
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="block w-full min-w-0 rounded-lg border px-2.5 py-1.5 text-sm outline-none"
              style={{ borderColor: "var(--color-border)", maxWidth: "100%" }}
            />
          </div>
        </div>
      </div>

      {/* Round list */}
      {loading ? (
        <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>Loading rounds…</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
          {rounds.length === 0 ? "No completed rounds yet." : "No rounds match your filters."}
        </p>
      ) : (
        <ul className="space-y-2">
          {filtered.map((r) => (
            <CompletedRoundCard
              key={r.id}
              round={r}
              expanded={expanded === r.id}
              onToggle={() => setExpanded(expanded === r.id ? null : r.id)}
              deleteConfirming={deleteConfirm === r.id}
              onRequestDelete={() => setDeleteConfirm(r.id)}
              onCancelDelete={() => setDeleteConfirm(null)}
              onDeleted={() => {
                setDeleteConfirm(null);
                load();
              }}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function CompletedRoundCard({
  round,
  expanded,
  onToggle,
  deleteConfirming,
  onRequestDelete,
  onCancelDelete,
  onDeleted,
}: {
  round: CompletedRound;
  expanded: boolean;
  onToggle: () => void;
  deleteConfirming: boolean;
  onRequestDelete: () => void;
  onCancelDelete: () => void;
  onDeleted: () => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [holes, setHoles] = useState<CourseHole[] | null>(null);
  const [scores, setScores] = useState<Record<string, Record<number, number>>>({});
  const [wolfDecisions, setWolfDecisions] = useState<Record<number, WolfDecision | undefined>>({});
  const [detailLoading, setDetailLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);

  const holeNumbers = holeRangeNumbers(round.hole_start, round.hole_end);

  useEffect(() => {
    if (expanded && holes === null) loadDetail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded]);

  async function loadDetail() {
    setDetailLoading(true);
    const { data: courseHoles } = await supabase
      .from("course_holes")
      .select("hole_number, par, handicap_index")
      .eq("course_id", round.course_id)
      .gte("hole_number", round.hole_start)
      .lte("hole_number", round.hole_end)
      .order("hole_number");
    setHoles(courseHoles ?? []);

    const { data: scoreRows } = await supabase
      .from("scores")
      .select("golfer_id, hole_number, gross_score")
      .eq("round_id", round.id);
    const map: Record<string, Record<number, number>> = {};
    for (const p of round.players) map[p.golfer_id] = {};
    for (const s of scoreRows ?? []) {
      map[s.golfer_id] = { ...map[s.golfer_id], [s.hole_number]: s.gross_score };
    }
    setScores(map);

    if (round.format === "wolf") {
      const { data: decisionRows } = await supabase
        .from("wolf_decisions")
        .select("hole_number, partner_golfer_id, decision_type")
        .eq("round_id", round.id);
      const decisionMap: Record<number, WolfDecision | undefined> = {};
      for (const d of decisionRows ?? []) {
        decisionMap[d.hole_number] = {
          type: d.decision_type as WolfDecision["type"],
          partnerId: d.partner_golfer_id,
        };
      }
      setWolfDecisions(decisionMap);
    }

    setDetailLoading(false);
  }

  const strokes = holes ? strokesForRound(round.players, round.handicap_allowance, holes) : {};
  const absoluteStrokes = holes ? strokesForRoundAbsolute(round.players, round.handicap_allowance, holes) : {};

  const netByGolfer = useMemo(() => {
    const result: Record<string, Record<number, number>> = {};
    for (const p of round.players) {
      result[p.golfer_id] = {};
      for (const h of holeNumbers) {
        const gross = scores[p.golfer_id]?.[h];
        if (gross === undefined) continue;
        result[p.golfer_id][h] = gross - (strokes[p.golfer_id]?.[h] ?? 0);
      }
    }
    return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scores, holes]);

  // Stableford scores each player against par, not against each other, so
  // it needs each player's FULL handicap strokes rather than the
  // relative-to-lowest-in-round strokes the other formats use.
  const netByGolferAbsolute = useMemo(() => {
    const result: Record<string, Record<number, number>> = {};
    for (const p of round.players) {
      result[p.golfer_id] = {};
      for (const h of holeNumbers) {
        const gross = scores[p.golfer_id]?.[h];
        if (gross === undefined) continue;
        result[p.golfer_id][h] = gross - (absoluteStrokes[p.golfer_id]?.[h] ?? 0);
      }
    }
    return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scores, holes]);

  const pointsResult = useMemo(() => {
    if (!holes) return { totals: {} as Record<string, number>, perHole: {} as Record<number, Record<string, number>> };
    if (round.format === "4-2-0") {
      const totals: Record<string, number> = {};
      const perHole: Record<number, Record<string, number>> = {};
      for (const p of round.players) totals[p.golfer_id] = 0;
      for (const h of holeNumbers) {
        const nets = round.players
          .map((p) => ({ golfer_id: p.golfer_id, net: netByGolfer[p.golfer_id]?.[h] }))
          .filter((n): n is { golfer_id: string; net: number } => n.net !== undefined);
        if (nets.length !== round.players.length) continue;
        const hp = fourTwoZeroHolePoints(nets);
        perHole[h] = hp;
        for (const gid of Object.keys(hp)) totals[gid] += hp[gid];
      }
      return { totals, perHole };
    } else if (round.format === "matchplay") {
      const [a, b] = round.players.map((p) => p.golfer_id) as [string, string];
      const { totals, perHole } = matchplayRoundPoints(holeNumbers, netByGolfer, [a, b], round.matchplay_cap);
      const perHoleGeneric: Record<number, Record<string, number>> = {};
      for (const [h, v] of Object.entries(perHole)) {
        perHoleGeneric[Number(h)] = { [a]: v.pointsA, [b]: v.pointsB };
      }
      return { totals, perHole: perHoleGeneric };
    } else if (round.format === "wolf") {
      const playerIdsInTeeOrder = round.players.map((p) => p.golfer_id);
      const { totals, perHole } = wolfRoundPoints(holeNumbers, playerIdsInTeeOrder, wolfDecisions, netByGolfer);
      return { totals, perHole };
    } else {
      return { totals: {} as Record<string, number>, perHole: {} as Record<number, Record<string, number>> };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [netByGolfer, holes, wolfDecisions]);

  const stablefordResult = useMemo(() => {
    if (!holes || round.format !== "stableford") return null;
    const parByHole: Record<number, number> = {};
    for (const h of holes) parByHole[h.hole_number] = h.par;
    const playerIds = round.players.map((p) => p.golfer_id);
    return stablefordRoundTotals(holeNumbers, playerIds, scores, netByGolferAbsolute, parByHole);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scores, netByGolferAbsolute, holes]);

  const sortedTotals = [...round.players].sort((a, b) => {
    if (round.format === "stableford" && stablefordResult) {
      return (stablefordResult.netPoints[b.golfer_id] ?? 0) - (stablefordResult.netPoints[a.golfer_id] ?? 0);
    }
    return (pointsResult.totals[b.golfer_id] ?? 0) - (pointsResult.totals[a.golfer_id] ?? 0);
  });
  function scoreFor(golferId: string): number {
    return round.format === "stableford" && stablefordResult
      ? stablefordResult.netPoints[golferId] ?? 0
      : pointsResult.totals[golferId] ?? 0;
  }
  const topScore = scoreFor(sortedTotals[0]?.golfer_id);
  const winners = sortedTotals.filter((p) => scoreFor(p.golfer_id) === topScore);
  const resultLabel = winners.length > 1 ? "Tie" : `${winners[0]?.name} wins`;

  async function handleExportImage() {
    if (!exportRef.current) return;
    setExporting(true);
    try {
      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(exportRef.current, {
        backgroundColor: "#ffffff",
        scale: 2,
      });
      const dataUrl = canvas.toDataURL("image/png");
      const dateStr = new Date(round.completed_at).toISOString().split("T")[0];
      const safeName = round.course_name.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
      const link = document.createElement("a");
      link.download = `${safeName}-${dateStr}.png`;
      link.href = dataUrl;
      link.click();
    } finally {
      setExporting(false);
    }
  }

  async function handleDelete() {
    await supabase.from("rounds").delete().eq("id", round.id);
    onDeleted();
  }

  return (
    <li
      className="rounded-xl border p-3.5"
      style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}
    >
      <button onClick={onToggle} className="w-full text-left">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium">
              {round.course_name} <span style={{ color: "var(--color-text-muted)" }}>· {round.format === "4-2-0" ? "4-2-0" : round.format === "matchplay" ? "Matchplay" : round.format === "wolf" ? "Wolf" : "Stableford"}</span>
            </p>
            <p className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>
              {new Date(round.completed_at).toLocaleDateString()} ·{" "}
              {round.hole_start === 1 && round.hole_end === 18
                ? "Full 18"
                : round.hole_start === 1
                ? "Front 9"
                : "Back 9"}{" "}
              · Hcp {round.handicap_allowance}%{round.matchplay_cap ? ` · Cap ${round.matchplay_cap}` : ""}
            </p>
          </div>
          <span className="text-xs font-semibold" style={{ color: "var(--color-fairway)" }}>
            {resultLabel}
          </span>
        </div>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
          {sortedTotals.map((p) =>
            round.format === "stableford" && stablefordResult ? (
              <span key={p.golfer_id} className="text-xs tabular">
                {p.name} (
                {formatToPar(stablefordResult.toPar[p.golfer_id] ?? 0)}/
                {stablefordResult.netPoints[p.golfer_id] ?? 0}/
                {stablefordResult.grossPoints[p.golfer_id] ?? 0})
              </span>
            ) : (
              <span key={p.golfer_id} className="text-xs tabular">
                {p.name}: <span className="font-semibold">{pointsResult.totals[p.golfer_id] ?? 0}</span>
              </span>
            )
          )}
        </div>
      </button>

      {expanded && (
        <div className="mt-3 pt-3 border-t" style={{ borderColor: "var(--color-border)" }}>
          {detailLoading || !holes ? (
            <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>Loading scorecard…</p>
          ) : (
            <div ref={exportRef} style={{ background: "white", padding: 12 }} className="overflow-x-auto">
              <div className="mb-2">
                <p className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
                  {round.course_name} ·{" "}
                  {round.format === "4-2-0" ? "4-2-0" : round.format === "matchplay" ? "Matchplay" : round.format === "wolf" ? "Wolf" : "Stableford"}
                </p>
                <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                  {new Date(round.completed_at).toLocaleDateString()} ·{" "}
                  {round.hole_start === 1 && round.hole_end === 18
                    ? "Full 18"
                    : round.hole_start === 1
                    ? "Front 9"
                    : "Back 9"}{" "}
                  · Hcp {round.handicap_allowance}%{round.matchplay_cap ? ` · Cap ${round.matchplay_cap}` : ""}
                  {" · "}
                  <span style={{ color: "var(--color-fairway)", fontWeight: 600 }}>{resultLabel}</span>
                </p>
              </div>

              <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1">
                {sortedTotals.map((p) =>
                  round.format === "stableford" && stablefordResult ? (
                    <span key={p.golfer_id} className="text-xs tabular">
                      {p.name} (
                      {formatToPar(stablefordResult.toPar[p.golfer_id] ?? 0)}/
                      {stablefordResult.netPoints[p.golfer_id] ?? 0}/
                      {stablefordResult.grossPoints[p.golfer_id] ?? 0})
                    </span>
                  ) : (
                    <span key={p.golfer_id} className="text-xs tabular">
                      {p.name}: <span className="font-semibold">{pointsResult.totals[p.golfer_id] ?? 0}</span>
                    </span>
                  )
                )}
              </div>

              {round.format === "stableford" && (
                <p className="text-xs mb-2" style={{ color: "var(--color-text-muted)" }}>
                  Each cell shows gross score, then (strokes to par / net points / gross points).
                </p>
              )}
              <table className="w-full text-xs tabular">
                <thead>
                  <tr style={{ color: "var(--color-text-muted)" }}>
                    <th className="text-left font-semibold pb-1">Hole</th>
                    <th className="text-left font-semibold pb-1">Par</th>
                    {round.format === "wolf" && (
                      <th className="text-left font-semibold pb-1 pl-2">Wolf</th>
                    )}
                    {round.players.map((p) => (
                      <th key={p.golfer_id} className="text-left font-semibold pb-1 pl-2">
                        {p.name.split(" ")[0]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {holes.map((h, idx) => {
                    const wolfId = round.format === "wolf" ? wolfForHole(round.players.map((p) => p.golfer_id), idx) : null;
                    const wolfName = wolfId ? round.players.find((p) => p.golfer_id === wolfId)?.name : null;
                    const decision = wolfDecisions[h.hole_number];
                    const partnerName =
                      decision?.type === "team"
                        ? round.players.find((p) => p.golfer_id === decision.partnerId)?.name
                        : null;
                    return (
                      <tr key={h.hole_number} className="border-t" style={{ borderColor: "var(--color-border)" }}>
                        <td className="py-1">{h.hole_number}</td>
                        <td className="py-1">{h.par}</td>
                        {round.format === "wolf" && (
                          <td className="py-1 pl-2" style={{ color: "var(--color-text-muted)" }}>
                            {wolfName?.split(" ")[0]}
                            {decision === undefined
                              ? " (undecided)"
                              : decision.type === "team"
                              ? ` +${partnerName?.split(" ")[0]}`
                              : decision.type === "blind"
                              ? " — blind"
                              : " — lone"}
                          </td>
                        )}
                        {round.players.map((p) => {
                          const gross = scores[p.golfer_id]?.[h.hole_number];
                          const stablefordPts =
                            round.format === "stableford"
                              ? stablefordResult?.perHole[h.hole_number]?.[p.golfer_id]
                              : undefined;
                          const simplePts =
                            round.format !== "stableford" ? pointsResult.perHole[h.hole_number]?.[p.golfer_id] : undefined;
                          return (
                            <td key={p.golfer_id} className="py-1 pl-2">
                              {gross ?? "–"}
                              {stablefordPts !== undefined ? (
                                <span style={{ color: "var(--color-text-muted)" }}>
                                  {" "}
                                  ({stablefordPts.toPar !== null ? formatToPar(stablefordPts.toPar) : "–"}/
                                  {stablefordPts.netPoints}/{stablefordPts.grossPoints})
                                </span>
                              ) : simplePts !== undefined ? (
                                <span style={{ color: "var(--color-text-muted)" }}> ({simplePts})</span>
                              ) : null}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
                {round.format === "stableford" && stablefordResult && (
                  <tfoot>
                    <tr className="border-t-2 font-semibold" style={{ borderColor: "var(--color-border)" }}>
                      <td className="py-1.5" colSpan={2}>
                        Total
                      </td>
                      {round.players.map((p) => (
                        <td key={p.golfer_id} className="py-1.5 pl-2">
                          {formatToPar(stablefordResult.toPar[p.golfer_id] ?? 0)}/
                          {stablefordResult.netPoints[p.golfer_id] ?? 0}/
                          {stablefordResult.grossPoints[p.golfer_id] ?? 0}
                        </td>
                      ))}
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}

          <div className="mt-3 flex items-center justify-between">
            <button
              onClick={handleExportImage}
              disabled={exporting || detailLoading || !holes}
              className="text-xs font-medium disabled:opacity-50"
              style={{ color: "var(--color-fairway)" }}
            >
              {exporting ? "Exporting…" : "Export as image"}
            </button>
            {deleteConfirming ? (
              <div className="flex items-center gap-2">
                <button onClick={handleDelete} className="text-xs font-medium" style={{ color: "var(--color-flag)" }}>
                  Confirm delete
                </button>
                <button onClick={onCancelDelete} className="text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>
                  Cancel
                </button>
              </div>
            ) : (
              <button onClick={onRequestDelete} className="text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>
                Delete round
              </button>
            )}
          </div>
        </div>
      )}
    </li>
  );
}