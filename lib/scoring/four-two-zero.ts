// 4-2-0 format: three golfers, points distributed per hole by net-score rank.

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