// Wolf format: four golfers, tee order rotates who's the Wolf each hole.
// The Wolf picks a Team partner, goes Lone Wolf, or declares Blind Wolf
// before anyone has hit.

/**
 * Who is the Wolf on a given hole, given the fixed tee order set at the
 * start of the round. Rotates one player per hole, wrapping around.
 * holeIndex is 0-based (0 = first hole played in this round, not the
 * course's hole number, so front-9/back-9 rounds rotate correctly too).
 */
export function wolfForHole(playerIdsInTeeOrder: string[], holeIndex: number): string {
  return playerIdsInTeeOrder[holeIndex % playerIdsInTeeOrder.length];
}

export type WolfDecisionType = "team" | "lone" | "blind";

export type WolfDecision = {
  type: WolfDecisionType;
  /** Only set when type === "team". */
  partnerId: string | null;
};

/**
 * Points for a single Wolf hole.
 * - team: winning 2v2 side gets 1 point each. Exact tie -> nobody scores.
 * - lone: Wolf beats all 3 others -> Wolf gets 2. Anything else (including
 *   an exact tie with the best opponent) -> the other 3 each get 1.
 * - blind: same as lone, but Wolf gets 3 for winning (declared before any
 *   tee shots, so it carries more risk).
 * Returns an all-zero map if any required net score isn't in yet.
 */
export function wolfHolePoints(
  wolfId: string,
  decision: WolfDecision,
  allPlayerIds: string[],
  netByGolferThisHole: Record<string, number | undefined>
): Record<string, number> {
  const points: Record<string, number> = {};
  for (const id of allPlayerIds) points[id] = 0;

  const wolfNet = netByGolferThisHole[wolfId];
  if (wolfNet === undefined) return points;

  if (decision.type === "team" && decision.partnerId) {
    const partnerId = decision.partnerId;
    const partnerNet = netByGolferThisHole[partnerId];
    const others = allPlayerIds.filter((id) => id !== wolfId && id !== partnerId);
    const otherNets = others.map((id) => netByGolferThisHole[id]);
    if (partnerNet === undefined || otherNets.some((n) => n === undefined)) return points;

    const teamBest = Math.min(wolfNet, partnerNet);
    const oppBest = Math.min(...(otherNets as number[]));

    if (teamBest < oppBest) {
      points[wolfId] = 1;
      points[partnerId] = 1;
    } else if (oppBest < teamBest) {
      for (const id of others) points[id] = 1;
    }
    // exact tie -> nobody scores
  } else {
    const winPoints = decision.type === "blind" ? 3 : 2;
    const others = allPlayerIds.filter((id) => id !== wolfId);
    const otherNets = others.map((id) => netByGolferThisHole[id]);
    if (otherNets.some((n) => n === undefined)) return points;
    const oppBest = Math.min(...(otherNets as number[]));

    if (wolfNet < oppBest) {
      points[wolfId] = winPoints;
    } else {
      // wolf did not strictly beat the best opponent (loss or tie)
      for (const id of others) points[id] = 1;
    }
  }
  return points;
}

/**
 * Wolf points across a full round. decisions maps hole_number to the
 * WolfDecision made for that hole, or undefined if the Wolf hasn't decided
 * yet (that hole contributes no points until a decision is recorded).
 */
export function wolfRoundPoints(
  holeNumbers: number[],
  playerIdsInTeeOrder: string[],
  decisions: Record<number, WolfDecision | undefined>,
  netByGolfer: Record<string, Record<number, number>>
) {
  const totals: Record<string, number> = {};
  for (const id of playerIdsInTeeOrder) totals[id] = 0;
  const perHole: Record<number, Record<string, number>> = {};
  const wolfByHole: Record<number, string> = {};

  holeNumbers.forEach((hole, idx) => {
    const wolfId = wolfForHole(playerIdsInTeeOrder, idx);
    wolfByHole[hole] = wolfId;

    const decision = decisions[hole];
    if (decision === undefined) return;

    const netsThisHole: Record<string, number | undefined> = {};
    for (const id of playerIdsInTeeOrder) netsThisHole[id] = netByGolfer[id]?.[hole];

    const holePoints = wolfHolePoints(wolfId, decision, playerIdsInTeeOrder, netsThisHole);
    perHole[hole] = holePoints;
    for (const id of playerIdsInTeeOrder) totals[id] += holePoints[id] ?? 0;
  });

  return { totals, perHole, wolfByHole };
}