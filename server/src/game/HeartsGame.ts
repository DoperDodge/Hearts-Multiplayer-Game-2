import { EventEmitter } from 'events';
import { Card, Suit, Trick, TrickCard, GamePhase, PassDirection, GameSettings, MoonScoringVariant, isPenaltyCard, isTwoOfClubs } from '@shared/game-types';
import { NUM_PLAYERS, CARDS_PER_HAND, PASS_CARD_COUNT, DEFAULT_SCORE_LIMIT } from '@shared/constants';
import { createDeck, shuffleDeck, dealCards, sortHand, findCard, removeCard } from './Deck';
import { getPassDirection, getPassTargetIndex, validatePass, findStartingPlayer, getLegalMoves, isLegalMove, getTrickWinner, doesCardBreakHearts, calculateTrickPoints, getNextPlayerIndex } from './HeartsRules';
import { scoreHand, applyMoonScoring, isGameOver, getWinner } from './Scoring';

export interface GamePlayer { id: string; name: string; hand: Card[]; tricksWon: Trick[]; totalScore: number; isBot: boolean; }

export class HeartsGame extends EventEmitter {
  private players: GamePlayer[];
  private phase: GamePhase;
  private settings: GameSettings;
  private roundNumber: number;
  private currentTrick: TrickCard[];
  private trickNumber: number;
  private currentPlayerIndex: number;
  private leadPlayerIndex: number;
  private heartsBroken: boolean;
  private isFirstTrick: boolean;
  private passDirection: PassDirection;
  private passSelections: Map<string, string[]>;
  private tricksByPlayer: Map<string, Trick[]>;

  constructor(players: { id: string; name: string; isBot: boolean }[], settings: Partial<GameSettings> = {}) {
    super();
    if (players.length !== NUM_PLAYERS) throw new Error(`Need ${NUM_PLAYERS} players`);
    this.players = players.map(p => ({ id: p.id, name: p.name, hand: [], tricksWon: [], totalScore: 0, isBot: p.isBot }));
    this.settings = {
      scoreLimit: settings.scoreLimit ?? DEFAULT_SCORE_LIMIT,
      jackOfDiamonds: settings.jackOfDiamonds ?? false,
      moonScoringVariant: settings.moonScoringVariant ?? MoonScoringVariant.ADD_TO_OTHERS,
      noPointsOnFirstTrick: settings.noPointsOnFirstTrick ?? false,
      queenBreaksHearts: settings.queenBreaksHearts ?? true,
      botDifficulty: settings.botDifficulty ?? 'MEDIUM' as any,
      turnTimeout: settings.turnTimeout ?? 60000,
      animationSpeed: settings.animationSpeed ?? 'normal',
      tenOfClubs: settings.tenOfClubs ?? false,
      bloodHearts: settings.bloodHearts ?? false,
      noPassing: settings.noPassing ?? false,
      queenFrenzy: settings.queenFrenzy ?? false,
      krakenKing: settings.krakenKing ?? false,
    };
    this.phase = GamePhase.WAITING; this.roundNumber = 0; this.currentTrick = []; this.trickNumber = 0;
    this.currentPlayerIndex = 0; this.leadPlayerIndex = 0; this.heartsBroken = false; this.isFirstTrick = true;
    this.passDirection = PassDirection.LEFT; this.passSelections = new Map(); this.tricksByPlayer = new Map();
  }

  getPhase(): GamePhase { return this.phase; }
  getRoundNumber(): number { return this.roundNumber; }
  getPassDirection(): PassDirection { return this.passDirection; }
  getCurrentPlayerIndex(): number { return this.currentPlayerIndex; }
  getCurrentPlayerId(): string { return this.players[this.currentPlayerIndex].id; }
  getCurrentTrick(): TrickCard[] { return [...this.currentTrick]; }
  getTrickNumber(): number { return this.trickNumber; }
  isHeartsBroken(): boolean { return this.heartsBroken; }
  getIsFirstTrick(): boolean { return this.isFirstTrick; }
  getPlayer(pid: string): GamePlayer | undefined { return this.players.find(p => p.id === pid); }
  getPlayerIndex(pid: string): number { return this.players.findIndex(p => p.id === pid); }
  getPlayerHand(pid: string): Card[] { const p = this.getPlayer(pid); return p ? [...p.hand] : []; }
  getPlayers(): GamePlayer[] { return this.players.map(p => ({ ...p, hand: [...p.hand] })); }
  getTotalScores(): Record<string, number> { const s: Record<string, number> = {}; for (const p of this.players) s[p.id] = p.totalScore; return s; }

