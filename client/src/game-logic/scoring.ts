import { Card, Suit, Trick, MoonScoringVariant, isQueenOfSpades } from '@shared/game-types';
import { TOTAL_PENALTY_POINTS } from '@shared/constants';

export interface HandScoreResult { scores: Record<string, number>; moonShooter: string | null; }

export function scoreHand(tbp: Map<string, Trick[]>, pids: string[], jod: boolean = false): HandScoreResult {
  const scores: Record<string, number> = {};
  let ms: string | null = null;
  for (const pid of pids) {
    const tricks = tbp.get(pid) || [];
    const all = tricks.flatMap(t => t.cards.map(tc => tc.card));
    let h = 0, qs = false, jd = false;
    for (const c of all) { if (c.suit === Suit.HEARTS) h++; if (isQueenOfSpades(c)) qs = true; if (c.suit === Suit.DIAMONDS && c.rank === 11) jd = true; }
    let pts = h + (qs ? 13 : 0);
    if (jod && jd) pts -= 10;
    scores[pid] = pts;
    if (h === 13 && qs) ms = pid;
  }
  return { scores, moonShooter: ms };
}

export function applyMoonScoring(scores: Record<string, number>, sid: string, v: MoonScoringVariant): Record<string, number> {
  const a = { ...scores };
  if (v === MoonScoringVariant.ADD_TO_OTHERS) { a[sid] = 0; for (const id of Object.keys(a)) if (id !== sid) a[id] = TOTAL_PENALTY_POINTS; }
  else if (v === MoonScoringVariant.SUBTRACT_FROM_SELF) { a[sid] = -TOTAL_PENALTY_POINTS; for (const id of Object.keys(a)) if (id !== sid) a[id] = 0; }
  return a;
}

export function isGameOver(ts: Record<string, number>, sl: number): boolean { return Object.values(ts).some(s => s >= sl); }
export function getWinner(ts: Record<string, number>): string[] { const m = Math.min(...Object.values(ts)); return Object.entries(ts).filter(([, s]) => s === m).map(([id]) => id); }
