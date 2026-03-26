// ============================================================
// PIXEL HEARTS — Game State Store (Zustand) 
// All settings are wired: animation speed, auto-sort, SFX, etc.
// ============================================================

import { create } from 'zustand';
import {
  Card, Trick, TrickCard, GamePhase, PassDirection,
  PlayerPosition, BotDifficulty, MoonScoringVariant, GameSettings,
  isQueenOfSpades,
} from '@shared/game-types';
import { BOT_NAMES, NUM_PLAYERS, DEFAULT_SCORE_LIMIT } from '@shared/constants';
import { createDeck, shuffleDeck, dealCards, sortHand, removeCard } from '../game-logic/deck';
import {
  getPassDirection, getPassTargetIndex, findStartingPlayer,
  getLegalMoves, getTrickWinner, doesCardBreakHearts,
  calculateTrickPoints,
} from '../game-logic/rules';
import { scoreHand, applyMoonScoring, isGameOver, getWinner } from '../game-logic/scoring';
import { chooseBotPassCards, chooseBotPlay, getBotDelay } from '../game-logic/bot-ai';
import { useSettingsStore, getSpeedMultiplier } from '../store/settingsStore';
import { audioManager } from '../audio/AudioManager';
import { wsClient } from '../network/WebSocketClient';

export interface PlayerData {
  id: string;
  name: string;
  position: PlayerPosition;
  hand: Card[];
  tricksWon: Trick[];
  score: number;
  totalScore: number;
  isBot: boolean;
  botDifficulty?: BotDifficulty;
  avatar: number;
  cardCount: number;
  _passCards?: string[];
}

interface GameStore {
  phase: GamePhase;
  players: PlayerData[];
  humanPlayerIndex: number;
  roundNumber: number;
  passDirection: PassDirection;
  currentTrick: TrickCard[];
  trickNumber: number;
  currentPlayerIndex: number;
  heartsBroken: boolean;
  isFirstTrick: boolean;
  legalMoves: string[];
  selectedPassCards: string[];
  lastTrick: TrickCard[] | null;
  lastTrickWinner: string | null;
  moonShooter: string | null;
  handScores: Record<string, number> | null;
  gameWinner: string | null;
  message: string;
  isMultiplayer: boolean;
  settings: GameSettings;
  tricksByPlayer: Map<string, Trick[]>;
  trickHistory: Trick[];
  pendingPlayCard: string | null; // for confirm-play mode
  screenShaking: boolean;

  startSoloGame: (difficulty: BotDifficulty, settings?: Partial<GameSettings>) => void;
  selectPassCard: (cardId: string) => void;
  confirmPass: () => void;
  playCard: (cardId: string) => void;
  confirmPendingPlay: () => void;
  cancelPendingPlay: () => void;
  reset: () => void;
}

const POSITIONS = [PlayerPosition.SOUTH, PlayerPosition.WEST, PlayerPosition.NORTH, PlayerPosition.EAST];

const defaultSettings: GameSettings = {
  scoreLimit: DEFAULT_SCORE_LIMIT,
  jackOfDiamonds: false,
  moonScoringVariant: MoonScoringVariant.ADD_TO_OTHERS,
  noPointsOnFirstTrick: false,
  queenBreaksHearts: true,
  botDifficulty: BotDifficulty.MEDIUM,
  turnTimeout: 60000,
  animationSpeed: 'normal',
  tenOfClubs: false,
  bloodHearts: false,
  noPassing: false,
  queenFrenzy: false,
  krakenKing: false,
};

/** Get current animation delay multiplier from settings */
function speedMult(): number {
  return getSpeedMultiplier(useSettingsStore.getState().animationSpeed);
}

/** Trigger screen shake if enabled */
function triggerShake(set: (s: Partial<GameStore>) => void): void {
  if (!useSettingsStore.getState().screenShake) return;
  set({ screenShaking: true });
  setTimeout(() => set({ screenShaking: false }), 300);
}

// ── Internal helpers ─────────────────────────────────────

