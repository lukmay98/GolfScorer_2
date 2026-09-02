// Pure, framework-free scoring logic shared by the live scorecard and the
// completed-round view, so both always compute points the same way.

export type CourseHole = {
  hole_number: number;
  par: number;
  handicap_index: number;
};

export type RoundPlayerInfo = {
  golfer_id: string;
  name: string;
  handicap_snapshot: number;
};

/**
 * Strokes a golfer receives on each hole, given the round's handicap
 * allowance and the lowest handicap in the round (scratch golfer gets 0).
 * Strokes are distributed one at a time to the hardest holes first
 * (lowest handicap_index), wrapping around if the allowance exceeds 18.
 */
export function strokesPerHole(
  golferHandicap: number,
  lowestHandicap: number,
  allowancePct: number,
  holes: CourseHole[]
): Record<number, number> {
  const diff = golferHandicap - lowestHandicap;
  const allowed = Math.round((diff * allowancePct) / 100);
  const base = Math.floor(allowed / 18);
  const remainder = allowed % 18;

  const result: Record<number, number> = {};
  for (const hole of holes) {
    result[hole.hole_number] = base + (hole.handicap_index <= remainder ? 1 : 0);
  }
  return result;
}

/** Strokes for every golfer in the round, keyed by golfer_id then hole_number. */
export function strokesForRound(
  players: RoundPlayerInfo[],
  allowancePct: number,
  holes: CourseHole[]
): Record<string, Record<number, number>> {
  const lowest = Math.min(...players.map((p) => p.handicap_snapshot));
  const result: Record<string, Record<number, number>> = {};
  for (const p of players) {
    result[p.golfer_id] = strokesPerHole(p.handicap_snapshot, lowest, allowancePct, holes);
  }
  return result;
}

/**
 * 4-2-0 points for a single hole given each golfer's net score.
 * Ties share the pooled points for the ranks they occupy equally
 * (e.g. two golfers tied for best net split 4+2 → 3 each).
 */
export function fourTwoZeroHolePoints(
  nets: { golfer_id: string; net: number }[]
): Record<string, number> {
  const pool = [4, 2, 0];
  const sorted = [...nets].sort((a, b) => a.net - b.net);
  const points: Record<string, number> = {};

  let i = 0;
  while (i < sorted.length) {
    let j = i;
    while (j < sorted.length && sorted[j].net === sorted[i].net) j++;
    const group = sorted.slice(i, j);
    const share = pool.slice(i, j).reduce((a, b) => a + b, 0) / group.length;
    for (const g of group) points[g.golfer_id] = share;
    i = j;
  }
  return points;
}

/**
 * Matchplay points across a full round, applying the optional points cap.
 * Recomputed from scratch each time from ordered hole results, so it works
 * regardless of the order scores were entered in.
 */
export function matchplayRoundPoints(
  holeNumbers: number[],
  netByGolfer: Record<string, Record<number, number>>,
  golferIds: [string, string],
  cap: number | null
) {
  const [a, b] = golferIds;
  let totalA = 0;
  let totalB = 0;
  const perHole: Record<number, { pointsA: number; pointsB: number; capped: "A" | "B" | null }> = {};

  for (const hole of holeNumbers) {
    const netA = netByGolfer[a]?.[hole];
    const netB = netByGolfer[b]?.[hole];
    if (netA === undefined || netB === undefined) continue;

    let pointsA = netA < netB ? 1 : 0;
    let pointsB = netB < netA ? 1 : 0;
    let capped: "A" | "B" | null = null;

    if (cap) {
      const diff = totalA - totalB;
      if (diff >= cap && pointsA === 1) {
        pointsA = 0;
        capped = "A";
      } else if (-diff >= cap && pointsB === 1) {
        pointsB = 0;
        capped = "B";
      }
    }

    totalA += pointsA;
    totalB += pointsB;
    perHole[hole] = { pointsA, pointsB, capped };
  }

  return { perHole, totals: { [a]: totalA, [b]: totalB } as Record<string, number> };
}

export function holeRangeNumbers(holeStart: number, holeEnd: number): number[] {
  const holes: number[] = [];
  for (let h = holeStart; h <= holeEnd; h++) holes.push(h);
  return holes;
}
