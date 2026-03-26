import { ClientMessage } from '@shared/protocol';
import { ClientConnection } from './ClientConnection';
import { RoomManager } from '../rooms/RoomManager';
import { Room } from '../rooms/Room';
import { logger } from '../utils/logger';

export class MessageRouter {
  private roomManager: RoomManager;
  private lobbySubscribers: Set<ClientConnection> = new Set();

  constructor(roomManager: RoomManager) { this.roomManager = roomManager; }

  handleMessage(client: ClientConnection, message: ClientMessage): void {
    if (!client.checkRateLimit()) { client.send({ type: 'ERROR', message: 'Rate limit exceeded', code: 'RATE_LIMIT' }); return; }
    switch (message.type) {
      case 'PING': client.send({ type: 'PONG' }); break;
      case 'SET_PLAYER_INFO': client.name = (message as any).name; client.avatar = (message as any).avatar; break;
      case 'JOIN_LOBBY': this.handleJoinLobby(client); break;
      case 'CREATE_ROOM': this.handleCreateRoom(client, message); break;
      case 'JOIN_ROOM': this.handleJoinRoom(client, message); break;
      case 'LEAVE_ROOM': this.handleLeaveRoom(client); break;
      case 'SET_READY': this.handleSetReady(client, (message as any).ready); break;
      case 'START_GAME': this.handleStartGame(client); break;
      case 'PASS_CARDS': this.handlePassCards(client, (message as any).cardIds); break;
      case 'PLAY_CARD': this.handlePlayCard(client, (message as any).cardId); break;
      case 'CHAT_MESSAGE': this.handleChat(client, (message as any).text); break;
      case 'REMATCH': this.handleRematch(client); break;
      default: client.send({ type: 'ERROR', message: 'Unknown message type', code: 'UNKNOWN_TYPE' });
    }
  }

  handleDisconnect(client: ClientConnection): void {
    this.lobbySubscribers.delete(client);
    const room = this.roomManager.getRoomForPlayer(client.id);
    if (room) {
      if (room.getStatus() === 'WAITING') { this.roomManager.leaveRoom(client.id); this.broadcastRoomUpdate(room); }
      else { this.broadcastToRoom(room, { type: 'PLAYER_DISCONNECTED', playerId: client.id, playerName: client.name }, client.id); }
    }
    this.broadcastLobbyState(); client.cleanup();
  }

  private handleJoinLobby(client: ClientConnection): void { this.lobbySubscribers.add(client); client.send({ type: 'LOBBY_STATE', rooms: this.roomManager.listRooms() }); }

  private broadcastLobbyState(): void {
    const rooms = this.roomManager.listRooms();
    for (const s of this.lobbySubscribers) { if (s.isConnected()) s.send({ type: 'LOBBY_STATE', rooms }); else this.lobbySubscribers.delete(s); }
  }

  private handleCreateRoom(client: ClientConnection, message: any): void {
    const { room, error } = this.roomManager.createRoom(client.id, client.name || 'Player', client.avatar, client, { name: message.roomName, password: message.password, settings: message.settings, botBackfill: message.botBackfill ?? true });
    if (error || !room) { client.send({ type: 'ERROR', message: error || 'Failed', code: 'CREATE_FAILED' }); return; }
    this.setupRoomListeners(room); this.lobbySubscribers.delete(client);
    client.send({ type: 'ROOM_JOINED', roomId: room.id, players: room.toPlayerList(), settings: room.config.settings, yourPlayerId: client.id });
    this.broadcastLobbyState();
  }

  private handleJoinRoom(client: ClientConnection, message: any): void {
    const { room, error } = this.roomManager.joinRoom(client.id, client.name || 'Player', client.avatar, client, message.roomId, message.password);
    if (error || !room) { client.send({ type: 'ERROR', message: error || 'Failed', code: 'JOIN_FAILED' }); return; }
    this.lobbySubscribers.delete(client);
    client.send({ type: 'ROOM_JOINED', roomId: room.id, players: room.toPlayerList(), settings: room.config.settings, yourPlayerId: client.id });
    this.broadcastRoomUpdate(room); this.broadcastLobbyState();
  }

  private handleLeaveRoom(client: ClientConnection): void { const room = this.roomManager.getRoomForPlayer(client.id); this.roomManager.leaveRoom(client.id); if (room) this.broadcastRoomUpdate(room); this.broadcastLobbyState(); }
  private handleSetReady(client: ClientConnection, ready: boolean): void { const room = this.roomManager.getRoomForPlayer(client.id); if (!room) return; room.setReady(client.id, ready); this.broadcastRoomUpdate(room); }

