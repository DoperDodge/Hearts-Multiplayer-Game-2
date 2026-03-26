try { require('tsconfig-paths/register'); } catch { }

import express from 'express';
import { createServer } from 'http';
import path from 'path';
import { WebSocketServerWrapper } from './websocket/WebSocketServer';
import { MessageRouter } from './websocket/MessageRouter';
import { RoomManager } from './rooms/RoomManager';
import { logger } from './utils/logger';

const PORT = parseInt(process.env.PORT || '3001', 10);
const NODE_ENV = process.env.NODE_ENV || 'development';

const app = express();
app.use(express.json());

const roomManager = new RoomManager();

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', rooms: roomManager.getRoomCount(), players: roomManager.getPlayerCount(), uptime: process.uptime() });
});

if (NODE_ENV === 'production') {
  const clientPath = path.resolve('/app/client/dist');
  app.use(express.static(clientPath));
  app.get('*', (_req, res) => { res.sendFile(path.join(clientPath, 'index.html')); });
}

const httpServer = createServer(app);
const messageRouter = new MessageRouter(roomManager);
const wsServer = new WebSocketServerWrapper(httpServer, messageRouter);

httpServer.listen(PORT, () => {
  logger.info(`Pixel Hearts server running`, { port: PORT, env: NODE_ENV, nodeVersion: process.version });
});

function shutdown(): void {
  logger.info('Shutting down...');
  wsServer.close(); roomManager.destroy();
  httpServer.close(() => { logger.info('Server closed'); process.exit(0); });
  setTimeout(() => process.exit(1), 10000);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
