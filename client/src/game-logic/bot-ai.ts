import { Card, Suit, Rank, TrickCard, BotDifficulty, isPenaltyCard, isQueenOfSpades } from '@shared/game-types';
import { getLegalMoves } from './rules';

export interface BotContext {
  hand: Card[];
  currentTrick: TrickCard[];
  isFirstTrick: boolean;
  heartsBroken: boolean;
  legalMoves: Card[];
}

export function chooseBotPassCards(hand: Card[], difficulty: BotDifficulty): Card[] {
  switch (difficulty) {
    case BotDifficulty.EASY: return easyPass(hand);
    case BotDifficulty.MEDIUM: return mediumPass(hand);
    case BotDifficulty.HARD: return hardPass(hand);
    default: return easyPass(hand);
  }
}

export function chooseBotPlay(ctx: BotContext, difficulty: BotDifficulty): Card {
  if (ctx.legalMoves.length === 1) return ctx.legalMoves[0];
  switch (difficulty) {
    case BotDifficulty.EASY: return easyPlay(ctx);
    case BotDifficulty.MEDIUM: return mediumPlay(ctx);
    case BotDifficulty.HARD: return hardPlay(ctx);
    default: return easyPlay(ctx);
  }
}

function easyPass(hand: Card[]): Card[] {
  return [...hand].sort(() => Math.random() - 0.5).slice(0, 3);
}

function easyPlay(ctx: BotContext): Card {
  return ctx.legalMoves[Math.floor(Math.random() * ctx.legalMoves.length)];
}

function mediumPass(hand: Card[]): Card[] {
  const toPass: Card[] = [];
  const remaining = [...hand];
  const priorities = [
    (c: Card) => isQueenOfSpades(c),
    (c: Card) => c.suit === Suit.SPADES && c.rank === Rank.ACE,
    (c: Card) => c.suit === Suit.SPADES && c.rank === Rank.KING,
    (c: Card) => c.suit === Suit.HEARTS && c.rank === Rank.ACE,
    (c: Card) => c.suit === Suit.HEARTS && c.rank === Rank.KING,
    (c: Card) => c.suit === Suit.HEARTS && c.rank === Rank.QUEEN,
  ];
  for (const test of priorities) {
    if (toPass.length >= 3) break;
    const idx = remaining.findIndex(test);
    if (idx >= 0) toPass.push(remaining.splice(idx, 1)[0]);
  }
  remaining.sort((a, b) => b.rank - a.rank);
  while (toPass.length < 3 && remaining.length > 0) toPass.push(remaining.shift()!);
  return toPass.slice(0, 3);
}

function mediumPlay(ctx: BotContext): Card {
  const { legalMoves, currentTrick } = ctx;
  if (currentTrick.length === 0) {
    const nonHearts = legalMoves.filter(c => c.suit !== Suit.HEARTS);
    return (nonHearts.length > 0 ? nonHearts : legalMoves).sort((a, b) => a.rank - b.rank)[0];
  }
  const ledSuit = currentTrick[0].card.suit;
  const followingSuit = legalMoves.some(c => c.suit === ledSuit);
  if (followingSuit) {
    const currentMax = Math.max(...currentTrick.filter(tc => tc.card.suit === ledSuit).map(tc => tc.card.rank));
    const canDuck = legalMoves.filter(c => c.rank < currentMax);
    if (canDuck.length > 0) return canDuck.sort((a, b) => b.rank - a.rank)[0];
    return legalMoves.sort((a, b) => b.rank - a.rank)[0];
  }
  const qs = legalMoves.find(c => isQueenOfSpades(c));
  if (qs) return qs;
  const hearts = legalMoves.filter(c => c.suit === Suit.HEARTS).sort((a, b) => b.rank - a.rank);
  if (hearts.length > 0) return hearts[0];
  return legalMoves.sort((a, b) => b.rank - a.rank)[0];
}

