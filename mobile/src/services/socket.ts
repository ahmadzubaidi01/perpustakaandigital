import { io, Socket } from 'socket.io-client';
import { API_BASE_URL } from '../constants/theme';
import { useSyncDiagnosticsStore } from '../store/syncDiagnosticsStore';

const SOCKET_URL = API_BASE_URL.replace('/api', '');

let socket: Socket | null = null;

/**
 * Initialize Socket.IO client with JWT authentication.
 */
export const initSocket = (token: string): Socket | null => {
  if (socket?.connected) return socket;

  if (!token) return null;

  socket = io(SOCKET_URL, {
    auth: { token },
    transports: ['polling', 'websocket'],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
  });

  socket.on('connect', () => {
    console.log('[Socket.IO] Connected:', socket?.id);
    useSyncDiagnosticsStore.getState().setWebsocketStability(true);
  });

  socket.on('disconnect', (reason) => {
    console.log('[Socket.IO] Disconnected:', reason);
    useSyncDiagnosticsStore.getState().incrementWebsocketDisconnects();
  });

  socket.on('connect_error', (error) => {
    console.warn('[Socket.IO] Connection error:', error.message);
    useSyncDiagnosticsStore.getState().setWebsocketStability(false);
  });

  return socket;
};

/**
 * Get the current socket instance.
 */
export const getSocket = (): Socket | null => socket;

/**
 * Disconnect the socket.
 */
export const disconnectSocket = (): void => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

/**
 * Join a conversation room for real-time updates.
 */
export const joinConversation = (conversationId: number): void => {
  socket?.emit('chat:join', { conversation_id: conversationId });
};

/**
 * Leave a conversation room.
 */
export const leaveConversation = (conversationId: number): void => {
  socket?.emit('chat:leave', { conversation_id: conversationId });
};

/**
 * Emit typing indicator.
 */
export const emitTyping = (conversationId: number, typing: boolean): void => {
  socket?.emit('chat:typing', { conversation_id: conversationId, typing });
};

/**
 * Emit read receipt.
 */
export const emitReadReceipt = (conversationId: number): void => {
  socket?.emit('chat:read', { conversation_id: conversationId });
};
