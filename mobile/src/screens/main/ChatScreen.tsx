import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Modal, TextInput, ActivityIndicator, Platform, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Spacing, FontSize, BorderRadius } from '../../constants/theme';
import { chatAPI } from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import { getSocket, initSocket } from '../../services/socket';
import { useTheme } from '../../context/ThemeContext';
import * as SecureStore from 'expo-secure-store';

export default function ChatScreen({ navigation }: any) {
  const { user } = useAuthStore();
  const { colors } = useTheme();
  const s = getStyles(colors);

  const [conversations, setConversations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<number[]>([]);

  // Modal recipient states
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [recipients, setRecipients] = useState<any[]>([]);
  const [filteredRecipients, setFilteredRecipients] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingRecipients, setLoadingRecipients] = useState(false);

  const fetchConversations = async () => {
    try {
      const res = await chatAPI.listConversations();
      setConversations(res.data.data || []);
    } catch (err) {
      console.warn('Failed to fetch conversations:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchRecipients = async () => {
    setLoadingRecipients(true);
    try {
      const res = await chatAPI.getRecipients();
      setRecipients(res.data.data || []);
      setFilteredRecipients(res.data.data || []);
    } catch (err) {
      console.warn('Failed to fetch eligible recipients:', err);
    } finally {
      setLoadingRecipients(false);
    }
  };

  useEffect(() => {
    fetchConversations();

    let socket = getSocket();
    const handleNewMessage = (msg: any) => {
      // Dynamic update conversation on list without full refresh
      setConversations((prev) => {
        const index = prev.findIndex((c) => c.conversation_id === msg.conversation_id);
        if (index > -1) {
          const updated = [...prev];
          updated[index] = {
            ...updated[index],
            last_message: msg,
            unread_count: msg.sender_id !== user?.user_id ? updated[index].unread_count + 1 : updated[index].unread_count,
            last_message_at: msg.created_at,
          };
          // Re-sort conversations by last_message_at DESC
          return updated.sort((a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime());
        } else {
          // If conversation is new, fetch list
          fetchConversations();
          return prev;
        }
      });
    };

    const handleUserOnline = (data: any) => {
      if (data.online_users) {
        setOnlineUsers(data.online_users);
      }
    };

    if (socket) {
      socket.on('chat:message', handleNewMessage);
      socket.on('user:online', handleUserOnline);
      // Request initial list of online users by emitting or socket status check
      socket.emit('user:online:request');
    } else {
      SecureStore.getItemAsync('access_token').then((token) => {
        if (token) {
          const newSocket = initSocket(token);
          if (newSocket) {
            newSocket.on('chat:message', handleNewMessage);
            newSocket.on('user:online', handleUserOnline);
          }
        }
      });
    }

    return () => {
      const socketInstance = getSocket();
      if (socketInstance) {
        socketInstance.off('chat:message', handleNewMessage);
        socketInstance.off('user:online', handleUserOnline);
      }
    };
  }, [user]);

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredRecipients(recipients);
    } else {
      const q = searchQuery.toLowerCase();
      setFilteredRecipients(
        recipients.filter(
          (r) =>
            r.full_name?.toLowerCase().includes(q) ||
            r.user_role?.toLowerCase().includes(q)
        )
      );
    }
  }, [searchQuery, recipients]);

  const handleStartChat = async (recipientId: number) => {
    setShowNewChatModal(false);
    setSearchQuery('');
    setLoading(true);
    try {
      const res = await chatAPI.startConversation(recipientId);
      const conversation = res.data.data;
      await fetchConversations();
      navigation.navigate('ChatRoom', { conversation });
    } catch (err: any) {
      Alert.alert('Gagal Memulai Chat', err.response?.data?.message || 'Terjadi kesalahan sistem');
    } finally {
      setLoading(false);
    }
  };

  const getOtherParticipant = (conv: any) => {
    if (conv.participant_1_id === user?.user_id) {
      return conv.participant_2;
    }
    return conv.participant_1;
  };

  const getRoleLabel = (u: any) => {
    if (!u) return '';
    const role = typeof u === 'string' ? u : u.user_role;
    const schoolName = typeof u === 'string' ? null : u.school?.school_name;
    const regencyName = typeof u === 'string' ? null : u.regency?.regency_name;
    const districtName = typeof u === 'string' ? null : u.district?.district_name;

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
      default: return role;
    }
  };

  const renderConversationItem = ({ item }: any) => {
    const other = getOtherParticipant(item);
    if (!other) return null;
    const isOnline = onlineUsers.includes(other.user_id);
    const lastMsg = item.last_message;

    return (
      <TouchableOpacity
        style={[s.convCard, item.unread_count > 0 && s.unreadCard]}
        onPress={() => navigation.navigate('ChatRoom', { conversation: item })}
        activeOpacity={0.8}
      >
        <View style={s.avatarWrapper}>
          <View style={s.avatar}>
            <Text style={s.avatarText}>{other.full_name?.charAt(0).toUpperCase()}</Text>
          </View>
          {isOnline && <View style={s.onlineDot} />}
        </View>

        <View style={{ flex: 1, gap: 2 }}>
          <View style={s.convHeader}>
            <Text style={s.participantName} numberOfLines={1}>{other.full_name}</Text>
            {item.last_message_at && (
              <Text style={s.timeText}>
                {new Date(item.last_message_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
              </Text>
            )}
          </View>

          <View style={s.roleTag}>
            <Text style={s.roleTagText}>{getRoleLabel(other)}</Text>
          </View>

          {lastMsg && (
            <Text style={[s.lastMessage, item.unread_count > 0 && s.unreadLastMessage]} numberOfLines={1}>
              {lastMsg.sender_id === user?.user_id ? 'Anda: ' : ''}{lastMsg.message_text}
            </Text>
          )}
        </View>

        {item.unread_count > 0 && (
          <View style={s.unreadBadge}>
            <Text style={s.unreadBadgeText}>{item.unread_count}</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Pesan Realtime</Text>
        <TouchableOpacity
          style={s.newChatBtn}
          onPress={() => {
            setShowNewChatModal(true);
            fetchRecipients();
          }}
        >
          <Ionicons name="chatbubble-ellipses-outline" size={22} color={colors.text} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={conversations}
        renderItem={renderConversationItem}
        keyExtractor={(item, idx) => `conversation-${item.conversation_id || idx}-${idx}`}
        contentContainerStyle={s.listContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetchConversations();
            }}
            tintColor={colors.primary400}
          />
        }
        ListEmptyComponent={
          !loading ? (
            <View style={s.emptyState}>
              <Ionicons name="chatbubbles-outline" size={64} color={colors.surface500} />
              <Text style={s.emptyTitle}>Belum ada percakapan</Text>
              <Text style={s.emptyDesc}>
                Hubungi administrator atau pengelola perpustakaan regional melalui tombol Pesan Baru di sudut kanan atas.
              </Text>
              <TouchableOpacity
                style={s.startBtn}
                onPress={() => {
                  setShowNewChatModal(true);
                  fetchRecipients();
                }}
              >
                <Text style={s.startBtnText}>Kirim Pesan Baru</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <ActivityIndicator color={colors.primary400} style={{ marginTop: 40 }} />
          )
        }
      />

      {/* Recipient Modal Selector */}
      <Modal visible={showNewChatModal} animationType="slide" transparent={false}>
        <SafeAreaView style={s.modalContainer}>
          <View style={s.modalHeader}>
            <TouchableOpacity style={s.closeBtn} onPress={() => setShowNewChatModal(false)}>
              <Ionicons name="close" size={26} color={colors.text} />
            </TouchableOpacity>
            <Text style={s.modalTitle}>Kirim Pesan Baru</Text>
            <View style={{ width: 40 }} />
          </View>

          <View style={s.searchContainer}>
            <Ionicons name="search-outline" size={18} color={colors.surface400} />
            <TextInput
              style={s.searchInput}
              placeholder="Cari admin berdasarkan nama atau peran..."
              placeholderTextColor={colors.surface400}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>

          {loadingRecipients ? (
            <ActivityIndicator color={colors.primary400} style={{ marginTop: 40 }} />
          ) : (
            <FlatList
              data={filteredRecipients}
              keyExtractor={(item, idx) => `chat-user-${item.user_id || idx}-${idx}`}
              contentContainerStyle={s.recipientList}
              renderItem={({ item }) => (
                <TouchableOpacity style={s.recipientCard} onPress={() => handleStartChat(item.user_id)}>
                  <View style={s.avatar}>
                    <Text style={s.avatarText}>{item.full_name?.charAt(0).toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={s.recipientName}>{item.full_name}</Text>
                    <View style={s.roleTag}>
                      <Text style={s.roleTagText}>{getRoleLabel(item)}</Text>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.surface400} />
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <View style={s.emptyState}>
                  <Ionicons name="people-outline" size={48} color={colors.surface500} />
                  <Text style={s.emptyTitle}>Admin tidak ditemukan</Text>
                  <Text style={s.emptyDesc}>Tidak ada admin lain dalam jangkauan hierarki Anda saat ini.</Text>
                </View>
              }
            />
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const getStyles = (colors: any) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.surface900 },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.lg,
      paddingVertical: Platform.OS === 'ios' ? Spacing.sm : Spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.surface600,
      backgroundColor: colors.surface800,
    },
    backBtn: { padding: Spacing.xs },
    headerTitle: { fontSize: FontSize.lg, fontWeight: '800', color: colors.text },
    newChatBtn: { padding: Spacing.xs },
    listContainer: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
    convCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
      backgroundColor: colors.surface800,
      borderRadius: BorderRadius.lg,
      padding: Spacing.md,
      marginBottom: Spacing.sm,
      borderWidth: 1,
      borderColor: colors.surface600,
    },
    unreadCard: {
      borderColor: colors.primary500,
      backgroundColor: colors.surface800,
    },
    avatarWrapper: { position: 'relative' },
    avatar: {
      width: 44,
      height: 44,
      borderRadius: BorderRadius.md,
      backgroundColor: colors.primary500,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarText: { color: colors.white, fontSize: FontSize.lg, fontWeight: '800' },
    onlineDot: {
      position: 'absolute',
      bottom: -2,
      right: -2,
      width: 12,
      height: 12,
      borderRadius: 6,
      backgroundColor: colors.success500,
      borderWidth: 2,
      borderColor: colors.surface800,
    },
    convHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    participantName: { fontSize: FontSize.md, fontWeight: '700', color: colors.text },
    timeText: { fontSize: FontSize.xs, color: colors.textMuted },
    roleTag: {
      alignSelf: 'flex-start',
      backgroundColor: colors.surface700,
      paddingHorizontal: Spacing.sm,
      paddingVertical: 2,
      borderRadius: BorderRadius.sm,
    },
    roleTagText: { fontSize: FontSize.xs, fontWeight: '700', color: colors.accent400 },
    lastMessage: { fontSize: FontSize.sm, color: colors.textMuted, marginTop: 4 },
    unreadLastMessage: { color: colors.text, fontWeight: '700' },
    unreadBadge: {
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: colors.danger500,
      alignItems: 'center',
      justifyContent: 'center',
    },
    unreadBadgeText: { fontSize: FontSize.xs, fontWeight: '800', color: colors.white },
    emptyState: { alignItems: 'center', paddingVertical: 80, paddingHorizontal: Spacing.xxl },
    emptyTitle: { fontSize: FontSize.lg, fontWeight: '800', color: colors.text, marginTop: Spacing.lg },
    emptyDesc: { fontSize: FontSize.sm, color: colors.textMuted, textAlign: 'center', marginTop: Spacing.sm, lineHeight: 20 },
    startBtn: { backgroundColor: colors.primary500, borderRadius: BorderRadius.md, paddingHorizontal: Spacing.xxl, paddingVertical: Spacing.md, marginTop: Spacing.xl },
    startBtnText: { color: colors.white, fontWeight: '700', fontSize: FontSize.md },
  
    // Modal selector styles
    modalContainer: { flex: 1, backgroundColor: colors.surface900 },
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.md,
      backgroundColor: colors.surface800,
      borderBottomWidth: 1,
      borderBottomColor: colors.surface600,
    },
    closeBtn: { padding: Spacing.xs },
    modalTitle: { fontSize: FontSize.lg, fontWeight: '800', color: colors.text },
    searchContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface800,
      borderRadius: BorderRadius.md,
      borderWidth: 1,
      borderColor: colors.surface600,
      margin: Spacing.lg,
      paddingHorizontal: Spacing.md,
    },
    searchInput: { flex: 1, height: 44, color: colors.text, fontSize: FontSize.md, marginLeft: Spacing.sm },
    recipientList: { paddingHorizontal: Spacing.lg, paddingBottom: 40 },
    recipientCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
      backgroundColor: colors.surface800,
      padding: Spacing.md,
      borderRadius: BorderRadius.lg,
      marginBottom: Spacing.sm,
      borderWidth: 1,
      borderColor: colors.surface600,
    },
    recipientName: { fontSize: FontSize.md, fontWeight: '700', color: colors.text },
  });
