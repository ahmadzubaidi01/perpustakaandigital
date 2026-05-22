import { create } from 'zustand';
import { notificationsAPI, chatAPI } from '../services/api';
import { useAuthStore } from './authStore';

interface NotificationState {
  unreadCount: number; // Total unread count (system + chat)
  systemUnreadCount: number; // System notifications count only
  chatUnreadCount: number; // Unread chats count only
  hasUnread: boolean;
  activeConversationId: number | null;
  setUnreadCount: (count: number) => void;
  setChatUnreadCount: (count: number) => void;
  incrementUnreadCount: () => void;
  incrementChatUnreadCount: () => void;
  clearUnread: () => void;
  fetchUnreadCount: () => Promise<void>;
  setActiveConversationId: (id: number | null) => void;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  unreadCount: 0,
  systemUnreadCount: 0,
  chatUnreadCount: 0,
  hasUnread: false,
  activeConversationId: null,

  setUnreadCount: (systemUnreadCount) => {
    const total = systemUnreadCount + get().chatUnreadCount;
    set({ systemUnreadCount, unreadCount: total, hasUnread: total > 0 });
  },

  setChatUnreadCount: (chatUnreadCount) => {
    const total = get().systemUnreadCount + chatUnreadCount;
    set({ chatUnreadCount, unreadCount: total, hasUnread: total > 0 });
  },
  
  incrementUnreadCount: () => {
    const newSystem = get().systemUnreadCount + 1;
    const total = newSystem + get().chatUnreadCount;
    set({ systemUnreadCount: newSystem, unreadCount: total, hasUnread: total > 0 });
  },

  incrementChatUnreadCount: () => {
    const newChat = get().chatUnreadCount + 1;
    const total = get().systemUnreadCount + newChat;
    set({ chatUnreadCount: newChat, unreadCount: total, hasUnread: total > 0 });
  },

  setActiveConversationId: (activeConversationId) => set({ activeConversationId }),

  clearUnread: async () => {
    try {
      await notificationsAPI.markAllRead();
    } catch (e) {
      console.warn('[NotificationStore] Failed to mark all read in backend:', e);
    }
    // Only clear system notifications
    const chatUnread = get().chatUnreadCount;
    set({ systemUnreadCount: 0, unreadCount: chatUnread, hasUnread: chatUnread > 0 });
  },

  fetchUnreadCount: async () => {
    try {
      // 1. Fetch system notifications
      const res = await notificationsAPI.list({ limit: 100 });
      const notifs = res.data?.data || [];
      const unreadSystem = notifs.filter((n: any) => !n.is_read).length;

      // 2. Fetch chat conversations and sum unread counts (skip for student accounts to avoid 403)
      let unreadChat = 0;
      const currentUser = useAuthStore.getState().user;
      const isStudent = currentUser?.user_role === 'student_member';

      if (!isStudent) {
        try {
          const chatRes = await chatAPI.listConversations();
          const conversations = chatRes.data?.data || [];
          unreadChat = conversations.reduce((sum: number, conv: any) => sum + (conv.unread_count || 0), 0);
        } catch (err) {
          console.warn('[NotificationStore] Failed to fetch chat conversations for count:', err);
        }
      }

      const total = unreadSystem + unreadChat;
      set({
        systemUnreadCount: unreadSystem,
        chatUnreadCount: unreadChat,
        unreadCount: total,
        hasUnread: total > 0
      });
    } catch (error) {
      console.warn('[NotificationStore] Failed to fetch notifications:', error);
    }
  },
}));
