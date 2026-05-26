import { create } from 'zustand';
import Cookies from 'js-cookie';

export interface User {
  user_id: number;
  full_name: string;
  email_address: string;
  user_role: string;
  account_status: string;
  profile_photo_url: string | null;
  student_id_number: string | null;
  class_name: string | null;
  member_qr_uuid: string | null;
  phone_number: string | null;
  school_id: number | null;
  district_id: number | null;
  regency_id: number | null;
  school?: { school_id: number; school_name: string } | null;
  district?: { district_id: number; district_name: string } | null;
  regency?: { regency_id: number; regency_name: string } | null;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  login: (user: User, accessToken: string, refreshToken: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,

  setUser: (user) => set({ user, isAuthenticated: !!user }),
  setLoading: (isLoading) => set({ isLoading }),

  login: (user, accessToken, refreshToken) => {
    Cookies.set('access_token', accessToken, { sameSite: 'strict', expires: 365, path: '/' });
    Cookies.set('refresh_token', refreshToken, { sameSite: 'strict', expires: 365, path: '/' });
    set({ user, isAuthenticated: true, isLoading: false });
  },

  logout: () => {
    Cookies.remove('access_token', { path: '/' });
    Cookies.remove('refresh_token', { path: '/' });
    set({ user: null, isAuthenticated: false, isLoading: false });
  },
}));

// Sidebar state
interface SidebarState {
  isCollapsed: boolean;
  isMobileOpen: boolean;
  toggle: () => void;
  setMobileOpen: (open: boolean) => void;
}

export const useSidebarStore = create<SidebarState>((set) => ({
  isCollapsed: false,
  isMobileOpen: false,
  toggle: () => set((state) => ({ isCollapsed: !state.isCollapsed })),
  setMobileOpen: (isMobileOpen) => set({ isMobileOpen }),
}));

// Chat state
export interface ChatMessage {
  message_id: number;
  conversation_id: number;
  sender_id: number;
  message_text: string;
  is_read: boolean;
  created_at: string;
  sender?: {
    user_id: number;
    full_name: string;
    user_role: string;
    profile_photo_url: string | null;
  };
}

export interface ChatConversation {
  conversation_id: number;
  participant_1_id: number;
  participant_2_id: number;
  participant_1?: any;
  participant_2?: any;
  last_message_at: string | null;
  last_message?: ChatMessage | null;
  unread_count: number;
}

interface ChatState {
  conversations: ChatConversation[];
  activeConversationId: number | null;
  messages: ChatMessage[];
  unreadTotal: number;
  onlineUsers: number[];
  setConversations: (conversations: ChatConversation[]) => void;
  setActiveConversation: (id: number | null) => void;
  setMessages: (messages: ChatMessage[]) => void;
  addMessage: (message: ChatMessage) => void;
  setUnreadTotal: (count: number) => void;
  setOnlineUsers: (users: number[]) => void;
  markConversationRead: (conversationId: number) => void;
}

export const useChatStore = create<ChatState>((set) => ({
  conversations: [],
  activeConversationId: null,
  messages: [],
  unreadTotal: 0,
  onlineUsers: [],

  setConversations: (conversations) => {
    const total = conversations.reduce((sum, c) => sum + (c.unread_count || 0), 0);
    set({ conversations, unreadTotal: total });
  },
  setActiveConversation: (activeConversationId) => set({ activeConversationId }),
  setMessages: (messages) => set({ messages }),
  addMessage: (message) => set((state) => {
    if (message.conversation_id !== state.activeConversationId) {
      return {};
    }
    if (state.messages.some((m) => m.message_id === message.message_id)) {
      return {};
    }
    return {
      messages: [...state.messages, message],
    };
  }),
  setUnreadTotal: (unreadTotal) => set({ unreadTotal }),
  setOnlineUsers: (onlineUsers) => set({ onlineUsers }),
  markConversationRead: (conversationId) => set((state) => ({
    conversations: state.conversations.map((c) =>
      c.conversation_id === conversationId ? { ...c, unread_count: 0 } : c
    ),
    unreadTotal: state.conversations
      .filter((c) => c.conversation_id !== conversationId)
      .reduce((sum, c) => sum + (c.unread_count || 0), 0),
  })),
}));

// Notification State Store
interface NotificationState {
  unreadCount: number;
  setUnreadCount: (count: number) => void;
  incrementUnread: () => void;
  decrementUnread: () => void;
}

export const useNotificationStore = create<NotificationState>((set) => ({
  unreadCount: 0,
  setUnreadCount: (unreadCount) => set({ unreadCount }),
  incrementUnread: () => set((state) => ({ unreadCount: state.unreadCount + 1 })),
  decrementUnread: () => set((state) => ({ unreadCount: Math.max(0, state.unreadCount - 1) })),
}));

