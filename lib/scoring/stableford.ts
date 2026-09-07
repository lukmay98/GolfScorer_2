// Stableford format: 1 to 4 golfers, no head-to-head comparison needed —
// each player scores independently against par, both gross and net.

/** Points for a single hole given how many strokes over/under par it was. */
export function stablefordHolePoints(strokesRelativeToPar: number): number {
  return Math.max(0, 2 - strokesRelativeToPar);
}

export type StablefordHoleResult = {
  netPoints: number;
  grossPoints: number;
  /** Gross strokes relative to par for this hole, or null if not yet scored. */
  toPar: number | null;
};

/**
 * Stableford totals across a round: net points, gross points, and a
 * running gross "strokes relative to par" tally, per player. Only holes
 * with a recorded score (and a known par) count toward the totals.
 */
export function stablefordRoundTotals(
  holeNumbers: number[],
  playerIds: string[],
  grossByGolfer: Record<string, Record<number, number>>,
  netByGolfer: Record<string, Record<number, number>>,
  parByHole: Record<number, number>
) {
  const netPoints: Record<string, number> = {};
  const grossPoints: Record<string, number> = {};
  const toPar: Record<string, number> = {};

  for (const id of playerIds) {
    netPoints[id] = 0;
    grossPoints[id] = 0;
    toPar[id] = 0;
  }

  const perHole: Record<number, Record<string, StablefordHoleResult>> = {};

  for (const h of holeNumbers) {
    const par = parByHole[h];
    if (par === undefined) continue;
    perHole[h] = {};

    for (const id of playerIds) {
      const gross = grossByGolfer[id]?.[h];
      const net = netByGolfer[id]?.[h];
      const holeResult: StablefordHoleResult = { netPoints: 0, grossPoints: 0, toPar: null };

      if (gross !== undefined) {
        const diff = gross - par;
        holeResult.grossPoints = stablefordHolePoints(diff);
        holeResult.toPar = diff;
        grossPoints[id] += holeResult.grossPoints;
        toPar[id] += diff;
      }
      if (net !== undefined) {
        holeResult.netPoints = stablefordHolePoints(net - par);
        netPoints[id] += holeResult.netPoints;
      }
      perHole[h][id] = holeResult;
    }
  }

  return { netPoints, grossPoints, toPar, perHole };
}