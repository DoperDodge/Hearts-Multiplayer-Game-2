import { Card, Suit, Rank, BotDifficulty, isQueenOfSpades, isPenaltyCard } from '@shared/game-types';
import { BotPlayer, BotDecisionContext, BotPassContext } from './BotPlayer';
export class MediumBot extends BotPlayer {
  readonly difficulty = BotDifficulty.MEDIUM;
  readonly name: string;
  constructor(name?: string) { super(); this.name = name || 'Careful Carol'; }
  choosePassCards(ctx: BotPassContext): Card[] {
    const hand = [...ctx.hand]; const tp: Card[] = [];
    const qs = hand.find(c => isQueenOfSpades(c)); if (qs) { tp.push(qs); hand.splice(hand.indexOf(qs), 1); }
    for (const r of [Rank.ACE, Rank.KING]) { if (tp.length >= 3) break; const c = hand.find(x => x.suit === Suit.SPADES && x.rank === r); if (c) { tp.push(c); hand.splice(hand.indexOf(c), 1); } }
    const hearts = hand.filter(c => c.suit === Suit.HEARTS).sort((a, b) => b.rank - a.rank);
    for (const c of hearts) { if (tp.length >= 3) break; tp.push(c); hand.splice(hand.indexOf(c), 1); }
    const rem = hand.sort((a, b) => b.rank - a.rank);
    for (const c of rem) { if (tp.length >= 3) break; tp.push(c); }
    return tp.slice(0, 3);
  }
  choosePlay(ctx: BotDecisionContext): Card {
    const { legalMoves: lm, currentTrick: ct } = ctx;
    if (lm.length === 1) return lm[0];
    if (ct.length === 0) { const nh = lm.filter(c => c.suit !== Suit.HEARTS); return (nh.length > 0 ? nh : lm).sort((a, b) => a.rank - b.rank)[0]; }
    const ls = ct[0].card.suit; const fs = lm.some(c => c.suit === ls);
    if (fs) { const ch = Math.max(...ct.filter(tc => tc.card.suit === ls).map(tc => tc.card.rank)); const cd = lm.filter(c => c.rank < ch); if (cd.length > 0) return cd.sort((a, b) => b.rank - a.rank)[0]; return lm.sort((a, b) => b.rank - a.rank)[0]; }
    const qs = lm.find(c => isQueenOfSpades(c)); if (qs) return qs;
    const hearts = lm.filter(c => c.suit === Suit.HEARTS).sort((a, b) => b.rank - a.rank);
    if (hearts.length > 0) return hearts[0];
    return lm.sort((a, b) => b.rank - a.rank)[0];
  }
}
