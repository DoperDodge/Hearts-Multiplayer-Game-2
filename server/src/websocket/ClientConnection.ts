import WebSocket from 'ws';
import { generateId } from '../utils/id-generator';
import { logger } from '../utils/logger';
import { MAX_MESSAGES_PER_SECOND, WS_HEARTBEAT_INTERVAL } from '@shared/constants';

export class ClientConnection {
  readonly id: string;
  readonly ws: WebSocket;
  name: string = '';
  avatar: number = 0;
  private alive = true;
  private messageCount = 0;
  private messageResetTimer: NodeJS.Timeout | null = null;
  private pingInterval: NodeJS.Timeout | null = null;

  constructor(ws: WebSocket) {
    this.id = generateId(); this.ws = ws;
    this.messageResetTimer = setInterval(() => { this.messageCount = 0; }, 1000);
    ws.on('pong', () => { this.alive = true; });
    this.pingInterval = setInterval(() => {
      if (!this.alive) { logger.warn('Heartbeat failed', { clientId: this.id }); this.terminate(); return; }
      this.alive = false; try { ws.ping(); } catch {}
    }, WS_HEARTBEAT_INTERVAL);
  }

  send(message: any): void {
    if (this.ws.readyState === WebSocket.OPEN) {
      try { this.ws.send(JSON.stringify(message)); } catch (err) { logger.error('Send failed', { clientId: this.id }); }
    }
  }

  checkRateLimit(): boolean { this.messageCount++; return this.messageCount <= MAX_MESSAGES_PER_SECOND; }
  terminate(): void { this.cleanup(); try { this.ws.terminate(); } catch {} }
  cleanup(): void { if (this.messageResetTimer) { clearInterval(this.messageResetTimer); this.messageResetTimer = null; } if (this.pingInterval) { clearInterval(this.pingInterval); this.pingInterval = null; } }
  isConnected(): boolean { return this.ws.readyState === WebSocket.OPEN; }
}
