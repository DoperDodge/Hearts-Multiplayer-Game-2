import { Card, Suit, Rank, Trick, MoonScoringVariant, GameSettings, isQueenOfSpades, isJackOfDiamonds, isTenOfClubs, isKingOfSpades, isQueen } from '@shared/game-types';
import { TOTAL_PENALTY_POINTS, TEN_OF_CLUBS_POINTS, BLOOD_HEARTS_MULTIPLIER, QUEEN_FRENZY_POINTS, KRAKEN_KING_POINTS } from '@shared/constants';

export interface HandScoreResult { scores: Record<string, number>; moonShooter: string | null; details: Record<string, { hearts: number; queenOfSpades: boolean; jackOfDiamonds: boolean }>; }

/** Compute total penalty points possible for a hand given variant settings */
export function getTotalPenaltyForSettings(settings: Partial<GameSettings>): number {
  let total = (settings.bloodHearts ? 13 * BLOOD_HEARTS_MULTIPLIER : 13) + 13; // hearts + QoS
  if (settings.jackOfDiamonds) total -= 10;
  if (settings.tenOfClubs) total += TEN_OF_CLUBS_POINTS;
  if (settings.queenFrenzy) total += QUEEN_FRENZY_POINTS * 3; // 3 non-spade queens
  if (settings.krakenKing) total += KRAKEN_KING_POINTS;
  return total;
}

export function scoreHand(tbp: Map<string, Trick[]>, pids: string[], settings: Partial<GameSettings> = {}): HandScoreResult {
  const jod = settings.jackOfDiamonds ?? false;
  const bh = settings.bloodHearts ?? false;
  const toc = settings.tenOfClubs ?? false;
  const qf = settings.queenFrenzy ?? false;
  const kk = settings.krakenKing ?? false;

  const scores: Record<string, number> = {};
  const details: Record<string, { hearts: number; queenOfSpades: boolean; jackOfDiamonds: boolean }> = {};
  for (const pid of pids) {
    const tricks = tbp.get(pid) || []; const all = tricks.flatMap(t => t.cards.map(tc => tc.card));
    let h = 0, qs = false, jd = false;
    let pts = 0;
    for (const c of all) {
      if (c.suit === Suit.HEARTS) { h++; pts += bh ? BLOOD_HEARTS_MULTIPLIER : 1; }
      if (isQueenOfSpades(c)) { qs = true; pts += 13; }
      if (isJackOfDiamonds(c)) { jd = true; if (jod) pts -= 10; }
      if (toc && isTenOfClubs(c)) pts += TEN_OF_CLUBS_POINTS;
      if (qf && isQueen(c) && !isQueenOfSpades(c)) pts += QUEEN_FRENZY_POINTS;
      if (kk && isKingOfSpades(c)) pts += KRAKEN_KING_POINTS;
    }
    scores[pid] = pts; details[pid] = { hearts: h, queenOfSpades: qs, jackOfDiamonds: jd };
  }
  const ms = pids.find(pid => details[pid].hearts === 13 && details[pid].queenOfSpades) || null;
  return { scores, moonShooter: ms, details };
}

export function applyMoonScoring(scores: Record<string, number>, sid: string, variant: MoonScoringVariant, totalScores: Record<string, number>, scoreLimit: number, settings: Partial<GameSettings> = {}): Record<string, number> {
  const totalPenalty = getTotalPenaltyForSettings(settings);
  const a = { ...scores };
  if (variant === MoonScoringVariant.ADD_TO_OTHERS) {
    const wouldEnd = Object.entries(totalScores).some(([id, s]) => id !== sid && (s + totalPenalty) >= scoreLimit);
    const shooterWins = Object.entries(totalScores).every(([id, s]) => id === sid || (s + totalPenalty) >= totalScores[sid]);
    if (wouldEnd && !shooterWins) { a[sid] = -totalPenalty; for (const id of Object.keys(a)) if (id !== sid) a[id] = 0; }
    else { a[sid] = 0; for (const id of Object.keys(a)) if (id !== sid) a[id] = totalPenalty; }
  } else if (variant === MoonScoringVariant.SUBTRACT_FROM_SELF) { a[sid] = -totalPenalty; for (const id of Object.keys(a)) if (id !== sid) a[id] = 0; }
  return a;
}

export function isGameOver(ts: Record<string, number>, sl: number): boolean { return Object.values(ts).some(s => s >= sl); }
export function getWinner(ts: Record<string, number>): string[] { const m = Math.min(...Object.values(ts)); return Object.entries(ts).filter(([, s]) => s === m).map(([id]) => id); }
