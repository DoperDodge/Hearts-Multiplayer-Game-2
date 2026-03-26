import { Card, Suit, Rank, SUIT_ORDER, cardId } from '@shared/game-types';
const ALL_RANKS: Rank[] = [Rank.TWO, Rank.THREE, Rank.FOUR, Rank.FIVE, Rank.SIX, Rank.SEVEN, Rank.EIGHT, Rank.NINE, Rank.TEN, Rank.JACK, Rank.QUEEN, Rank.KING, Rank.ACE];

export function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUIT_ORDER) for (const rank of ALL_RANKS) deck.push({ suit, rank, id: cardId(suit, rank) });
  return deck;
}

export function shuffleDeck(deck: Card[]): Card[] {
  const s = [...deck];
  for (let i = s.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [s[i], s[j]] = [s[j], s[i]]; }
  return s;
}

export function dealCards(deck: Card[], n: number = 4): Card[][] {
  const h: Card[][] = Array.from({ length: n }, () => []);
  for (let i = 0; i < deck.length; i++) h[i % n].push(deck[i]);
  for (const hand of h) sortHand(hand);
  return h;
}

export function sortHand(hand: Card[]): void {
  const so = { [Suit.CLUBS]: 0, [Suit.DIAMONDS]: 1, [Suit.SPADES]: 2, [Suit.HEARTS]: 3 };
  hand.sort((a, b) => so[a.suit] !== so[b.suit] ? so[a.suit] - so[b.suit] : a.rank - b.rank);
}

export function findCard(hand: Card[], cid: string): Card | undefined { return hand.find(c => c.id === cid); }

export function removeCard(hand: Card[], cid: string): Card | null {
  const i = hand.findIndex(c => c.id === cid);
  if (i === -1) return null;
  return hand.splice(i, 1)[0];
}
