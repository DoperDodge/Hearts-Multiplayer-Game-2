import { Card, Suit, Rank, Trick, MoonScoringVariant, isQueenOfSpades, isJackOfDiamonds } from '@shared/game-types';
import { TOTAL_PENALTY_POINTS } from '@shared/constants';

export interface HandScoreResult { scores: Record<string, number>; moonShooter: string | null; details: Record<string, { hearts: number; queenOfSpades: boolean; jackOfDiamonds: boolean }>; }

export function scoreHand(tbp: Map<string, Trick[]>, pids: string[], jod: boolean = false): HandScoreResult {
  const scores: Record<string, number> = {};
  const details: Record<string, { hearts: number; queenOfSpades: boolean; jackOfDiamonds: boolean }> = {};
  for (const pid of pids) {
    const tricks = tbp.get(pid) || []; const all = tricks.flatMap(t => t.cards.map(tc => tc.card));
    let h = 0, qs = false, jd = false;
    for (const c of all) { if (c.suit === Suit.HEARTS) h++; if (isQueenOfSpades(c)) qs = true; if (isJackOfDiamonds(c)) jd = true; }
    let pts = h + (qs ? 13 : 0); if (jod && jd) pts -= 10;
    scores[pid] = pts; details[pid] = { hearts: h, queenOfSpades: qs, jackOfDiamonds: jd };
  }
  const ms = pids.find(pid => details[pid].hearts === 13 && details[pid].queenOfSpades) || null;
  return { scores, moonShooter: ms, details };
}

export function applyMoonScoring(scores: Record<string, number>, sid: string, variant: MoonScoringVariant, totalScores: Record<string, number>, scoreLimit: number): Record<string, number> {
  const a = { ...scores };
  if (variant === MoonScoringVariant.ADD_TO_OTHERS) {
    const wouldEnd = Object.entries(totalScores).some(([id, s]) => id !== sid && (s + TOTAL_PENALTY_POINTS) >= scoreLimit);
    const shooterWins = Object.entries(totalScores).every(([id, s]) => id === sid || (s + TOTAL_PENALTY_POINTS) >= totalScores[sid]);
    if (wouldEnd && !shooterWins) { a[sid] = -TOTAL_PENALTY_POINTS; for (const id of Object.keys(a)) if (id !== sid) a[id] = 0; }
    else { a[sid] = 0; for (const id of Object.keys(a)) if (id !== sid) a[id] = TOTAL_PENALTY_POINTS; }
  } else if (variant === MoonScoringVariant.SUBTRACT_FROM_SELF) { a[sid] = -TOTAL_PENALTY_POINTS; for (const id of Object.keys(a)) if (id !== sid) a[id] = 0; }
  return a;
}

export function isGameOver(ts: Record<string, number>, sl: number): boolean { return Object.values(ts).some(s => s >= sl); }
export function getWinner(ts: Record<string, number>): string[] { const m = Math.min(...Object.values(ts)); return Object.entries(ts).filter(([, s]) => s === m).map(([id]) => id); }