function hardPass(hand: Card[]): Card[] {
  const toPass: Card[] = [];
  const remaining = [...hand];
  const qsIdx = remaining.findIndex(c => isQueenOfSpades(c));
  if (qsIdx >= 0) toPass.push(remaining.splice(qsIdx, 1)[0]);
  const suitCounts: Record<string, number> = {};
  for (const s of [Suit.CLUBS, Suit.DIAMONDS, Suit.SPADES]) suitCounts[s] = remaining.filter(c => c.suit === s).length;
  const shortSuit = Object.entries(suitCounts).filter(([, count]) => count > 0 && count <= 3 - toPass.length).sort((a, b) => a[1] - b[1])[0];
  if (shortSuit) {
    const suitCards = remaining.filter(c => c.suit === shortSuit[0]);
    for (const card of suitCards) { if (toPass.length >= 3) break; toPass.push(card); remaining.splice(remaining.indexOf(card), 1); }
  }
  for (const rank of [Rank.ACE, Rank.KING]) {
    if (toPass.length >= 3) break;
    const idx = remaining.findIndex(c => c.suit === Suit.SPADES && c.rank === rank);
    if (idx >= 0) toPass.push(remaining.splice(idx, 1)[0]);
  }
  const highHearts = remaining.filter(c => c.suit === Suit.HEARTS).sort((a, b) => b.rank - a.rank);
  for (const card of highHearts) { if (toPass.length >= 3) break; toPass.push(card); remaining.splice(remaining.indexOf(card), 1); }
  remaining.sort((a, b) => b.rank - a.rank);
  while (toPass.length < 3 && remaining.length > 0) toPass.push(remaining.shift()!);
  return toPass.slice(0, 3);
}

function hardPlay(ctx: BotContext): Card {
  const { legalMoves, currentTrick } = ctx;
  if (currentTrick.length === 0) {
    const nonHearts = legalMoves.filter(c => c.suit !== Suit.HEARTS);
    return (nonHearts.length > 0 ? nonHearts : legalMoves).sort((a, b) => a.rank - b.rank)[0];
  }
  const ledSuit = currentTrick[0].card.suit;
  const followingSuit = legalMoves.some(c => c.suit === ledSuit);
  const isLast = currentTrick.length === 3;
  if (followingSuit) {
    const currentMax = Math.max(...currentTrick.filter(tc => tc.card.suit === ledSuit).map(tc => tc.card.rank));
    if (isLast) {
      const trickHasPoints = currentTrick.some(tc => tc.card.suit === Suit.HEARTS || isQueenOfSpades(tc.card));
      if (!trickHasPoints) return legalMoves.sort((a, b) => b.rank - a.rank)[0];
    }
    const canDuck = legalMoves.filter(c => c.rank < currentMax);
    if (canDuck.length > 0) return canDuck.sort((a, b) => b.rank - a.rank)[0];
    return legalMoves.sort((a, b) => a.rank - b.rank)[0];
  }
  const qs = legalMoves.find(c => isQueenOfSpades(c));
  if (qs) return qs;
  const highHearts = legalMoves.filter(c => c.suit === Suit.HEARTS).sort((a, b) => b.rank - a.rank);
  if (highHearts.length > 0) return highHearts[0];
  const highSpades = legalMoves.filter(c => c.suit === Suit.SPADES && c.rank >= Rank.KING).sort((a, b) => b.rank - a.rank);
  if (highSpades.length > 0) return highSpades[0];
  return legalMoves.sort((a, b) => b.rank - a.rank)[0];
}

export function getBotDelay(difficulty: BotDifficulty, speedMult: number = 1): number {
  let base: number;
  switch (difficulty) {
    case BotDifficulty.EASY: base = 1000 + Math.random() * 1500; break;
    case BotDifficulty.MEDIUM: base = 800 + Math.random() * 1000; break;
    case BotDifficulty.HARD: base = 1200 + Math.random() * 1800; break;
    default: base = 1000;
  }
  return base * speedMult;
}
