'use client';

import { useEffect, useCallback, useRef } from 'react';
import { useAuthStore, useNotificationStore } from '@/lib/store';
import { authAPI } from '@/lib/api';
import Cookies from 'js-cookie';
import { initSocket, disconnectSocket, getSocket } from '@/lib/socket';
import toast from 'react-hot-toast';

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const { user, setUser, setLoading, logout } = useAuthStore();

  // Use refs to track our specific handler functions for safe cleanup
  const notificationHandlerRef = useRef<((notification: any) => void) | null>(null);
  const chatHandlerRef = useRef<((msg: any) => void) | null>(null);

  useEffect(() => {
    const initAuth = async () => {
      const token = Cookies.get('access_token');
      if (!token) {
        setLoading(false);
        return;
      }

      // If user is already set in the global state, bypass blocking loading
      if (user) {
        setLoading(false);
        // Sync profile silently in the background
        authAPI.getProfile()
          .then((res) => setUser(res.data.data))
          .catch(() => {});
        return;
      }

      try {
        const res = await authAPI.getProfile();
        setUser(res.data.data);
      } catch {
        logout();
      } finally {
        setLoading(false);
      }
    };

    initAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Global Real-Time Socket Notifications & Chats
  useEffect(() => {
    if (!user) {
      disconnectSocket();
      return;
    }

    const socket = initSocket();
    if (socket) {
      // Remove previous handler references if they exist (prevent duplicates on re-render)
      if (notificationHandlerRef.current) {
        socket.off('notification:new', notificationHandlerRef.current);
      }
      if (chatHandlerRef.current) {
        socket.off('chat:message', chatHandlerRef.current);
      }

      // 1. Listen to new system-wide notifications (reminders, borrowing events, returns, etc.)
      const handleNotification = (notification: any) => {
        console.log('[Socket] Global notification:', notification);
        
        // Increment global unread count
        useNotificationStore.getState().incrementUnread();

        const title = notification.notification_title || notification.title || 'Pemberitahuan';
        const message = notification.notification_message || notification.message || '';
        
        toast((t) => (
          <div className="flex flex-col gap-0.5">
            <span className="font-bold text-sm text-foreground">{title}</span>
            <span className="text-xs text-muted-foreground">{message}</span>
          </div>
        ), { icon: '🔔' });
      };

      // 2. Listen to incoming chat messages globally
      const handleChatMessage = (msg: any) => {
        console.log('[Socket] Global chat message:', msg);
        
        // Skip if message was sent by self
        if (msg.sender_id === user.user_id) return;

        // Skip if user is actively on the chat page (the chat page has its own message listeners)
        const isChatPage = window.location.pathname.startsWith('/dashboard/chat');
        if (isChatPage) return;

        const senderName = msg.sender?.full_name || 'Seseorang';
        const text = msg.message_text || '';

        toast((t) => (
          <div className="flex flex-col gap-0.5">
            <span className="font-bold text-sm text-foreground">Pesan Baru dari {senderName}</span>
            <span className="text-xs text-muted-foreground truncate max-w-[200px]">{text}</span>
          </div>
        ), { icon: '💬' });
      };

      // Store refs for cleanup
      notificationHandlerRef.current = handleNotification;
      chatHandlerRef.current = handleChatMessage;

      // Register handlers using specific function references
      socket.on('notification:new', handleNotification);
      socket.on('chat:message', handleChatMessage);
    }

    return () => {
      const socket = getSocket();
      if (socket) {
        // Remove ONLY our specific handler references, not all listeners
        if (notificationHandlerRef.current) {
          socket.off('notification:new', notificationHandlerRef.current);
          notificationHandlerRef.current = null;
        }
        if (chatHandlerRef.current) {
          socket.off('chat:message', chatHandlerRef.current);
          chatHandlerRef.current = null;
        }
      }
    };
  }, [user]);

  return <>{children}</>;
}
