// Matchplay format: two golfers, head-to-head per hole, optional points cap.

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