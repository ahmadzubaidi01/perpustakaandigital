import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Spacing, FontSize, BorderRadius } from '../../constants/theme';
import { chatAPI } from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import { useNotificationStore } from '../../store/notificationStore';
import { getSocket, joinConversation, leaveConversation, emitTyping, emitReadReceipt } from '../../services/socket';
import { useTheme } from '../../context/ThemeContext';

export default function ChatRoomScreen({ route, navigation }: any) {
  const { conversation } = route.params;
  const { user } = useAuthStore();
  const { colors } = useTheme();
  const s = getStyles(colors);

  const [messages, setMessages] = useState<any[]>([]);
  const [messageText, setMessageText] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [otherTyping, setOtherTyping] = useState(false);

  const typingTimeoutRef = useRef<any>(null);
  const isTypingStateRef = useRef(false);

  const otherParticipant = conversation.participant_1_id === user?.user_id
    ? conversation.participant_2
    : conversation.participant_1;

  const getRoleLabel = (u: any) => {
    if (!u) return '';
    const role = u.user_role;
    const schoolName = u.school?.school_name;
    const regencyName = u.regency?.regency_name;
    const districtName = u.district?.district_name;

    if (role === 'school_admin' && schoolName) {
      return `Admin ${schoolName}`;
    }
    if (role === 'regency_admin' && regencyName) {
      return `Admin ${regencyName}`;
    }
    if (role === 'district_admin' && districtName) {
      return `Admin Kecamatan ${districtName}`;
    }

    switch (role) {
      case 'super_admin': return 'Super Admin';
      case 'school_admin': return 'Admin Sekolah';
      case 'district_admin': return 'Admin Kecamatan';
      case 'regency_admin': return 'Admin Kabupaten';
      default: return 'Admin Perpustakaan';
    }
  };

  const fetchMessages = async (pageNum: number, isInitial = false) => {
    if (pageNum > 1 && !hasMore) return;
    if (loadingMore) return;

    if (pageNum > 1) {
      setLoadingMore(true);
    }

    try {
      const res = await chatAPI.getMessages(conversation.conversation_id, { page: pageNum, limit: 30 });
      const fetched = res.data.data || [];
      const meta = res.data.meta || {};

      setMessages((prev) => {
        if (isInitial) return fetched;
        const merged = [...prev];
        fetched.forEach((msg: any) => {
          if (!merged.some((m) => m.message_id === msg.message_id)) {
            merged.push(msg);
          }
        });
        return merged;
      });

      setHasMore(meta.has_next_page || false);
      setPage(pageNum);
    } catch (err) {
      console.warn('Failed to load chat messages:', err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const markAsRead = async () => {
    try {
      await chatAPI.markRead(conversation.conversation_id);
      emitReadReceipt(conversation.conversation_id);
    } catch (err) {
      console.warn('Failed to mark read:', err);
    }
  };

  useEffect(() => {
    // Set active conversation for notification suppression
    useNotificationStore.getState().setActiveConversationId(conversation.conversation_id);

    fetchMessages(1, true);

    const socket = getSocket();
    if (socket) {
      joinConversation(conversation.conversation_id);
      markAsRead();

      socket.on('chat:message', (msg: any) => {
        if (msg.conversation_id === conversation.conversation_id) {
          setMessages((prev) => {
            if (prev.some((m) => m.message_id === msg.message_id)) return prev;
            return [msg, ...prev];
          });
          markAsRead();
        }
      });

      socket.on('chat:typing', (data: any) => {
        if (data.conversation_id === conversation.conversation_id && data.user_id === otherParticipant?.user_id) {
          setOtherTyping(data.typing);
        }
      });

      socket.on('chat:read', (data: any) => {
        if (data.conversation_id === conversation.conversation_id && data.user_id === otherParticipant?.user_id) {
          setMessages((prev) =>
            prev.map((m) => (m.sender_id === user?.user_id ? { ...m, is_read: true } : m))
          );
        }
      });
    }

    return () => {
      // Clear active conversation
      useNotificationStore.getState().setActiveConversationId(null);

      if (socket) {
        leaveConversation(conversation.conversation_id);
        socket.off('chat:message');
        socket.off('chat:typing');
        socket.off('chat:read');
      }
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, [conversation]);

  const handleTextChange = (text: string) => {
    setMessageText(text);

    if (!isTypingStateRef.current && text.length > 0) {
      isTypingStateRef.current = true;
      emitTyping(conversation.conversation_id, true);
    } else if (text.length === 0 && isTypingStateRef.current) {
      isTypingStateRef.current = false;
      emitTyping(conversation.conversation_id, false);
    }

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      if (isTypingStateRef.current) {
        isTypingStateRef.current = false;
        emitTyping(conversation.conversation_id, false);
      }
    }, 3000);
  };

  const handleSend = async () => {
    if (!messageText.trim()) return;
    const textToSend = messageText.trim();
    setMessageText('');

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    isTypingStateRef.current = false;
    emitTyping(conversation.conversation_id, false);

    try {
      const res = await chatAPI.sendMessage(conversation.conversation_id, textToSend);
      const newMsg = res.data.data;
      setMessages((prev) => {
        if (prev.some((m) => m.message_id === newMsg.message_id)) return prev;
        return [newMsg, ...prev];
      });
    } catch (err: any) {
      console.warn('Send message failed:', err);
    }
  };

  const handleLoadMore = () => {
    if (hasMore && !loadingMore) {
      fetchMessages(page + 1);
    }
  };

  const renderMessageItem = ({ item }: any) => {
    const isMe = item.sender_id === user?.user_id;
    return (
      <View style={[s.messageRow, isMe ? s.myRow : s.otherRow]}>
        <View style={[s.bubble, isMe ? s.myBubble : s.otherBubble]}>
          <Text style={[s.messageText, isMe ? s.myMessageText : s.otherMessageText]}>{item.message_text}</Text>
          <View style={s.metaRow}>
            <Text style={[s.timeText, isMe ? s.myTimeText : s.otherTimeText]}>
              {new Date(item.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
            </Text>
            {isMe && (
              <Ionicons
                name={item.is_read ? 'checkmark-done' : 'checkmark'}
                size={14}
                color={item.is_read ? colors.primary400 : colors.white + '80'}
                style={{ marginLeft: 2 }}
              />
            )}
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: Spacing.sm }}>
          <Text style={s.participantName} numberOfLines={1}>{otherParticipant?.full_name}</Text>
          <Text style={s.activeRole}>
            {getRoleLabel(otherParticipant)}
          </Text>
        </View>
      </View>

      {/* Messages list */}
      <FlatList
        data={messages}
        renderItem={renderMessageItem}
        keyExtractor={(item, idx) => `message-${item.message_id || idx}-${idx}`}
        contentContainerStyle={s.list}
        inverted
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.2}
        ListFooterComponent={
          loadingMore ? (
            <ActivityIndicator color={colors.primary400} style={{ marginVertical: Spacing.md }} />
          ) : null
        }
        ListEmptyComponent={
          !loading ? (
            <View style={s.emptyState}>
              <Text style={s.emptyStateText}>Mulai percakapan. Kirim pesan pertama Anda!</Text>
            </View>
          ) : (
            <ActivityIndicator color={colors.primary400} style={{ marginTop: 40 }} />
          )
        }
      />

      {/* Typing indicator & Send form enclosed in KeyboardAvoidingView */}
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}>
        {otherTyping && (
          <View style={s.typingContainer}>
            <Text style={s.typingText}>{otherParticipant?.full_name} sedang mengetik...</Text>
          </View>
        )}

        <View style={s.inputBar}>
          <TextInput
            style={s.textInput}
            placeholder="Tulis pesan..."
            placeholderTextColor={colors.surface400}
            value={messageText}
            onChangeText={handleTextChange}
            multiline
            maxLength={1000}
          />
          <TouchableOpacity style={[s.sendBtn, !messageText.trim() && s.disabledSendBtn]} disabled={!messageText.trim()} onPress={handleSend}>
            <Ionicons name="send" size={20} color={colors.white} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const getStyles = (colors: any) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.surface900 },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: Spacing.lg,
      paddingVertical: Platform.OS === 'ios' ? Spacing.sm : Spacing.md,
      backgroundColor: colors.surface800,
      borderBottomWidth: 1,
      borderBottomColor: colors.surface600,
    },
    backBtn: { padding: Spacing.xs },
    participantName: { fontSize: FontSize.md, fontWeight: '800', color: colors.text },
    activeRole: { fontSize: FontSize.xs, color: colors.accent400, fontWeight: '600', marginTop: 1 },
    list: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
    messageRow: { flexDirection: 'row', marginBottom: Spacing.sm, width: '100%' },
    myRow: { justifyContent: 'flex-end' },
    otherRow: { justifyContent: 'flex-start' },
    bubble: {
      maxWidth: '75%',
      borderRadius: BorderRadius.lg,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      gap: 4,
    },
    myBubble: {
      backgroundColor: colors.primary500,
      borderTopRightRadius: 2,
      borderWidth: 1,
      borderColor: colors.primary400,
    },
    otherBubble: {
      backgroundColor: colors.surface800,
      borderTopLeftRadius: 2,
      borderWidth: 1,
      borderColor: colors.surface600,
    },
    messageText: { fontSize: FontSize.md, lineHeight: 20 },
    myMessageText: { color: colors.white },
    otherMessageText: { color: colors.text },
    metaRow: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-end', marginTop: 2 },
    timeText: { fontSize: FontSize.xs },
    myTimeText: { color: colors.white + 'B0' },
    otherTimeText: { color: colors.textMuted },
    emptyState: { paddingVertical: 80, alignItems: 'center' },
    emptyStateText: { fontSize: FontSize.sm, color: colors.textMuted },
    typingContainer: {
      paddingHorizontal: Spacing.xl,
      paddingVertical: Spacing.xs,
      backgroundColor: 'transparent',
    },
    typingText: { fontSize: FontSize.xs, color: colors.accent400, fontStyle: 'italic', fontWeight: '600' },
    inputBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      backgroundColor: colors.surface800,
      borderTopWidth: 1,
      borderTopColor: colors.surface600,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
    },
    textInput: {
      flex: 1,
      backgroundColor: colors.surface900,
      borderRadius: BorderRadius.md,
      borderWidth: 1,
      borderColor: colors.surface600,
      color: colors.text,
      paddingHorizontal: Spacing.md,
      paddingVertical: Platform.OS === 'ios' ? 10 : 6,
      fontSize: FontSize.md,
      maxHeight: 100,
    },
    sendBtn: {
      width: 44,
      height: 44,
      borderRadius: BorderRadius.full,
      backgroundColor: colors.primary500,
      alignItems: 'center',
      justifyContent: 'center',
    },
    disabledSendBtn: { opacity: 0.5, backgroundColor: colors.surface600 },
  });
