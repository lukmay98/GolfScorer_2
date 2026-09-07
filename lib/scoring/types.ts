// Shared types and handicap math used by every game format's scoring logic.

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
 * Strokes for every golfer using their FULL handicap (against scratch, not
 * against the lowest handicap in the round). Head-to-head formats (4-2-0,
 * Matchplay, Wolf) only ever compare players against each other, so using
 * the lowest-in-round as the baseline gives the same relative result and
 * is what strokesForRound does. Formats that score each player against a
 * fixed target instead — like Stableford, scored against par — need this
 * version, or a single-player round would always show 0 strokes.
 */
export function strokesForRoundAbsolute(
  players: RoundPlayerInfo[],
  allowancePct: number,
  holes: CourseHole[]
): Record<string, Record<number, number>> {
  const result: Record<string, Record<number, number>> = {};
  for (const p of players) {
    result[p.golfer_id] = strokesPerHole(p.handicap_snapshot, 0, allowancePct, holes);
  }
  return result;
}

export function holeRangeNumbers(holeStart: number, holeEnd: number): number[] {
  const holes: number[] = [];
  for (let h = holeStart; h <= holeEnd; h++) holes.push(h);
  return holes;
}