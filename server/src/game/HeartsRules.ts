import { Card, Suit, Rank, TrickCard, PassDirection, GameSettings, isPenaltyCard, isQueenOfSpades, isTwoOfClubs, isTenOfClubs, isKingOfSpades, isQueen } from '@shared/game-types';
import { PASS_CARD_COUNT, NUM_PLAYERS, TEN_OF_CLUBS_POINTS, BLOOD_HEARTS_MULTIPLIER, QUEEN_FRENZY_POINTS, KRAKEN_KING_POINTS } from '@shared/constants';

export function getPassDirection(roundNumber: number): PassDirection {
  const c = (roundNumber - 1) % 4;
  return [PassDirection.LEFT, PassDirection.RIGHT, PassDirection.ACROSS, PassDirection.NONE][c] as PassDirection;
}

export function getPassTargetIndex(from: number, dir: PassDirection, n: number = NUM_PLAYERS): number {
  switch (dir) { case PassDirection.LEFT: return (from + 1) % n; case PassDirection.RIGHT: return (from + n - 1) % n; case PassDirection.ACROSS: return (from + n / 2) % n; default: return from; }
}

export function validatePass(ids: string[], hand: Card[]): { valid: boolean; error?: string } {
  if (ids.length !== PASS_CARD_COUNT) return { valid: false, error: `Must select exactly ${PASS_CARD_COUNT} cards` };
  const hs = new Set(hand.map(c => c.id));
  for (const id of ids) if (!hs.has(id)) return { valid: false, error: `Card ${id} not in hand` };
  if (new Set(ids).size !== ids.length) return { valid: false, error: 'Duplicates' };
  return { valid: true };
}

export function findStartingPlayer(hands: Card[][]): number {
  for (let i = 0; i < hands.length; i++) if (hands[i].some(c => isTwoOfClubs(c))) return i;
  throw new Error('No 2 of Clubs');
}

export interface LegalMoveModifiers {
  noPointsFirst?: boolean;
  mustBleed?: boolean;
  heartsAlwaysLead?: boolean;
}

export function getLegalMoves(hand: Card[], trick: TrickCard[], isFirst: boolean, hb: boolean, mods: LegalMoveModifiers = {}): Card[] {
  if (hand.length === 0) return [];
  if (trick.length === 0) {
    // Leading a trick
    if (isFirst) { const tc = hand.find(c => isTwoOfClubs(c)); if (tc) return [tc]; }
    if (!hb && !mods.heartsAlwaysLead) { const nh = hand.filter(c => c.suit !== Suit.HEARTS); if (nh.length > 0) return nh; }
    return [...hand];
  }
  // Following suit
  const ls = trick[0].card.suit;
  const sc = hand.filter(c => c.suit === ls);
  if (sc.length > 0) return sc;
  // Void in led suit
  if (isFirst) { const np = hand.filter(c => !isPenaltyCard(c)); if (np.length > 0) return np; }
  // mustBleed: when void, must play penalty cards first
  if (mods.mustBleed && !isFirst) {
    const penaltyCards = hand.filter(c => isPenaltyCard(c));
    if (penaltyCards.length > 0) return penaltyCards;
  }
  return [...hand];
}

export function isLegalMove(card: Card, hand: Card[], trick: TrickCard[], isFirst: boolean, hb: boolean, mods: LegalMoveModifiers = {}): boolean {
  return getLegalMoves(hand, trick, isFirst, hb, mods).some(c => c.id === card.id);
}

export function getTrickWinner(trick: TrickCard[], reverse: boolean = false): TrickCard {
  const ls = trick[0].card.suit; let w = trick[0];
  for (let i = 1; i < trick.length; i++) {
    if (trick[i].card.suit === ls) {
      if (reverse ? trick[i].card.rank < w.card.rank : trick[i].card.rank > w.card.rank) w = trick[i];
    }
  }
  return w;
}

export function doesCardBreakHearts(card: Card, trick: TrickCard[], qbh: boolean = true): boolean {
  if (card.suit === Suit.HEARTS) return true;
  if (qbh && isQueenOfSpades(card)) return true;
  return false;
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

/** Pick n random cards from hand */
export function pickRandomCards(hand: Card[], n: number): Card[] {
  const shuffled = [...hand].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

export function getNextPlayerIndex(cur: number, n: number = NUM_PLAYERS): number { return (cur + 1) % n; }
