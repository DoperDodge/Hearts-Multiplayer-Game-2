import { Card, Suit, Rank, TrickCard, PassDirection, GameSettings, isPenaltyCard, isQueenOfSpades, isTwoOfClubs, isTenOfClubs, isKingOfSpades, isQueen } from '@shared/game-types';
import { TEN_OF_CLUBS_POINTS, BLOOD_HEARTS_MULTIPLIER, QUEEN_FRENZY_POINTS, KRAKEN_KING_POINTS } from '@shared/constants';

export function getPassDirection(roundNumber: number): PassDirection {
  const c = (roundNumber - 1) % 4;
  return [PassDirection.LEFT, PassDirection.RIGHT, PassDirection.ACROSS, PassDirection.NONE][c];
}

export function getPassTargetIndex(from: number, dir: PassDirection, n: number = 4): number {
  switch (dir) {
    case PassDirection.LEFT: return (from + 1) % n;
    case PassDirection.RIGHT: return (from + n - 1) % n;
    case PassDirection.ACROSS: return (from + n / 2) % n;
    default: return from;
  }
}

export function validatePass(ids: string[], hand: Card[]): boolean {
  if (ids.length !== 3) return false;
  const s = new Set(hand.map(c => c.id));
  return ids.every(id => s.has(id)) && new Set(ids).size === 3;
}

export function findStartingPlayer(hands: Card[][]): number {
  for (let i = 0; i < hands.length; i++) if (hands[i].some(c => isTwoOfClubs(c))) return i;
  return 0;
}

export function getLegalMoves(hand: Card[], trick: TrickCard[], isFirst: boolean, hb: boolean): Card[] {
  if (hand.length === 0) return [];
  if (trick.length === 0) {
    if (isFirst) { const tc = hand.find(c => isTwoOfClubs(c)); if (tc) return [tc]; }
    if (!hb) { const nh = hand.filter(c => c.suit !== Suit.HEARTS); if (nh.length > 0) return nh; }
    return [...hand];
  }
  const ls = trick[0].card.suit;
  const sc = hand.filter(c => c.suit === ls);
  if (sc.length > 0) return sc;
  if (isFirst) { const np = hand.filter(c => !isPenaltyCard(c)); if (np.length > 0) return np; }
  return [...hand];
}

export function isLegalMove(card: Card, hand: Card[], trick: TrickCard[], isFirst: boolean, hb: boolean): boolean {
  return getLegalMoves(hand, trick, isFirst, hb).some(c => c.id === card.id);
}

export function getTrickWinner(trick: TrickCard[]): TrickCard {
  const ls = trick[0].card.suit;
  let w = trick[0];
  for (let i = 1; i < trick.length; i++) if (trick[i].card.suit === ls && trick[i].card.rank > w.card.rank) w = trick[i];
  return w;
}

export function doesCardBreakHearts(card: Card): boolean {
  return card.suit === Suit.HEARTS || isQueenOfSpades(card);
}

export function calculateTrickPoints(cards: Card[], settings: Partial<GameSettings> = {}): number {
  const jod = settings.jackOfDiamonds ?? false;
  const bh = settings.bloodHearts ?? false;
  const toc = settings.tenOfClubs ?? false;
  const qf = settings.queenFrenzy ?? false;
  const kk = settings.krakenKing ?? false;

  let p = 0;
  for (const c of cards) {
    if (c.suit === Suit.HEARTS) p += bh ? BLOOD_HEARTS_MULTIPLIER : 1;
    if (isQueenOfSpades(c)) p += 13;
    if (jod && c.suit === Suit.DIAMONDS && c.rank === Rank.JACK) p -= 10;
    if (toc && isTenOfClubs(c)) p += TEN_OF_CLUBS_POINTS;
    if (qf && isQueen(c) && !isQueenOfSpades(c)) p += QUEEN_FRENZY_POINTS;
    if (kk && isKingOfSpades(c)) p += KRAKEN_KING_POINTS;
  }
  return p;
}