  private handleStartGame(client: ClientConnection): void {
    const room = this.roomManager.getRoomForPlayer(client.id); if (!room) return;
    if (room.getHostId() !== client.id) { client.send({ type: 'ERROR', message: 'Not host', code: 'NOT_HOST' }); return; }
    const result = room.startGame();
    if (!result.success) client.send({ type: 'ERROR', message: result.error || 'Cannot start', code: 'START_FAILED' });
    this.broadcastLobbyState();
  }

  private handlePassCards(client: ClientConnection, cardIds: string[]): void { const room = this.roomManager.getRoomForPlayer(client.id); const game = room?.getGame(); if (!game) return; const r = game.submitPass(client.id, cardIds); if (!r.success) client.send({ type: 'ERROR', message: r.error || 'Invalid pass', code: 'PASS_FAILED' }); }
  private handlePlayCard(client: ClientConnection, cardId: string): void { const room = this.roomManager.getRoomForPlayer(client.id); const game = room?.getGame(); if (!game) return; const r = game.playCard(client.id, cardId); if (!r.success) client.send({ type: 'ERROR', message: r.error || 'Invalid play', code: 'PLAY_FAILED' }); }
  private handleChat(client: ClientConnection, text: string): void { const room = this.roomManager.getRoomForPlayer(client.id); if (!room) return; const s = text.slice(0, 200).trim(); if (!s) return; this.broadcastToRoom(room, { type: 'CHAT_BROADCAST', from: client.id, fromName: client.name, text: s, timestamp: Date.now() }); }
  private handleRematch(client: ClientConnection): void { const room = this.roomManager.getRoomForPlayer(client.id); if (room) room.setReady(client.id, true); }

  private setupRoomListeners(room: Room): void {
    room.on('gameDeal', (data) => {
      for (const hd of data.hands) {
        const player = room.getPlayer(hd.playerId);
        if (player && !player.isBot && player.ws) {
          const positions = room.getPlayers().map((p, i) => ({ id: p.id, name: p.name, position: ['SOUTH','WEST','NORTH','EAST'][i], avatar: p.avatar }));
          const pi = room.getPlayers().findIndex(p => p.id === hd.playerId);
          const rotated = positions.map((pos, i) => ({ ...pos, position: ['SOUTH','WEST','NORTH','EAST'][(i - pi + 4) % 4] }));
          player.ws.send({ type: 'GAME_STARTED', hand: hd.hand, passDirection: data.passDirection, playerPositions: rotated, roundNumber: data.roundNumber });
        }
      }
    });
    room.on('gamePassRequest', (d) => this.broadcastToHumansInRoom(room, { type: 'WAITING_FOR_PASS', passDirection: d.passDirection }));
    room.on('gamePassComplete', (data) => {
      for (const [pid, cards] of Object.entries(data.passedCards)) {
        const player = room.getPlayer(pid as string);
        if (player && !player.isBot && player.ws) {
          const hd = data.hands.find((h: any) => h.playerId === pid);
          player.ws.send({ type: 'PASS_RECEIVED', newCards: cards, newHand: hd?.hand || [] });
        }
      }
    });
    room.on('gameTurnStart', (d) => { if (d.isBot) return; const p = room.getPlayer(d.playerId); if (p?.ws) p.ws.send({ type: 'YOUR_TURN', legalMoves: d.legalMoves, currentTrick: d.currentTrick, trickNumber: d.trickNumber }); });
    room.on('gameCardPlayed', (d) => this.broadcastToRoom(room, { type: 'CARD_PLAYED', playerId: d.playerId, card: d.card, trickComplete: d.trickComplete }));
    room.on('gameTrickComplete', (d) => this.broadcastToRoom(room, { type: 'TRICK_COMPLETE', winnerId: d.winnerId, trick: d.trick, points: d.points, heartsBroken: d.heartsBroken }));
    room.on('gameHandComplete', (d) => this.broadcastToRoom(room, { type: 'HAND_COMPLETE', scores: d.scores, totalScores: d.totalScores, moonShooter: d.moonShooter }));
    room.on('gameOver', (d) => { this.broadcastToRoom(room, { type: 'GAME_OVER', finalScores: d.finalScores, winnerId: d.winnerId, winnerName: d.winnerName }); this.broadcastLobbyState(); });
  }

  private broadcastRoomUpdate(room: Room): void { this.broadcastToRoom(room, { type: 'ROOM_UPDATED', players: room.toPlayerList(), hostId: room.getHostId() }); }

  private broadcastToRoom(room: Room, message: any, excludeId?: string): void {
    for (const p of room.getPlayers()) {
      if (p.isBot || (excludeId && p.id === excludeId)) continue;
      if (p.ws && typeof p.ws.send === 'function') try { p.ws.send(message); } catch {}
    }
  }

  private broadcastToHumansInRoom(room: Room, message: any): void { this.broadcastToRoom(room, message); }
}
