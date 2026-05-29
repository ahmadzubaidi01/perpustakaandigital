import { Request, Response, NextFunction } from 'express';
import { logStream } from '../services/logStream';

interface TrackData {
  count: number;
  lastTimestamp: number;
  firstTimestamp: number;
}

class RequestTracker {
  // Key: ip + endpoint
  private requestCounts = new Map<string, TrackData>();
  // Key: ip + method + url + bodyHash
  private duplicateTracker = new Map<string, number>();

  constructor() {
    // Prune stale entries every minute to prevent memory leaks
    setInterval(() => this.prune(), 60000);
  }

  private prune() {
    const now = Date.now();
    for (const [key, data] of this.requestCounts.entries()) {
      if (now - data.lastTimestamp > 60000) {
        this.requestCounts.delete(key);
      }
    }
    for (const [key, timestamp] of this.duplicateTracker.entries()) {
      if (now - timestamp > 5000) {
        this.duplicateTracker.delete(key);
      }
    }
  }

  private hashBody(body: any): string {
    if (!body || typeof body !== 'object') return '';
    try {
      return JSON.stringify(body);
    } catch {
      return '';
    }
  }

  public track = (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const endpoint = req.originalUrl.split('?')[0]; // Ignore query params for counting
    const now = Date.now();
    
    // 1. Duplicate Request Detection (Exact same request within 50ms)
    const reqSignature = `${ip}:${req.method}:${endpoint}:${this.hashBody(req.body)}`;
    const lastSeen = this.duplicateTracker.get(reqSignature);
    
    if (lastSeen && (now - lastSeen < 50)) {
      logStream.emitLog({
        type: 'WARNING',
        message: 'DUPLICATE REQUEST SPAM',
        ip,
        method: req.method,
        endpoint: req.originalUrl,
      });
    }
    this.duplicateTracker.set(reqSignature, now);

    // 2. Too Many Requests & Frontend Loop Detection
    const trackKey = `${ip}:${endpoint}`;
    const trackData = this.requestCounts.get(trackKey);

    if (trackData) {
      trackData.count += 1;
      const timeWindow = now - trackData.firstTimestamp;

      // 10 requests to same endpoint within 1 second -> POSSIBLE FRONTEND LOOP
      if (trackData.count >= 10 && timeWindow <= 1000) {
        logStream.emitLog({
          type: 'WARNING',
          message: 'POSSIBLE FRONTEND INFINITE LOOP',
          ip,
          method: req.method,
          endpoint: req.originalUrl,
          retryCount: trackData.count
        });
        // Reset to avoid spamming the log stream
        trackData.count = 0;
        trackData.firstTimestamp = now;
      }
      
      // 50 requests within 10 seconds -> TOO MANY REQUESTS DETECTED
      else if (trackData.count >= 50 && timeWindow <= 10000) {
        logStream.emitLog({
          type: 'WARNING',
          message: 'TOO MANY REQUESTS DETECTED',
          ip,
          method: req.method,
          endpoint: req.originalUrl,
          retryCount: trackData.count
        });
        trackData.count = 0;
        trackData.firstTimestamp = now;
      }

      trackData.lastTimestamp = now;
    } else {
      this.requestCounts.set(trackKey, {
        count: 1,
        firstTimestamp: now,
        lastTimestamp: now
      });
    }

    next();
  };
}

export const requestTracker = new RequestTracker();
export const trackRequestMiddleware = requestTracker.track;
