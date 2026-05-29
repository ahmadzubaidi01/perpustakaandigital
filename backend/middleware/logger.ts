import { Request, Response, NextFunction } from 'express';
import { logStream } from '../services/logStream';

export const realtimeLogger = (req: Request, res: Response, next: NextFunction) => {
  const start = process.hrtime();

  res.on('finish', () => {
    const diff = process.hrtime(start);
    const duration = (diff[0] * 1e3 + diff[1] * 1e-6); // milliseconds
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    
    // Attempt to get response size
    const responseSize = Number(res.getHeader('content-length')) || 0;
    // Attempt to get request size
    const requestSize = Number(req.headers['content-length']) || 0;

    logStream.emitLog({
      type: 'REQUEST',
      method: req.method,
      endpoint: req.originalUrl,
      statusCode: res.statusCode,
      duration: Number(duration.toFixed(2)),
      ip,
      userId: (req as any).user?.user_id, // If auth middleware sets req.user
      device: req.headers['x-device-name'] as string || 'unknown',
      userAgent: req.headers['user-agent'] || 'unknown',
      requestSize,
      responseSize,
    });

    // Detect Slow Endpoints (> 2000ms)
    if (duration > 2000) {
      logStream.emitLog({
        type: 'WARNING',
        message: `Slow endpoint detected (${duration.toFixed(2)}ms)`,
        method: req.method,
        endpoint: req.originalUrl,
        duration: Number(duration.toFixed(2)),
        ip
      });
    }
  });

  next();
};
