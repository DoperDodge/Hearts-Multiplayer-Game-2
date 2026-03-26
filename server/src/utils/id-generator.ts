import crypto from 'crypto';
import { ROOM_CODE_LENGTH } from '@shared/constants';
export function generateId(): string { return crypto.randomUUID(); }
export function generateRoomCode(length: number = ROOM_CODE_LENGTH): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let code = ''; const bytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i++) code += chars[bytes[i] % chars.length]; return code;
}
