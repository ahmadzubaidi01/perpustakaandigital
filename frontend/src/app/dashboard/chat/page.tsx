'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { MessageSquare, Send, Search, Plus, Loader2, UserCircle, Circle } from 'lucide-react';
import { chatAPI } from '@/lib/api';
import { useAuthStore, useChatStore, type ChatConversation, type ChatMessage } from '@/lib/store';
import { initSocket, getSocket, joinConversation, leaveConversation, emitTyping, emitReadReceipt } from '@/lib/socket';
import toast from 'react-hot-toast';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { PageHeader } from '@/components/ui/PageHeader';
import { Modal } from '@/components/ui/Modal';

const roleLabels: Record<string, string> = {
  super_admin: 'Super Admin',
  regency_admin: 'Admin Kabupaten',
  district_admin: 'Admin Kecamatan',
  school_admin: 'Admin Sekolah',
};

const roleColors: Record<string, string> = {
  super_admin: 'bg-purple-100 text-purple-700 dark:bg-purple-950/30 dark:text-purple-400',
  regency_admin: 'bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400',
  district_admin: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-950/30 dark:text-cyan-400',
  school_admin: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400',
};

export default function ChatPage() {
  const { user } = useAuthStore();
  const {
    conversations, setConversations, activeConversationId, setActiveConversation,
    messages, setMessages, addMessage, onlineUsers, setOnlineUsers, markConversationRead,
  } = useChatStore();

  const [loadingConvs, setLoadingConvs] = useState(true);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);
  const [searchConv, setSearchConv] = useState('');
  const [showNewChat, setShowNewChat] = useState(false);
  const [recipients, setRecipients] = useState<any[]>([]);
  const [loadingRecipients, setLoadingRecipients] = useState(false);
  const [recipientSearch, setRecipientSearch] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load conversations
  const loadConversations = useCallback(async () => {
    try {
      const res = await chatAPI.listConversations();
      setConversations(res.data.data || []);
    } catch { /* silent */ }
    finally { setLoadingConvs(false); }
  }, [setConversations]);

  useEffect(() => { loadConversations(); }, [loadConversations]);

  // Initialize socket
  useEffect(() => {
    const socket = initSocket();
    if (!socket) return;

    socket.on('chat:message', (msg: ChatMessage) => {
      addMessage(msg);
      // Refresh conversations to update last message
      loadConversations();
    });

    socket.on('user:online', (data: { online_users: number[] }) => {
      setOnlineUsers(data.online_users);
    });

    return () => {
      socket.off('chat:message');
      socket.off('user:online');
    };
  }, [addMessage, setOnlineUsers, loadConversations]);

  // Load messages when conversation changes
  useEffect(() => {
    if (!activeConversationId) { setMessages([]); return; }
    setLoadingMsgs(true);
    joinConversation(activeConversationId);
    chatAPI.getMessages(activeConversationId, { page: 1, limit: 100 })
      .then((res) => {
        setMessages((res.data.data || []).reverse());
        // Mark as read
        chatAPI.markRead(activeConversationId);
        emitReadReceipt(activeConversationId);
        markConversationRead(activeConversationId);
      })
      .catch(() => toast.error('Gagal memuat pesan'))
      .finally(() => setLoadingMsgs(false));

    return () => { leaveConversation(activeConversationId); };
  }, [activeConversationId, setMessages, markConversationRead]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Send message
  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageText.trim() || !activeConversationId) return;
    setSending(true);
    try {
      const res = await chatAPI.sendMessage(activeConversationId, messageText.trim());
      addMessage(res.data.data);
      setMessageText('');
      loadConversations();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Gagal mengirim pesan');
    } finally { setSending(false); }
  };

  // New conversation
  const handleNewChat = async (recipientId: number) => {
    try {
      const res = await chatAPI.startConversation(recipientId);
      const conv = res.data.data;
      setShowNewChat(false);
      setActiveConversation(conv.conversation_id);
      loadConversations();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Gagal memulai percakapan');
    }
  };

  const loadRecipients = async () => {
    setLoadingRecipients(true);
    try {
      const res = await chatAPI.getRecipients();
      setRecipients(res.data.data || []);
    } catch { toast.error('Gagal memuat daftar penerima'); }
    finally { setLoadingRecipients(false); }
  };

  useEffect(() => { if (showNewChat) loadRecipients(); }, [showNewChat]);

  // Helper to get the other participant
  const getOtherParticipant = (conv: ChatConversation) => {
    if (!user) return null;
    return conv.participant_1_id === user.user_id ? conv.participant_2 : conv.participant_1;
  };

  const activeConv = conversations.find((c) => c.conversation_id === activeConversationId);
  const otherUser = activeConv ? getOtherParticipant(activeConv) : null;

  // Filter conversations
  const filteredConversations = conversations.filter((c) => {
    if (!searchConv) return true;
    const other = getOtherParticipant(c);
    return other?.full_name?.toLowerCase().includes(searchConv.toLowerCase());
  });

  const filteredRecipients = recipients.filter((r) =>
    !recipientSearch || r.full_name?.toLowerCase().includes(recipientSearch.toLowerCase())
  );

  return (
    <div className="animate-fade-in">
      <PageHeader title="Chat Admin" description="Komunikasi real-time antar admin sesuai hierarki wilayah." />

      <div className="mt-6 flex bg-card border border-border rounded-2xl overflow-hidden shadow-sm" style={{ height: 'calc(100vh - 220px)', minHeight: '500px' }}>
        {/* Sidebar - Conversation List */}
        <div className="w-80 border-r border-border flex flex-col shrink-0 bg-card">
          <div className="p-3 border-b border-border space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-foreground">Percakapan</h3>
              <Button variant="outline" size="sm" onClick={() => setShowNewChat(true)} title="Pesan baru">
                <Plus size={14} />
              </Button>
            </div>
            <Input
              value={searchConv}
              onChange={(e) => setSearchConv(e.target.value)}
              placeholder="Cari percakapan..."
              leftIcon={<Search size={14} />}
            />
          </div>

          <div className="flex-1 overflow-y-auto">
            {loadingConvs ? (
              <div className="p-6 text-center"><Loader2 size={24} className="animate-spin text-primary mx-auto" /></div>
            ) : filteredConversations.length > 0 ? (
              filteredConversations.map((conv) => {
                const other = getOtherParticipant(conv);
                const isActive = activeConversationId === conv.conversation_id;
                const isOnline = other && onlineUsers.includes(other.user_id);
                return (
                  <button
                    key={conv.conversation_id}
                    onClick={() => setActiveConversation(conv.conversation_id)}
                    className={`w-full text-left px-4 py-3 border-b border-border transition-colors flex items-center gap-3 ${
                      isActive ? 'bg-primary/5 border-l-2 border-l-primary' : 'hover:bg-muted/40'
                    }`}
                  >
                    <div className="relative shrink-0">
                      <div className="w-10 h-10 rounded-xl bg-linear-to-br from-primary to-primary/80 text-primary-foreground flex items-center justify-center text-sm font-bold">
                        {other?.full_name?.charAt(0)?.toUpperCase() || '?'}
                      </div>
                      {isOnline && (
                        <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-card" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-foreground truncate">{other?.full_name || 'Unknown'}</p>
                        {conv.unread_count > 0 && (
                          <span className="ml-2 w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center shrink-0">
                            {conv.unread_count}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${roleColors[other?.user_role] || 'bg-muted text-muted-foreground'}`}>
                          {roleLabels[other?.user_role] || other?.user_role}
                        </span>
                      </div>
                      {conv.last_message && (
                        <p className="text-xs text-muted-foreground truncate mt-1">{conv.last_message.message_text}</p>
                      )}
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="p-6 text-center text-sm text-muted-foreground">
                <MessageSquare size={32} className="text-muted-foreground/40 mx-auto mb-2" />
                Belum ada percakapan
              </div>
            )}
          </div>
        </div>

        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col min-w-0">
          {activeConversationId && otherUser ? (
            <>
              {/* Chat Header */}
              <div className="px-5 py-3 border-b border-border flex items-center gap-3 shrink-0 bg-card">
                <div className="relative">
                  <div className="w-9 h-9 rounded-xl bg-linear-to-br from-primary to-primary/80 text-primary-foreground flex items-center justify-center text-sm font-bold">
                    {otherUser.full_name?.charAt(0)?.toUpperCase() || '?'}
                  </div>
                  {onlineUsers.includes(otherUser.user_id) && (
                    <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-card" />
                  )}
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground">{otherUser.full_name}</p>
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${roleColors[otherUser.user_role] || ''}`}>
                    {roleLabels[otherUser.user_role] || otherUser.user_role}
                  </span>
                </div>
                <div className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Circle size={8} className={onlineUsers.includes(otherUser.user_id) ? 'fill-emerald-500 text-emerald-500' : 'fill-gray-400 text-gray-400'} />
                  {onlineUsers.includes(otherUser.user_id) ? 'Online' : 'Offline'}
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
                {loadingMsgs ? (
                  <div className="text-center py-12"><Loader2 size={24} className="animate-spin text-primary mx-auto" /></div>
                ) : messages.length > 0 ? (
                  messages.map((msg) => {
                    const isMine = msg.sender_id === user?.user_id;
                    return (
                      <div key={msg.message_id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm ${
                          isMine
                            ? 'bg-primary text-primary-foreground rounded-br-md'
                            : 'bg-muted/60 text-foreground border border-border rounded-bl-md'
                        }`}>
                          <p className="whitespace-pre-wrap break-words">{msg.message_text}</p>
                          <p className={`text-[10px] mt-1 ${isMine ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                            {new Date(msg.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-12 text-sm text-muted-foreground">
                    <MessageSquare size={32} className="text-muted-foreground/30 mx-auto mb-2" />
                    Mulai percakapan dengan mengirim pesan.
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Message Input */}
              <div className="px-5 py-3 border-t border-border shrink-0 bg-card">
                <form onSubmit={handleSend} className="flex gap-2">
                  <Input
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    placeholder="Ketik pesan..."
                    containerClassName="flex-grow"
                    onFocus={() => activeConversationId && emitTyping(activeConversationId, true)}
                    onBlur={() => activeConversationId && emitTyping(activeConversationId, false)}
                  />
                  <Button type="submit" variant="primary" disabled={sending || !messageText.trim()} className="shrink-0">
                    {sending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                  </Button>
                </form>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-center">
              <div>
                <MessageSquare size={56} className="text-muted-foreground/20 mx-auto mb-4" />
                <p className="text-sm font-semibold text-foreground">Pilih Percakapan</p>
                <p className="text-xs text-muted-foreground mt-1">Pilih percakapan dari daftar di sebelah kiri,<br />atau mulai percakapan baru.</p>
                <Button variant="primary" size="sm" className="mt-4" onClick={() => setShowNewChat(true)} leftIcon={<Plus size={14} />}>
                  Pesan Baru
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* New Chat Modal */}
      <Modal isOpen={showNewChat} onClose={() => setShowNewChat(false)} title="Mulai Percakapan Baru" maxWidthClassName="max-w-md">
        <div className="space-y-4">
          <Input
            value={recipientSearch}
            onChange={(e) => setRecipientSearch(e.target.value)}
            placeholder="Cari admin..."
            leftIcon={<Search size={14} />}
          />
          <div className="max-h-80 overflow-y-auto border border-border rounded-xl divide-y divide-border">
            {loadingRecipients ? (
              <div className="p-6 text-center"><Loader2 size={24} className="animate-spin text-primary mx-auto" /></div>
            ) : filteredRecipients.length > 0 ? (
              filteredRecipients.map((r) => (
                <button
                  key={r.user_id}
                  type="button"
                  onClick={() => handleNewChat(r.user_id)}
                  className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-muted/40 transition-colors"
                >
                  <div className="w-9 h-9 rounded-xl bg-linear-to-br from-primary to-primary/80 text-primary-foreground flex items-center justify-center text-sm font-bold shrink-0">
                    {r.full_name?.charAt(0)?.toUpperCase() || '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{r.full_name}</p>
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${roleColors[r.user_role] || ''}`}>
                      {roleLabels[r.user_role] || r.user_role}
                    </span>
                  </div>
                </button>
              ))
            ) : (
              <div className="p-6 text-center text-sm text-muted-foreground">Tidak ada admin yang bisa dihubungi.</div>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}
