import { Room } from './Room';
import { RoomConfig } from './RoomTypes';
import { GameSettings, BotDifficulty, MoonScoringVariant } from '@shared/game-types';
import { MAX_ROOMS, ROOM_CLEANUP_TIMEOUT, DEFAULT_SCORE_LIMIT, DEFAULT_TURN_TIMEOUT, NUM_PLAYERS } from '@shared/constants';
import { logger } from '../utils/logger';

const DEFAULT_SETTINGS: GameSettings = { scoreLimit: DEFAULT_SCORE_LIMIT, jackOfDiamonds: false, moonScoringVariant: MoonScoringVariant.ADD_TO_OTHERS, noPointsOnFirstTrick: false, queenBreaksHearts: true, botDifficulty: BotDifficulty.MEDIUM, turnTimeout: DEFAULT_TURN_TIMEOUT, animationSpeed: 'normal', tenOfClubs: false, bloodHearts: false, noPassing: false, queenFrenzy: false, krakenKing: false, blindPass: false, mustBleed: false, reverseTrickWin: false, heartsAlwaysLead: false, doubleTrouble: false };

export class RoomManager {
  private rooms: Map<string, Room> = new Map();
  private roomsByCode: Map<string, Room> = new Map();
  private playerRooms: Map<string, string> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() { this.cleanupInterval = setInterval(() => this.cleanupStaleRooms(), 30000); }
  destroy(): void { if (this.cleanupInterval) clearInterval(this.cleanupInterval); }

  createRoom(hostId: string, hostName: string, hostAvatar: number, hostWs: any, config?: Partial<RoomConfig>): { room?: Room; error?: string } {
    if (this.rooms.size >= MAX_ROOMS) return { error: 'Server full' };
    if (this.playerRooms.has(hostId)) return { error: 'Already in room' };
    const rc: RoomConfig = { name: config?.name || `Room #${this.rooms.size + 1}`, password: config?.password, maxPlayers: config?.maxPlayers || NUM_PLAYERS, settings: { ...DEFAULT_SETTINGS, ...config?.settings }, botBackfill: config?.botBackfill ?? true, botDifficulty: config?.botDifficulty || BotDifficulty.MEDIUM };
    const room = new Room(rc);
    const r = room.addPlayer(hostId, hostName, hostAvatar, hostWs);
    if (!r.success) return { error: r.error };
    this.rooms.set(room.id, room); this.roomsByCode.set(room.code, room); this.playerRooms.set(hostId, room.id);
    room.on('roomEmpty', () => this.removeRoom(room.id));
    logger.info('Room created', { roomId: room.id, code: room.code, host: hostName });
    return { room };
  }

  joinRoom(pid: string, name: string, avatar: number, ws: any, roomId: string, password?: string): { room?: Room; error?: string } {
    const room = this.rooms.get(roomId) || this.roomsByCode.get(roomId);
    if (!room) return { error: 'Room not found' };
    if (room.hasPassword() && room.config.password !== password) return { error: 'Wrong password' };
    if (this.playerRooms.has(pid)) return { error: 'Already in room' };
    const r = room.addPlayer(pid, name, avatar, ws);
    if (!r.success) return { error: r.error };
    this.playerRooms.set(pid, room.id);
    return { room };
  }

  leaveRoom(pid: string): void { const rid = this.playerRooms.get(pid); if (!rid) return; const room = this.rooms.get(rid); if (room) room.removePlayer(pid); this.playerRooms.delete(pid); }
  getRoom(rid: string): Room | undefined { return this.rooms.get(rid) || this.roomsByCode.get(rid); }
  getRoomForPlayer(pid: string): Room | undefined { const rid = this.playerRooms.get(pid); return rid ? this.rooms.get(rid) : undefined; }
  listRooms(): any[] { return Array.from(this.rooms.values()).map(r => r.toRoomInfo()).sort((a, b) => b.createdAt - a.createdAt); }
  getRoomCount(): number { return this.rooms.size; }
  getPlayerCount(): number { let c = 0; for (const r of this.rooms.values()) c += r.getHumanCount(); return c; }

  private removeRoom(rid: string): void {
    const room = this.rooms.get(rid); if (!room) return;
    for (const p of room.getPlayers()) this.playerRooms.delete(p.id);
    this.rooms.delete(rid); this.roomsByCode.delete(room.code); room.removeAllListeners();
    logger.info('Room removed', { roomId: rid });
  }

  private cleanupStaleRooms(): void { const now = Date.now(); for (const [rid, room] of this.rooms) if (room.isEmpty() && (now - room.createdAt) > ROOM_CLEANUP_TIMEOUT) this.removeRoom(rid); }
}