function _startNewHand(get: () => GameStore, set: (s: Partial<GameStore>) => void) {
  const state = get();
  const roundNumber = state.roundNumber + 1;
  const passDirection = state.settings.noPassing ? PassDirection.NONE : getPassDirection(roundNumber);

  const deck = shuffleDeck(createDeck());
  const hands = dealCards(deck, NUM_PLAYERS);

  // Auto-sort is handled by dealCards already (sortHand called inside)
  // If autoSortHand is OFF, we'd skip sort — but for Hearts sorted hand is standard

  const players = state.players.map((p, i) => ({
    ...p,
    hand: hands[i],
    tricksWon: [] as Trick[],
    score: 0,
    cardCount: hands[i].length,
    _passCards: undefined,
  }));

  const tricksByPlayer = new Map<string, Trick[]>();
  players.forEach(p => tricksByPlayer.set(p.id, []));

  audioManager.playSFX('card_deal');

  set({
    phase: passDirection === PassDirection.NONE ? GamePhase.PLAYING : GamePhase.PASSING,
    players,
    roundNumber,
    passDirection,
    currentTrick: [],
    trickNumber: 1,
    heartsBroken: false,
    isFirstTrick: true,
    selectedPassCards: [],
    lastTrick: null,
    lastTrickWinner: null,
    moonShooter: null,
    handScores: null,
    message: passDirection === PassDirection.NONE ? '' : `Pass 3 cards ${passDirection.toLowerCase()}`,
    tricksByPlayer,
    trickHistory: [],
    pendingPlayCard: null,
  });

  if (passDirection === PassDirection.NONE) {
    setTimeout(() => _startPlayPhase(get, set), 300 * speedMult());
  } else {
    setTimeout(() => {
      const s = get();
      const updatedPlayers = s.players.map(p => {
        if (p.isBot) {
          const passCards = chooseBotPassCards(p.hand, p.botDifficulty || BotDifficulty.MEDIUM);
          return { ...p, _passCards: passCards.map(c => c.id) };
        }
        return p;
      });
      set({ players: updatedPlayers });
    }, 500 * speedMult());
  }
}

function _startPlayPhase(get: () => GameStore, set: (s: Partial<GameStore>) => void) {
  const state = get();
  const hands = state.players.map(p => p.hand);
  const startIdx = findStartingPlayer(hands);

  const legalMoves = startIdx === state.humanPlayerIndex
    ? getLegalMoves(state.players[startIdx].hand, [], true, false).map(c => c.id)
    : [];

  if (startIdx === state.humanPlayerIndex) {
    audioManager.playSFX('your_turn');
  }

  set({
    phase: GamePhase.PLAYING,
    currentPlayerIndex: startIdx,
    isFirstTrick: true,
    legalMoves,
    message: startIdx === state.humanPlayerIndex ? 'Your turn — play the 2♣' : '',
  });

  if (state.players[startIdx].isBot) {
    _triggerBotPlay(get, set);
  }
}

function _executePlay(get: () => GameStore, set: (s: Partial<GameStore>) => void, playerIndex: number, cardId: string) {
  const state = get();
  const players = state.players.map(p => ({ ...p, hand: [...p.hand] }));
  const player = players[playerIndex];
  const card = removeCard(player.hand, cardId);
  if (!card) return;

  player.cardCount = player.hand.length;
  let heartsBroken = state.heartsBroken;
  const currentTrick: TrickCard[] = [...state.currentTrick, { card, playedBy: player.id }];

  // SFX
  audioManager.playSFX('card_play');
  if (isQueenOfSpades(card)) {
    audioManager.playSFX('queen_played');
    triggerShake(set);
  }

  if (!heartsBroken && state.currentTrick.length > 0) {
    const ledSuit = state.currentTrick[0].card.suit;
    if (card.suit !== ledSuit && doesCardBreakHearts(card)) {
      heartsBroken = true;
      audioManager.playSFX('hearts_break');
      triggerShake(set);
    }
  }

  set({ players, currentTrick, heartsBroken });

  if (currentTrick.length === NUM_PLAYERS) {
    setTimeout(() => _resolveTrick(get, set), 600 * speedMult());
  } else {
    const nextIdx = (playerIndex + 1) % NUM_PLAYERS;
    const nextLegalMoves = nextIdx === state.humanPlayerIndex
      ? getLegalMoves(players[nextIdx].hand, currentTrick, state.isFirstTrick, heartsBroken).map(c => c.id)
      : [];

    if (nextIdx === state.humanPlayerIndex) {
      audioManager.playSFX('your_turn');
    }

    set({
      currentPlayerIndex: nextIdx,
      legalMoves: nextLegalMoves,
      message: nextIdx === state.humanPlayerIndex ? 'Your turn' : '',
    });

    if (players[nextIdx].isBot) {
      _triggerBotPlay(get, set);
    }
  }
}

