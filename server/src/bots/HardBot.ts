import { Card, Suit, Rank, BotDifficulty, isQueenOfSpades, isPenaltyCard, SUIT_ORDER } from '@shared/game-types';
import { BotPlayer, BotDecisionContext, BotPassContext } from './BotPlayer';
export class HardBot extends BotPlayer {
  readonly difficulty = BotDifficulty.HARD;
  readonly name: string;
  constructor(name?: string) { super(); this.name = name || 'Ruthless Rick'; }
  choosePassCards(ctx: BotPassContext): Card[] {
    const tp: Card[] = []; const rem = [...ctx.hand];
    const qs = rem.findIndex(c => isQueenOfSpades(c)); if (qs >= 0) tp.push(rem.splice(qs, 1)[0]);
    const sc: Record<string, number> = {}; for (const s of [Suit.CLUBS, Suit.DIAMONDS, Suit.SPADES]) sc[s] = rem.filter(c => c.suit === s).length;
    const vs = Object.entries(sc).filter(([, n]) => n > 0 && n <= 3 - tp.length).sort((a, b) => a[1] - b[1]);
    if (vs.length > 0) { const cards = rem.filter(c => c.suit === vs[0][0]); for (const c of cards) { if (tp.length >= 3) break; tp.push(c); rem.splice(rem.indexOf(c), 1); } }
    for (const r of [Rank.ACE, Rank.KING]) { if (tp.length >= 3) break; const i = rem.findIndex(c => c.suit === Suit.SPADES && c.rank === r); if (i >= 0) tp.push(rem.splice(i, 1)[0]); }
    const hh = rem.filter(c => c.suit === Suit.HEARTS).sort((a, b) => b.rank - a.rank);
    for (const c of hh) { if (tp.length >= 3) break; tp.push(c); rem.splice(rem.indexOf(c), 1); }
    rem.sort((a, b) => b.rank - a.rank); while (tp.length < 3 && rem.length > 0) tp.push(rem.shift()!);
    return tp.slice(0, 3);
  }
  choosePlay(ctx: BotDecisionContext): Card {
    const { legalMoves: lm, currentTrick: ct } = ctx;
    if (lm.length === 1) return lm[0];
    if (ct.length === 0) { const nh = lm.filter(c => c.suit !== Suit.HEARTS); return (nh.length > 0 ? nh : lm).sort((a, b) => a.rank - b.rank)[0]; }
    const ls = ct[0].card.suit; const fs = lm.some(c => c.suit === ls); const isLast = ct.length === 3;
    if (fs) { const ch = Math.max(...ct.filter(tc => tc.card.suit === ls).map(tc => tc.card.rank));
      if (isLast) { const hp = ct.some(tc => tc.card.suit === Suit.HEARTS || isQueenOfSpades(tc.card)); if (!hp) return lm.sort((a, b) => b.rank - a.rank)[0]; }
      const cd = lm.filter(c => c.rank < ch); if (cd.length > 0) return cd.sort((a, b) => b.rank - a.rank)[0]; return lm.sort((a, b) => a.rank - b.rank)[0]; }
    const qs = lm.find(c => isQueenOfSpades(c)); if (qs) return qs;
    const hh = lm.filter(c => c.suit === Suit.HEARTS).sort((a, b) => b.rank - a.rank); if (hh.length > 0) return hh[0];
    const hs = lm.filter(c => c.suit === Suit.SPADES && c.rank >= Rank.KING).sort((a, b) => b.rank - a.rank); if (hs.length > 0) return hs[0];
    return lm.sort((a, b) => b.rank - a.rank)[0];
  }
}
