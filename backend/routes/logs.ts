import { Router, Request, Response } from 'express';
import path from 'path';
import { logStream } from '../services/logStream';

const router = Router();

// Serve the Realtime Dashboard
router.get('/', (req: Request, res: Response) => {
  res.sendFile(path.resolve(__dirname, '../public/logs.html'));
});

// SSE Stream Endpoint
router.get('/stream', (req: Request, res: Response) => {
  // Set headers for SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Prevent Nginx buffering

  // Add client to log stream
  logStream.addClient(res);

  // Send an initial heartbeat to confirm connection
  res.write(`data: ${JSON.stringify({ type: 'SYSTEM', message: 'SSE Connection Established' })}\n\n`);

  // Keep connection alive
  const heartbeat = setInterval(() => {
    res.write(':\n\n');
  }, 15000);

  req.on('close', () => {
    clearInterval(heartbeat);
    logStream.removeClient(res);
  });
});

export default router;
