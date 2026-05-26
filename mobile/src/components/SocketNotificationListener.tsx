import React, { useEffect, useRef, useCallback } from 'react';
import * as SecureStore from 'expo-secure-store';
import { useAuthStore } from '../store/authStore';
import { useNotificationStore } from '../store/notificationStore';
import { initSocket, getSocket } from '../services/socket';
import { registerForPushNotificationsAsync, triggerLocalNotification } from '../services/notificationService';

export default function SocketNotificationListener() {
  const { isAuthenticated, user } = useAuthStore();
  const { fetchUnreadCount, incrementUnreadCount } = useNotificationStore();

  // Use refs for handlers so we can always reference the EXACT same function for off()
  const notificationHandlerRef = useRef<((notification: any) => void) | null>(null);
  const chatHandlerRef = useRef<((message: any) => void) | null>(null);

  // Create stable handler for notifications
  const handleNotification = useCallback((notification: any) => {
    console.log('[SocketNotificationListener] New notification received:', notification);
    
    // Increment UI Badge
    incrementUnreadCount();

    // Trigger global UI screens to refresh
    useNotificationStore.getState().triggerRefresh();

    // Push Android Tray Notification
    const title = notification.notification_title || notification.title || 'Pemberitahuan Baru';
    const body = notification.notification_message || notification.message || 'Ada pembaruan sistem untuk Anda.';
    triggerLocalNotification(title, body, { type: 'notification', id: notification.notification_id });
  }, [incrementUnreadCount]);

  // Create stable handler for chat messages
  const handleChatMessage = useCallback((message: any) => {
    console.log('[SocketNotificationListener] Global chat message received:', message);

    // Skip if the message was sent by the current user
    const currentUser = useAuthStore.getState().user;
    if (message.sender_id === currentUser?.user_id) return;

    // Skip if the user is already inside the active chat room for this message thread
    const { activeConversationId } = useNotificationStore.getState();
    if (message.conversation_id === activeConversationId) {
      console.log('[SocketNotificationListener] Message is in active conversation room, silencing push.');
      return;
    }

    // Increment UI Badge (chat message is also treated as a system notification update)
    useNotificationStore.getState().incrementChatUnreadCount();

    // Trigger refresh so ChatScreen conversation list updates in real-time
    useNotificationStore.getState().triggerRefresh();

    // Push Android Tray Notification
    const senderName = message.sender?.full_name || 'Admin';
    const text = message.message_text || 'Mengirim pesan kepada Anda.';
    triggerLocalNotification(`Pesan dari ${senderName}`, text, { type: 'chat', conversation_id: message.conversation_id });
  }, []);

  useEffect(() => {
    if (!isAuthenticated || !user) return;

    let isMounted = true;

    const setup = async () => {
      // 1. Load token and initialize the global WebSocket IMMEDIATELY
      try {
        const token = await SecureStore.getItemAsync('access_token');
        if (token && isMounted) {
          const socket = initSocket(token);
          if (socket) {
            // Remove previous handler references if they exist (prevent duplicates on re-mount)
            if (notificationHandlerRef.current) {
              socket.off('notification:new', notificationHandlerRef.current);
            }
            if (chatHandlerRef.current) {
              socket.off('chat:message', chatHandlerRef.current);
            }

            // Store new handler refs
            notificationHandlerRef.current = handleNotification;
            chatHandlerRef.current = handleChatMessage;

            // Register our handlers using stable references
            socket.on('notification:new', handleNotification);
            socket.on('chat:message', handleChatMessage);
          }
        }
      } catch (err) {
        console.warn('[SocketNotificationListener] Failed to initialize socket connection:', err);
      }

      // 2. Concurrently request OS notification permission & fetch the initial backend notification badge count
      Promise.all([
        registerForPushNotificationsAsync().then((permissionGranted) => {
          console.log('[SocketNotificationListener] Android notifications permission:', permissionGranted);
        }).catch((err) => {
          console.warn('[SocketNotificationListener] Failed to register push notifications:', err);
        }),
        fetchUnreadCount().catch((err) => {
          console.warn('[SocketNotificationListener] Failed to fetch initial unread count:', err);
        })
      ]);
    };

    setup();

    return () => {
      isMounted = false;
      const socket = getSocket();
      if (socket) {
        // Remove ONLY our specific handler references
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
  }, [isAuthenticated, user, handleNotification, handleChatMessage, fetchUnreadCount]);

  // This is a headless listener component, it does not render anything.
  return null;
}