function _triggerBotPlay(get: () => GameStore, set: (s: Partial<GameStore>) => void) {
  const state = get();
  const player = state.players[state.currentPlayerIndex];
  if (!player || !player.isBot) return;

  const difficulty = player.botDifficulty || BotDifficulty.MEDIUM;
  const delay = getBotDelay(difficulty, speedMult());
  const expectedIdx = state.currentPlayerIndex;

  setTimeout(() => {
    const cur = get();
    if (cur.phase !== GamePhase.PLAYING || cur.currentPlayerIndex !== expectedIdx) return;

    const bot = cur.players[cur.currentPlayerIndex];
    const legalMoves = getLegalMoves(bot.hand, cur.currentTrick, cur.isFirstTrick, cur.heartsBroken);
    if (legalMoves.length === 0) return;

    const chosen = chooseBotPlay({
      hand: bot.hand,
      currentTrick: cur.currentTrick,
      isFirstTrick: cur.isFirstTrick,
      heartsBroken: cur.heartsBroken,
      legalMoves,
    }, difficulty);

    _executePlay(get, set, cur.currentPlayerIndex, chosen.id);
  }, delay);
}

function _resolveTrick(get: () => GameStore, set: (s: Partial<GameStore>) => void) {
  const state = get();
  if (state.currentTrick.length < NUM_PLAYERS) return;

  const winner = getTrickWinner(state.currentTrick);
  const winnerIdx = state.players.findIndex(p => p.id === winner.playedBy);
  const points = calculateTrickPoints(state.currentTrick.map(tc => tc.card), state.settings);

  const trick: Trick = {
    cards: [...state.currentTrick],
    ledSuit: state.currentTrick[0].card.suit,
    winnerId: winner.playedBy,
  };

  const tricksByPlayer = new Map(state.tricksByPlayer);
  tricksByPlayer.set(winner.playedBy, [...(tricksByPlayer.get(winner.playedBy) || []), trick]);

  const players = state.players.map(p =>
    p.id === winner.playedBy ? { ...p, tricksWon: [...p.tricksWon, trick] } : { ...p }
  );

  // SFX for trick result
  if (points > 0) {
    audioManager.playSFX('trick_lose');
    if (useSettingsStore.getState().screenShake && points >= 13) {
      triggerShake(set);
    }
  } else {
    audioManager.playSFX('trick_win');
  }

  const nextTrickNumber = state.trickNumber + 1;

  set({
    lastTrick: state.currentTrick,
    lastTrickWinner: winner.playedBy,
    players,
    tricksByPlayer,
    trickHistory: [...state.trickHistory, trick],
    message: `${players[winnerIdx].name} takes the trick`,
  });

  const collectDelay = 1200 * speedMult();

  setTimeout(() => {
    if (nextTrickNumber > 13) {
      _resolveHand(get, set);
    } else {
      const cur = get();
      const legalMoves = winnerIdx === cur.humanPlayerIndex
        ? getLegalMoves(players[winnerIdx].hand, [], false, cur.heartsBroken).map(c => c.id)
        : [];

      if (winnerIdx === cur.humanPlayerIndex) {
        audioManager.playSFX('your_turn');
      }

      set({
        currentTrick: [],
        trickNumber: nextTrickNumber,
        currentPlayerIndex: winnerIdx,
        isFirstTrick: false,
        legalMoves,
        message: winnerIdx === cur.humanPlayerIndex ? 'Your turn to lead' : '',
      });

      if (players[winnerIdx].isBot) {
        _triggerBotPlay(get, set);
      }
    }
  }, collectDelay);
}

