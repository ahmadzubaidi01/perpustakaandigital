import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import env from '../config/environment';
import logger from '../utils/logger';

/**
 * Socket.IO real-time service.
 * Provides real-time chat messaging, typing indicators, and notification push.
 */

let io: SocketIOServer | null = null;

// Track online users: userId -> Set of socketIds
const onlineUsers = new Map<number, Set<string>>();

/**
 * Initialize Socket.IO server attached to Express HTTP server.
 */
const initSocketService = (httpServer: HttpServer): SocketIOServer => {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: env.CORS_ORIGINS,
      credentials: true,
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // JWT authentication middleware for socket connections
  io.use((socket: Socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (!token) {
      return next(new Error('Authentication token required'));
    }

    try {
      const decoded = jwt.verify(token as string, env.JWT_ACCESS_SECRET) as any;
      (socket as any).userId = decoded.user_id;
      (socket as any).userRole = decoded.user_role;
      next();
    } catch {
      next(new Error('Invalid or expired token'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const userId = (socket as any).userId as number;
    const userRole = (socket as any).userRole as string;

    // Track online status
    if (!onlineUsers.has(userId)) {
      onlineUsers.set(userId, new Set());
    }
    onlineUsers.get(userId)!.add(socket.id);

    // Join user-specific room for targeted messaging
    socket.join(`user:${userId}`);

    // Broadcast online status
    io!.emit('user:online', {
      user_id: userId,
      online: true,
      online_users: Array.from(onlineUsers.keys()),
    });

    logger.info('Socket connected', { userId, socketId: socket.id });

    // Handle typing indicators
    socket.on('chat:typing', (data: { conversation_id: number; typing: boolean }) => {
      socket.to(`conversation:${data.conversation_id}`).emit('chat:typing', {
        user_id: userId,
        conversation_id: data.conversation_id,
        typing: data.typing,
      });
    });

    // Handle joining conversation rooms
    socket.on('chat:join', (data: { conversation_id: number }) => {
      socket.join(`conversation:${data.conversation_id}`);
    });

    // Handle leaving conversation rooms
    socket.on('chat:leave', (data: { conversation_id: number }) => {
      socket.leave(`conversation:${data.conversation_id}`);
    });

    // Handle read receipts
    socket.on('chat:read', (data: { conversation_id: number }) => {
      socket.to(`conversation:${data.conversation_id}`).emit('chat:read', {
        user_id: userId,
        conversation_id: data.conversation_id,
      });
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      const userSockets = onlineUsers.get(userId);
      if (userSockets) {
        userSockets.delete(socket.id);
        if (userSockets.size === 0) {
          onlineUsers.delete(userId);
          // Broadcast offline status
          io!.emit('user:online', {
            user_id: userId,
            online: false,
            online_users: Array.from(onlineUsers.keys()),
          });
        }
      }
      logger.info('Socket disconnected', { userId, socketId: socket.id });
    });
  });

  logger.info('Socket.IO server initialized');
  return io;
};

/**
 * Get the Socket.IO server instance.
 */
const getIO = (): SocketIOServer | null => io;

/**
 * Emit a chat message to a specific conversation room and recipient.
 */
const emitChatMessage = (conversationId: number, recipientId: number, message: any): void => {
  if (!io) return;
  io.to(`conversation:${conversationId}`).emit('chat:message', message);
  // Also emit to recipient's user room in case they haven't joined the conversation room
  io.to(`user:${recipientId}`).emit('chat:message', message);
};

/**
 * Emit a notification to a specific user.
 */
const emitNotification = (userId: number, notification: any): void => {
  if (!io) return;
  io.to(`user:${userId}`).emit('notification:new', notification);
};

/**
 * Check if a user is currently online.
 */
const isUserOnline = (userId: number): boolean => {
  return onlineUsers.has(userId) && onlineUsers.get(userId)!.size > 0;
};

/**
 * Get list of online user IDs.
 */
const getOnlineUserIds = (): number[] => {
  return Array.from(onlineUsers.keys());
};

export {
  initSocketService,
  getIO,
  emitChatMessage,
  emitNotification,
  isUserOnline,
  getOnlineUserIds,
};
