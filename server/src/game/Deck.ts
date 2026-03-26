import { Card, Suit, Rank, SUIT_ORDER, cardId } from '@shared/game-types';
import { NUM_PLAYERS, TOTAL_CARDS } from '@shared/constants';
import crypto from 'crypto';

const ALL_RANKS: Rank[] = [Rank.TWO, Rank.THREE, Rank.FOUR, Rank.FIVE, Rank.SIX, Rank.SEVEN, Rank.EIGHT, Rank.NINE, Rank.TEN, Rank.JACK, Rank.QUEEN, Rank.KING, Rank.ACE];

export function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUIT_ORDER) for (const rank of ALL_RANKS) deck.push({ suit, rank, id: cardId(suit, rank) });
  return deck;
}

export function shuffleDeck(deck: Card[]): Card[] {
  const s = [...deck];
  for (let i = s.length - 1; i > 0; i--) { const rb = crypto.randomBytes(4); const j = rb.readUInt32BE(0) % (i + 1); [s[i], s[j]] = [s[j], s[i]]; }
  return s;
}

export function dealCards(deck: Card[], numPlayers: number = NUM_PLAYERS): Card[][] {
  if (deck.length !== TOTAL_CARDS) throw new Error(`Expected ${TOTAL_CARDS} cards`);
  const hands: Card[][] = Array.from({ length: numPlayers }, () => []);
  for (let i = 0; i < deck.length; i++) hands[i % numPlayers].push(deck[i]);
  for (const hand of hands) sortHand(hand);
  return hands;
}

export function sortHand(hand: Card[]): void {
  const so = { [Suit.CLUBS]: 0, [Suit.DIAMONDS]: 1, [Suit.SPADES]: 2, [Suit.HEARTS]: 3 };
  hand.sort((a, b) => so[a.suit] !== so[b.suit] ? so[a.suit] - so[b.suit] : a.rank - b.rank);
}

export function findCard(hand: Card[], cid: string): Card | undefined { return hand.find(c => c.id === cid); }
export function removeCard(hand: Card[], cid: string): Card | null { const i = hand.findIndex(c => c.id === cid); if (i === -1) return null; return hand.splice(i, 1)[0]; }
