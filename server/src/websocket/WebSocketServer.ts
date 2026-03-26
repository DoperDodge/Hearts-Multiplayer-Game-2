import { Server as HttpServer } from 'http';
import { WebSocketServer as WSServer, WebSocket } from 'ws';
import { ClientConnection } from './ClientConnection';
import { MessageRouter } from './MessageRouter';
import { logger } from '../utils/logger';

export class WebSocketServerWrapper {
  private wss: WSServer;
  private clients: Map<string, ClientConnection> = new Map();
  private router: MessageRouter;

  constructor(server: HttpServer, router: MessageRouter) {
    this.router = router;
    this.wss = new WSServer({ server });
    this.wss.on('connection', (ws: WebSocket) => this.handleConnection(ws));
    this.wss.on('error', (error) => logger.error('WS server error', { error: String(error) }));
    logger.info('WebSocket server initialized');
  }

  private handleConnection(ws: WebSocket): void {
    const client = new ClientConnection(ws);
    this.clients.set(client.id, client);
    logger.info('Client connected', { clientId: client.id, total: this.clients.size });
    ws.on('message', (data: Buffer | string) => {
      try { this.router.handleMessage(client, JSON.parse(data.toString())); }
      catch { client.send({ type: 'ERROR', message: 'Invalid message', code: 'PARSE_ERROR' }); }
    });
    ws.on('close', () => { logger.info('Client disconnected', { clientId: client.id }); this.router.handleDisconnect(client); this.clients.delete(client.id); });
    ws.on('error', (error) => logger.error('Client WS error', { clientId: client.id, error: String(error) }));
  }

  getClientCount(): number { return this.clients.size; }
  close(): void { for (const c of this.clients.values()) c.terminate(); this.clients.clear(); this.wss.close(); }
}