  getLegalMovesFor(pid: string): Card[] {
    const p = this.getPlayer(pid); if (!p || this.phase !== GamePhase.PLAYING || this.players[this.currentPlayerIndex].id !== pid) return [];
    return getLegalMoves(p.hand, this.currentTrick, this.isFirstTrick, this.heartsBroken, this.settings.noPointsOnFirstTrick);
  }

  startNewHand(): void {
    this.roundNumber++; this.phase = GamePhase.DEALING;
    this.currentTrick = []; this.trickNumber = 0; this.heartsBroken = false; this.isFirstTrick = true;
    this.passSelections.clear(); this.tricksByPlayer.clear();
    for (const p of this.players) { p.tricksWon = []; this.tricksByPlayer.set(p.id, []); }
    const deck = shuffleDeck(createDeck()); const hands = dealCards(deck, NUM_PLAYERS);
    for (let i = 0; i < this.players.length; i++) this.players[i].hand = hands[i];
    // noPassing forces PassDirection.NONE every round
    this.passDirection = this.settings.noPassing ? PassDirection.NONE : getPassDirection(this.roundNumber);
    this.emit('deal', { roundNumber: this.roundNumber, passDirection: this.passDirection, hands: this.players.map(p => ({ playerId: p.id, hand: [...p.hand] })) });
    if (this.passDirection === PassDirection.NONE) this.startPlay();
    else { this.phase = GamePhase.PASSING; this.emit('passRequest', { passDirection: this.passDirection }); }
  }

  submitPass(pid: string, cardIds: string[]): { success: boolean; error?: string } {
    if (this.phase !== GamePhase.PASSING) return { success: false, error: 'Not passing' };
    if (this.passSelections.has(pid)) return { success: false, error: 'Already submitted' };
    const p = this.getPlayer(pid); if (!p) return { success: false, error: 'Not found' };
    const v = validatePass(cardIds, p.hand); if (!v.valid) return { success: false, error: v.error };
    this.passSelections.set(pid, cardIds);
    if (this.passSelections.size === NUM_PLAYERS) this.executePass();
    return { success: true };
  }

  private executePass(): void {
    const passed: Map<string, Card[]> = new Map();
    for (let i = 0; i < this.players.length; i++) {
      const p = this.players[i]; const ids = this.passSelections.get(p.id)!;
      const ti = getPassTargetIndex(i, this.passDirection); const recv = this.players[ti];
      const cards: Card[] = []; for (const cid of ids) { const c = removeCard(p.hand, cid); if (c) cards.push(c); }
      passed.set(recv.id, [...(passed.get(recv.id) || []), ...cards]);
    }
    for (const [rid, cards] of passed) { const p = this.getPlayer(rid)!; p.hand.push(...cards); sortHand(p.hand); }
    this.emit('passComplete', { passedCards: Object.fromEntries(passed), hands: this.players.map(p => ({ playerId: p.id, hand: [...p.hand] })) });
    this.startPlay();
  }

  private startPlay(): void {
    this.phase = GamePhase.PLAYING; this.trickNumber = 1; this.isFirstTrick = true;
    const si = findStartingPlayer(this.players.map(p => p.hand));
    this.currentPlayerIndex = si; this.leadPlayerIndex = si; this.emitTurnStart();
  }

  private emitTurnStart(): void {
    const p = this.players[this.currentPlayerIndex];
    const lm = getLegalMoves(p.hand, this.currentTrick, this.isFirstTrick, this.heartsBroken, this.settings.noPointsOnFirstTrick);
    this.emit('turnStart', { playerId: p.id, legalMoves: lm.map(c => c.id), currentTrick: [...this.currentTrick], trickNumber: this.trickNumber, isBot: p.isBot });
  }