function _resolveHand(get: () => GameStore, set: (s: Partial<GameStore>) => void) {
  const state = get();
  const playerIds = state.players.map(p => p.id);
  const result = scoreHand(state.tricksByPlayer, playerIds, state.settings);

  let finalScores = result.scores;
  if (result.moonShooter) {
    finalScores = applyMoonScoring(result.scores, result.moonShooter, state.settings.moonScoringVariant, state.settings);
    audioManager.playSFX('shoot_moon');
    triggerShake(set);
  }

  const players = state.players.map(p => ({
    ...p,
    score: finalScores[p.id] || 0,
    totalScore: p.totalScore + (finalScores[p.id] || 0),
  }));

  const totalScores: Record<string, number> = {};
  players.forEach(p => { totalScores[p.id] = p.totalScore; });

  set({
    phase: GamePhase.SCORING,
    players,
    handScores: finalScores,
    moonShooter: result.moonShooter,
    currentTrick: [],
    message: result.moonShooter
      ? `${players.find(p => p.id === result.moonShooter)?.name} Shot the Moon!`
      : 'Hand complete',
  });

  const scoreDelay = 3000 * speedMult();

  setTimeout(() => {
    if (isGameOver(totalScores, state.settings.scoreLimit)) {
      const winners = getWinner(totalScores);
      const humanId = state.players[state.humanPlayerIndex]?.id;
      if (winners.includes(humanId)) {
        audioManager.playSFX('game_win');
      } else {
        audioManager.playSFX('game_lose');
      }
      set({ phase: GamePhase.GAME_OVER, gameWinner: winners[0], message: '' });
    } else {
      _startNewHand(get, set);
    }
  }, scoreDelay);
}

// ── Store Creation ───────────────────────────────────────

