// Summe der Brutto-Schläge und ± Par pro Spieler (für alle Spielformate)
export function grossStrokeTotals(
  holeNumbers: number[],
  playerIds: string[],
  grossByGolfer: Record<string, Record<number, number>>,
  parByHole: Record<number, number>
) {
  const strokes: Record<string, number> = {};
  const toPar: Record<string, number> = {};
  const holesPlayed: Record<string, number> = {};
  for (const id of playerIds) {
    strokes[id] = 0;
    toPar[id] = 0;
    holesPlayed[id] = 0;
  }
  for (const h of holeNumbers) {
    const par = parByHole[h];
    if (par === undefined) continue;
    for (const id of playerIds) {
      const gross = grossByGolfer[id]?.[h];
      if (gross === undefined) continue; // nicht gespielte Löcher überspringen
      strokes[id] += gross;
      toPar[id] += gross - par;
      holesPlayed[id] += 1;
    }
  }
  return { strokes, toPar, holesPlayed };
}