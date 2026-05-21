import React, { useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';
import { useAuthStore } from '../store/authStore';
import { useNotificationStore } from '../store/notificationStore';
import { initSocket, getSocket } from '../services/socket';
import { registerForPushNotificationsAsync, triggerLocalNotification } from '../services/notificationService';

export default function SocketNotificationListener() {
  const { isAuthenticated, user } = useAuthStore();
  const { fetchUnreadCount, incrementUnreadCount } = useNotificationStore();

  useEffect(() => {
    if (!isAuthenticated || !user) return;

    let isMounted = true;
    let socket: any = null;

    const setup = async () => {
      // 1. Request OS notification permission and configure Android channels
      const permissionGranted = await registerForPushNotificationsAsync();
      console.log('[SocketNotificationListener] Android notifications permission:', permissionGranted);

      // 2. Fetch the initial backend notification badge count
      await fetchUnreadCount();

      // 3. Load token and initialize the global WebSocket
      try {
        const token = await SecureStore.getItemAsync('access_token');
        if (!token || !isMounted) return;

        socket = initSocket(token);
        if (socket) {
          // Listen to new system-wide notifications (borrowing updates, penalties, reminders, etc.)
          socket.off('notification:new'); // prevent duplicates
          socket.on('notification:new', (notification: any) => {
            console.log('[SocketNotificationListener] New notification received:', notification);
            
            // Increment UI Badge
            incrementUnreadCount();

            // Push Android Tray Notification
            const title = notification.notification_title || notification.title || 'Pemberitahuan Baru';
            const body = notification.notification_message || notification.message || 'Ada pembaruan sistem untuk Anda.';
            triggerLocalNotification(title, body, { type: 'notification', id: notification.notification_id });

          });

          // Listen to incoming chat messages globally
          socket.off('chat:message'); // prevent duplicates
          socket.on('chat:message', (message: any) => {
            console.log('[SocketNotificationListener] Global chat message received:', message);

            // Skip if the message was sent by the current user
            if (message.sender_id === user.user_id) return;

            // Skip if the user is already inside the active chat room for this message thread
            const { activeConversationId } = useNotificationStore.getState();
            if (message.conversation_id === activeConversationId) {
              console.log('[SocketNotificationListener] Message is in active conversation room, silencing push.');
              return;
            }

            // Increment UI Badge (chat message is also treated as a system notification update)
            useNotificationStore.getState().incrementChatUnreadCount();

            // Push Android Tray Notification
            const senderName = message.sender?.full_name || 'Admin';
            const text = message.message_text || 'Mengirim pesan kepada Anda.';
            triggerLocalNotification(`Pesan dari ${senderName}`, text, { type: 'chat', conversation_id: message.conversation_id });
          });
        }
      } catch (err) {
        console.warn('[SocketNotificationListener] Failed to initialize socket connection:', err);
      }
    };

    setup();

    return () => {
      isMounted = false;
      if (socket) {
        socket.off('notification:new');
        socket.off('chat:message');
      }
    };
  }, [isAuthenticated, user]);

  // This is a headless listener component, it does not render anything.
  return null;
}
