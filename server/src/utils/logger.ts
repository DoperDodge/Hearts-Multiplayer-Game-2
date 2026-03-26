type LogLevel = 'debug' | 'info' | 'warn' | 'error';
const LOG_LEVELS: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };
const currentLevel = LOG_LEVELS[(process.env.LOG_LEVEL as LogLevel) || 'info'];
function log(level: LogLevel, message: string, data?: any): void {
  if (LOG_LEVELS[level] < currentLevel) return;
  const entry = { timestamp: new Date().toISOString(), level: level.toUpperCase(), message, ...(data ? { data } : {}) };
  const output = JSON.stringify(entry);
  if (level === 'error') console.error(output); else if (level === 'warn') console.warn(output); else console.log(output);
}
export const logger = { debug: (msg: string, data?: any) => log('debug', msg, data), info: (msg: string, data?: any) => log('info', msg, data), warn: (msg: string, data?: any) => log('warn', msg, data), error: (msg: string, data?: any) => log('error', msg, data) };
