import { EventEmitter } from 'events';
import { GameSettings, BotDifficulty, PassDirection, Card, MoonScoringVariant } from '@shared/game-types';
import { NUM_PLAYERS, BOT_NAMES } from '@shared/constants';
import { HeartsGame } from '../game/HeartsGame';
import { EasyBot } from '../bots/EasyBot';
import { MediumBot } from '../bots/MediumBot';
import { HardBot } from '../bots/HardBot';
import { BotPlayer, BotDecisionContext, BotPassContext } from '../bots/BotPlayer';
import { RoomStatus, RoomConfig, RoomPlayer } from './RoomTypes';
import { generateId, generateRoomCode } from '../utils/id-generator';
import { logger } from '../utils/logger';

export class Room extends EventEmitter {
  readonly id: string;
  readonly code: string;
  readonly config: RoomConfig;
  private players: Map<string, RoomPlayer> = new Map();
  private status: RoomStatus = 'WAITING';
  private game: HeartsGame | null = null;
  private bots: Map<string, BotPlayer> = new Map();
  private botNameIndex: Record<string, number> = { EASY: 0, MEDIUM: 0, HARD: 0 };
  readonly createdAt: number;

  constructor(config: RoomConfig) { super(); this.id = generateId(); this.code = generateRoomCode(); this.config = config; this.createdAt = Date.now(); }

  getStatus(): RoomStatus { return this.status; }
  getGame(): HeartsGame | null { return this.game; }
  getPlayerCount(): number { return this.players.size; }
  getHumanCount(): number { return Array.from(this.players.values()).filter(p => !p.isBot).length; }
  getPlayers(): RoomPlayer[] { return Array.from(this.players.values()); }
  getPlayer(pid: string): RoomPlayer | undefined { return this.players.get(pid); }
  getHostId(): string | undefined { for (const p of this.players.values()) if (p.isHost) return p.id; return undefined; }
  hasPassword(): boolean { return !!this.config.password; }
  isFull(): boolean { return this.players.size >= this.config.maxPlayers; }
  isEmpty(): boolean { return this.getHumanCount() === 0; }

  addPlayer(id: string, name: string, avatar: number, ws: any): { success: boolean; error?: string } {
    if (this.status !== 'WAITING') return { success: false, error: 'Game in progress' };
    if (this.isFull()) return { success: false, error: 'Room full' };
    if (this.players.has(id)) return { success: false, error: 'Already in room' };
    const isHost = this.players.size === 0;
    this.players.set(id, { id, name, avatar, isReady: false, isHost, isBot: false, ws });
    this.emit('playerJoined', { playerId: id, name });
    return { success: true };
  }

  removePlayer(pid: string): void {
    const p = this.players.get(pid); if (!p) return;
    this.players.delete(pid);
    if (p.isHost) { const rem = Array.from(this.players.values()).filter(p => !p.isBot); if (rem.length > 0) rem[0].isHost = true; }
    this.emit('playerLeft', { playerId: pid, name: p.name });
    if (this.isEmpty()) this.emit('roomEmpty');
  }

  setReady(pid: string, ready: boolean): void { const p = this.players.get(pid); if (p) { p.isReady = ready; this.emit('readyChanged', { playerId: pid, ready }); } }

  updateSettings(pid: string, settings: GameSettings): { success: boolean; error?: string } {
    if (this.status !== 'WAITING') return { success: false, error: 'Game in progress' };
    const p = this.players.get(pid);
    if (!p || !p.isHost) return { success: false, error: 'Not host' };
    (this.config as any).settings = { ...this.config.settings, ...settings };
    return { success: true };
  }

  addBot(difficulty: BotDifficulty): string {
    const names = BOT_NAMES[difficulty]; const idx = this.botNameIndex[difficulty] % names.length; this.botNameIndex[difficulty]++;
    const name = names[idx]; const botId = `bot_${generateId().slice(0, 8)}`; const avatar = Math.floor(Math.random() * 12);
    let bot: BotPlayer;
    switch (difficulty) { case BotDifficulty.EASY: bot = new EasyBot(name); break; case BotDifficulty.MEDIUM: bot = new MediumBot(name); break; case BotDifficulty.HARD: bot = new HardBot(name); break; default: bot = new MediumBot(name); }
    this.bots.set(botId, bot);
    this.players.set(botId, { id: botId, name, avatar, isReady: true, isHost: false, isBot: true, botDifficulty: difficulty });
    return botId;
  }