  playCard(pid: string, cardId: string): { success: boolean; error?: string } {
    if (this.phase !== GamePhase.PLAYING) return { success: false, error: 'Not playing' };
    const p = this.players[this.currentPlayerIndex];
    if (p.id !== pid) return { success: false, error: 'Not your turn' };
    const card = findCard(p.hand, cardId); if (!card) return { success: false, error: 'Card not in hand' };
    if (!isLegalMove(card, p.hand, this.currentTrick, this.isFirstTrick, this.heartsBroken, this.settings.noPointsOnFirstTrick)) return { success: false, error: 'Illegal move' };
    removeCard(p.hand, cardId);
    if (!this.heartsBroken && this.currentTrick.length > 0) {
      const ls = this.currentTrick[0].card.suit;
      if (card.suit !== ls && doesCardBreakHearts(card, this.currentTrick, this.settings.queenBreaksHearts)) this.heartsBroken = true;
    }
    this.currentTrick.push({ card, playedBy: pid });
    this.emit('cardPlayed', { playerId: pid, card, trickComplete: this.currentTrick.length === NUM_PLAYERS });
    if (this.currentTrick.length === NUM_PLAYERS) this.resolveTrick();
    else { this.currentPlayerIndex = getNextPlayerIndex(this.currentPlayerIndex); this.emitTurnStart(); }
    return { success: true };
  }

  private resolveTrick(): void {
    const winner = getTrickWinner(this.currentTrick);
    const wi = this.getPlayerIndex(winner.playedBy);
    const pts = calculateTrickPoints(this.currentTrick.map(tc => tc.card), this.settings);
    const trick: Trick = { cards: [...this.currentTrick], ledSuit: this.currentTrick[0].card.suit, winnerId: winner.playedBy };
    this.players[wi].tricksWon.push(trick); this.tricksByPlayer.get(winner.playedBy)!.push(trick);
    this.emit('trickComplete', { winnerId: winner.playedBy, trick, points: pts, heartsBroken: this.heartsBroken, trickNumber: this.trickNumber });
    this.currentTrick = []; this.trickNumber++; this.isFirstTrick = false;
    if (this.trickNumber > CARDS_PER_HAND) this.resolveHand();
    else { this.currentPlayerIndex = wi; this.leadPlayerIndex = wi; this.emitTurnStart(); }
  }

  private resolveHand(): void {
    this.phase = GamePhase.SCORING;
    const pids = this.players.map(p => p.id);
    const result = scoreHand(this.tricksByPlayer, pids, this.settings);
    let fs = result.scores;
    if (result.moonShooter) {
      if (this.settings.moonScoringVariant !== MoonScoringVariant.PLAYER_CHOICE) {
        fs = applyMoonScoring(result.scores, result.moonShooter, this.settings.moonScoringVariant, this.getTotalScores(), this.settings.scoreLimit, this.settings);
      }
      this.emit('moonShot', { shooterId: result.moonShooter, shooterName: this.getPlayer(result.moonShooter)?.name });
    }
    for (const p of this.players) p.totalScore += fs[p.id] || 0;
    const ts = this.getTotalScores();
    this.emit('handComplete', { scores: fs, totalScores: ts, moonShooter: result.moonShooter, details: result.details });
    if (isGameOver(ts, this.settings.scoreLimit)) this.endGame();
  }

  private endGame(): void {
    this.phase = GamePhase.GAME_OVER; const ts = this.getTotalScores(); const w = getWinner(ts);
    this.emit('gameOver', { finalScores: ts, winnerId: w[0], winnerName: this.getPlayer(w[0])?.name, winners: w });
  }

  autoPlay(pid: string): { success: boolean; error?: string } {
    const lm = this.getLegalMovesFor(pid); if (lm.length === 0) return { success: false, error: 'No legal moves' };
    return this.playCard(pid, [...lm].sort((a, b) => a.rank - b.rank)[0].id);
  }

  getStateSnapshot(forPlayerId: string): any {
    const p = this.getPlayer(forPlayerId);
    return { phase: this.phase, roundNumber: this.roundNumber, passDirection: this.passDirection, hand: p ? [...p.hand] : [], currentTrick: [...this.currentTrick], trickNumber: this.trickNumber, heartsBroken: this.heartsBroken, isFirstTrick: this.isFirstTrick, isYourTurn: this.players[this.currentPlayerIndex]?.id === forPlayerId, legalMoves: this.getLegalMovesFor(forPlayerId).map(c => c.id), scores: this.getTotalScores(), players: this.players.map(pl => ({ id: pl.id, name: pl.name, cardCount: pl.hand.length, totalScore: pl.totalScore, isBot: pl.isBot })) };
  }
}