export const useGameStore = create<GameStore>((set, get) => ({
  phase: GamePhase.WAITING,
  players: [],
  humanPlayerIndex: 0,
  roundNumber: 0,
  passDirection: PassDirection.NONE,
  currentTrick: [],
  trickNumber: 0,
  currentPlayerIndex: 0,
  heartsBroken: false,
  isFirstTrick: true,
  legalMoves: [],
  selectedPassCards: [],
  lastTrick: null,
  lastTrickWinner: null,
  moonShooter: null,
  handScores: null,
  gameWinner: null,
  message: '',
  isMultiplayer: false,
  settings: defaultSettings,
  tricksByPlayer: new Map(),
  trickHistory: [],
  pendingPlayCard: null,
  screenShaking: false,

  startSoloGame: (difficulty, settings) => {
    const gameSettings = { ...defaultSettings, ...settings, botDifficulty: difficulty };
    const botNames = BOT_NAMES[difficulty];

    const players: PlayerData[] = [
      {
        id: 'human',
        name: localStorage.getItem('pixelhearts_name')?.replace(/"/g, '') || 'Player',
        position: PlayerPosition.SOUTH,
        hand: [], tricksWon: [], score: 0, totalScore: 0,
        isBot: false,
        avatar: parseInt(localStorage.getItem('pixelhearts_avatar')?.replace(/"/g, '') || '0'),
        cardCount: 0,
      },
      ...botNames.slice(0, 3).map((name, i) => ({
        id: `bot_${i}`,
        name,
        position: POSITIONS[i + 1],
        hand: [] as Card[], tricksWon: [] as Trick[], score: 0, totalScore: 0,
        isBot: true, botDifficulty: difficulty,
        avatar: (i + 4) % 12, cardCount: 0,
      })),
    ];

    set({
      players, settings: gameSettings, humanPlayerIndex: 0,
      isMultiplayer: false, gameWinner: null, roundNumber: 0,
    });

    setTimeout(() => _startNewHand(get, set), 300);
  },

  selectPassCard: (cardId) => {
    const state = get();
    if (state.phase !== GamePhase.PASSING) return;
    let selected = [...state.selectedPassCards];
    if (selected.includes(cardId)) {
      selected = selected.filter(id => id !== cardId);
    } else if (selected.length < 3) {
      selected.push(cardId);
      audioManager.playSFX('card_flip');
    }
    set({ selectedPassCards: selected });
  },

  confirmPass: () => {
    const state = get();
    if (state.selectedPassCards.length !== 3) return;

    audioManager.playSFX('pass_confirm');

    if (state.isMultiplayer) {
      wsClient.send({ type: 'PASS_CARDS', cardIds: state.selectedPassCards });
      set({ selectedPassCards: [], message: 'Waiting for other players...' });
      return;
    }

    const players = state.players.map(p => ({ ...p, hand: [...p.hand] }));
    const passMap = new Map<number, Card[]>();

    const humanCards: Card[] = [];
    for (const cid of state.selectedPassCards) {
      const card = removeCard(players[0].hand, cid);
      if (card) humanCards.push(card);
    }
    const humanTarget = getPassTargetIndex(0, state.passDirection);
    passMap.set(humanTarget, [...(passMap.get(humanTarget) || []), ...humanCards]);

    for (let i = 1; i < players.length; i++) {
      const botPassIds = players[i]._passCards || [];
      const botCards: Card[] = [];
      for (const cid of botPassIds) {
        const card = removeCard(players[i].hand, cid);
        if (card) botCards.push(card);
      }
      const target = getPassTargetIndex(i, state.passDirection);
      passMap.set(target, [...(passMap.get(target) || []), ...botCards]);
    }

    for (const [targetIdx, cards] of passMap) {
      players[targetIdx].hand.push(...cards);
      sortHand(players[targetIdx].hand);
      players[targetIdx].cardCount = players[targetIdx].hand.length;
    }
    for (const p of players) delete p._passCards;

    audioManager.playSFX('card_slide');
    set({ players, selectedPassCards: [], message: '' });
    setTimeout(() => _startPlayPhase(get, set), 500 * speedMult());
  },

  playCard: (cardId) => {
    const state = get();
    if (state.phase !== GamePhase.PLAYING) return;
    if (state.currentPlayerIndex !== state.humanPlayerIndex) return;
    if (!state.legalMoves.includes(cardId)) {
      audioManager.playSFX('error');
      return;
    }

    // Confirm play mode: stage the card first
    if (useSettingsStore.getState().confirmPlay) {
      set({ pendingPlayCard: cardId });
      return;
    }

    if (state.isMultiplayer) {
      wsClient.send({ type: 'PLAY_CARD', cardId });
      set({ legalMoves: [], message: '' });
      return;
    }

    _executePlay(get, set, state.humanPlayerIndex, cardId);
  },

  confirmPendingPlay: () => {
    const state = get();
    if (!state.pendingPlayCard) return;
    const cardId = state.pendingPlayCard;
    set({ pendingPlayCard: null });

    if (state.isMultiplayer) {
      wsClient.send({ type: 'PLAY_CARD', cardId });
      set({ legalMoves: [], message: '' });
      return;
    }

    _executePlay(get, set, state.humanPlayerIndex, cardId);
  },

  cancelPendingPlay: () => {
    set({ pendingPlayCard: null });
  },

  reset: () => {
    set({
      phase: GamePhase.WAITING, players: [], roundNumber: 0,
      currentTrick: [], trickNumber: 0, currentPlayerIndex: 0,
      selectedPassCards: [], lastTrick: null, lastTrickWinner: null,
      moonShooter: null, handScores: null, gameWinner: null,
      message: '', legalMoves: [], tricksByPlayer: new Map(),
      trickHistory: [], pendingPlayCard: null, screenShaking: false,
    });
  },
}));