  private fillWithBots(): void { if (!this.config.botBackfill) return; while (this.players.size < this.config.maxPlayers) this.addBot(this.config.botDifficulty); }

  canStart(): boolean {
    if (this.status !== 'WAITING') return false;
    const humans = Array.from(this.players.values()).filter(p => !p.isBot);
    return humans.every(p => p.isReady) && (this.players.size === this.config.maxPlayers || this.config.botBackfill);
  }

  startGame(): { success: boolean; error?: string } {
    if (this.status !== 'WAITING') return { success: false, error: 'Not waiting' };
    this.fillWithBots();
    if (this.players.size < NUM_PLAYERS) return { success: false, error: `Need ${NUM_PLAYERS} players` };
    this.status = 'STARTING';
    const playerList = Array.from(this.players.values()).map(p => ({ id: p.id, name: p.name, isBot: p.isBot }));
    this.game = new HeartsGame(playerList, this.config.settings);
    this.setupGameListeners();
    this.status = 'IN_PROGRESS';
    this.game.startNewHand();
    logger.info('Game started', { roomId: this.id, players: playerList.map(p => p.name) });
    return { success: true };
  }

  private setupGameListeners(): void {
    if (!this.game) return;
    this.game.on('deal', (d) => { this.emit('gameDeal', d); });
    this.game.on('passRequest', (d) => { this.emit('gamePassRequest', d); this.handleBotPasses(); });
    this.game.on('passComplete', (d) => { this.emit('gamePassComplete', d); });
    this.game.on('turnStart', (d) => { this.emit('gameTurnStart', d); if (d.isBot) this.handleBotTurn(d.playerId, d.legalMoves); });
    this.game.on('cardPlayed', (d) => { this.emit('gameCardPlayed', d); });
    this.game.on('trickComplete', (d) => { this.emit('gameTrickComplete', d); });
    this.game.on('handComplete', (d) => { this.emit('gameHandComplete', d); setTimeout(() => { if (this.game && this.game.getPhase() !== 'GAME_OVER') this.game.startNewHand(); }, 3000); });
    this.game.on('moonShot', (d) => { this.emit('gameMoonShot', d); });
    this.game.on('gameOver', (d) => { this.status = 'FINISHED'; this.emit('gameOver', d); });
  }

  private async handleBotPasses(): Promise<void> {
    if (!this.game) return;
    for (const [botId, bot] of this.bots) {
      const hand = this.game.getPlayerHand(botId); if (hand.length === 0) continue;
      const ctx: BotPassContext = { hand, direction: this.game.getPassDirection(), playerId: botId };
      const passCards = await bot.thinkAndChoosePass(ctx);
      this.game.submitPass(botId, passCards.map(c => c.id));
    }
  }

  private async handleBotTurn(botId: string, legalMoveIds: string[]): Promise<void> {
    if (!this.game) return;
    const bot = this.bots.get(botId);
    if (!bot) { this.game.autoPlay(botId); return; }
    const hand = this.game.getPlayerHand(botId);
    const legalMoves = hand.filter(c => legalMoveIds.includes(c.id));
    const ctx: BotDecisionContext = { hand, currentTrick: this.game.getCurrentTrick(), isFirstTrick: this.game.getIsFirstTrick(), heartsBroken: this.game.isHeartsBroken(), trickNumber: this.game.getTrickNumber(), legalMoves, scores: this.game.getTotalScores(), playerId: botId };
    const chosen = await bot.thinkAndChoosePlay(ctx);
    this.game.playCard(botId, chosen.id);
  }

  toRoomInfo(): any { return { id: this.id, code: this.code, name: this.config.name, hostId: this.getHostId(), playerCount: this.players.size, maxPlayers: this.config.maxPlayers, status: this.status, hasPassword: this.hasPassword(), settings: this.config.settings, createdAt: this.createdAt }; }
  toPlayerList(): any[] { return Array.from(this.players.values()).map(p => ({ id: p.id, name: p.name, avatar: p.avatar, isReady: p.isReady, isHost: p.isHost, isBot: p.isBot })); }
}
