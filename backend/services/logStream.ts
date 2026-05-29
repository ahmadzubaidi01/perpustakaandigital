import { EventEmitter } from 'events';
import { Response } from 'express';

export type LogType = 'REQUEST' | 'ERROR' | 'WARNING' | 'WEBSOCKET' | 'UPLOAD' | 'DATABASE' | 'SYSTEM' | 'AUTH';

export interface LogEvent {
  id: string;
  type: LogType;
  timestamp: string;
  method?: string;
  endpoint?: string;
  statusCode?: number;
  duration?: number;
  ip?: string;
  userId?: string | number;
  device?: string;
  userAgent?: string;
  requestSize?: number;
  responseSize?: number;
  message?: string;
  stack?: string;
  socketId?: string;
  retryCount?: number;
  memoryUsage?: any;
  cpuUsage?: any;
  [key: string]: any; // Allow other properties
}

class LogStreamService extends EventEmitter {
  private clients: Set<Response> = new Set();
  private maxStoredLogs = 1000;
  private recentLogs: LogEvent[] = [];

  constructor() {
    super();
    // Prevent MaxListenersExceededWarning
    this.setMaxListeners(100);

    // Listen to self to broadcast to SSE
    this.on('log', (event: LogEvent) => {
      const sanitizedEvent = this.sanitize(event);
      
      // Store in memory for initial load
      this.recentLogs.push(sanitizedEvent);
      if (this.recentLogs.length > this.maxStoredLogs) {
        this.recentLogs.shift();
      }

      this.broadcastToClients(sanitizedEvent);
    });
  }

  /**
   * Add a new SSE client
   */
  public addClient(res: Response) {
    this.clients.add(res);

    // Send recent logs to new client
    this.recentLogs.forEach(log => {
      res.write(`data: ${JSON.stringify(log)}\n\n`);
    });

    res.on('close', () => {
      this.removeClient(res);
    });
  }

  /**
   * Remove an SSE client
   */
  public removeClient(res: Response) {
    this.clients.delete(res);
  }

  /**
   * Broadcast structured log event
   */
  public emitLog(event: Omit<LogEvent, 'id' | 'timestamp'>) {
    const fullEvent = {
      id: Math.random().toString(36).substring(2, 15),
      timestamp: new Date().toISOString(),
      ...event
    } as LogEvent;
    this.emit('log', fullEvent);
  }

  /**
   * Broadcast raw JSON string to SSE clients
   */
  private broadcastToClients(event: LogEvent) {
    if (this.clients.size === 0) return;
    const dataString = `data: ${JSON.stringify(event)}\n\n`;
    this.clients.forEach(client => {
      try {
        client.write(dataString);
      } catch (err) {
        this.removeClient(client);
      }
    });
  }

  /**
   * Security: Redact sensitive information
   */
  private sanitize(event: LogEvent): LogEvent {
    const sensitiveKeys = [
      'password', 'password_hash', 'token', 'secret',
      'authorization', 'cookie', 'jwt', 'refresh_token',
      'reset_token', 'api_key', 'private_key',
    ];

    const redact = (obj: any): any => {
      if (typeof obj !== 'object' || obj === null) return obj;
      if (Array.isArray(obj)) return obj.map(redact);
      
      const redacted: any = {};
      for (const [key, value] of Object.entries(obj)) {
        const lowerKey = key.toLowerCase();
        if (sensitiveKeys.some(sk => lowerKey.includes(sk))) {
          redacted[key] = '[REDACTED]';
        } else if (typeof value === 'object') {
          redacted[key] = redact(value);
        } else {
          redacted[key] = value;
        }
      }
      return redacted;
    };

    return redact(event);
  }
  
  public getActiveClientCount(): number {
    return this.clients.size;
  }
}

export const logStream = new LogStreamService();
