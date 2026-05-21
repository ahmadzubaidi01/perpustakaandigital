import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { notificationsAPI, chatAPI } from '../../services/api';
import { useTheme } from '../../context/ThemeContext';
import { useNotificationStore } from '../../store/notificationStore';
import { useAuthStore } from '../../store/authStore';
import { Spacing, FontSize, BorderRadius } from '../../constants/theme';

export default function NotificationsScreen({ navigation }: any) {
  const { colors, isDark } = useTheme();
  const styles = getStyles(colors);

  const [notifs, setNotifs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetch = async () => {
    try { 
      // 1. Fetch system notifications
      const res = await notificationsAPI.list({ limit: 50 }); 
      console.log('[NotificationsScreen] API Response data:', res.data);
      const systemNotifs = res.data?.data || [];

      // 2. Fetch chat conversations to list them as chat notifications
      let chatNotifs: any[] = [];
      try {
        const chatRes = await chatAPI.listConversations();
        const conversations = chatRes.data?.data || [];
        const currentUserId = useAuthStore.getState().user?.user_id;

        conversations.forEach((conv: any) => {
          if (conv.last_message) {
            const other = conv.participant_1_id === currentUserId
              ? conv.participant_2
              : conv.participant_1;
            
            if (other) {
              chatNotifs.push({
                notification_id: `chat-${conv.conversation_id}`,
                notification_title: `Pesan Baru dari ${other.full_name}`,
                notification_message: conv.last_message.message_text || 'Mengirim pesan.',
                notification_type: 'chat_incoming',
                is_read: conv.unread_count === 0,
                created_at: conv.last_message_at || conv.last_message.created_at || new Date().toISOString(),
                conversation: conv,
              });
            }
          }
        });
      } catch (chatError) {
        console.error('[NotificationsScreen] Fetch chats failed:', chatError);
      }

      // Combine and sort by created_at DESC
      const combined = [...systemNotifs, ...chatNotifs].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      setNotifs(combined); 
    } catch (error) {
      console.error('[NotificationsScreen] Fetch failed:', error);
    } finally { 
      setLoading(false); 
      setRefreshing(false); 
    }
  };


  useEffect(() => { 
    fetch(); 
    useNotificationStore.getState().clearUnread();
  }, []);

  const markRead = async (id: number) => {
    try { 
      await notificationsAPI.markRead(id); 
      fetch(); 
    } catch {}
  };

  const handlePressItem = async (item: any) => {
    if (item.notification_type === 'chat_incoming') {
      // Mark chat as read in store locally so badge decreases immediately
      const store = useNotificationStore.getState();
      const currentChatUnread = store.chatUnreadCount;
      const newChatUnread = Math.max(0, currentChatUnread - (item.conversation.unread_count || 1));
      store.setChatUnreadCount(newChatUnread);

      // Navigate to chat room
      navigation.navigate('ChatRoom', { conversation: item.conversation });
    } else {
      if (!item.is_read) {
        await markRead(item.notification_id);
      }
    }
  };

  const typeColor = (t: string) => ({
    due_reminder: colors.warning500, 
    late_warning: colors.danger500,
    availability_notice: colors.success500, 
    system_alert: colors.primary400,
    chat_incoming: colors.primary500,
  }[t] || colors.info500);

  const renderItem = ({ item }: any) => (
    <TouchableOpacity 
      style={[styles.card, !item.is_read && styles.unread]} 
      onPress={() => handlePressItem(item)} 
      activeOpacity={0.7}
    >
      <View style={[styles.dot, { backgroundColor: typeColor(item.notification_type) }]} />
      <View style={{ flex: 1 }}>
        <Text style={styles.title} numberOfLines={1}>{item.notification_title}</Text>
        <Text style={styles.msg} numberOfLines={2}>{item.notification_message}</Text>
        <Text style={styles.time}>{new Date(item.created_at).toLocaleString('id-ID')}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Notifikasi</Text>
      </View>
      {loading ? (
        <View style={styles.loadingCenter}>
          <ActivityIndicator size="large" color={colors.primary400} />
        </View>
      ) : (
        <FlatList 
          data={notifs} 
          renderItem={renderItem} 
          keyExtractor={(i, idx) => `notif-${i.notification_id || idx}-${idx}`}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetch(); }} tintColor={colors.primary400} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="notifications-off-outline" size={48} color={colors.surface500} />
              <Text style={styles.emptyT}>Tidak ada notifikasi</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const getStyles = (colors: any) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.surface900 },
    header: { height: 56, justifyContent: 'center', paddingHorizontal: Spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.surface600, backgroundColor: colors.surface800 },
    headerTitle: { fontSize: FontSize.lg, fontWeight: '800', color: colors.text },
    list: { padding: Spacing.lg },
    card: { flexDirection: 'row', gap: Spacing.md, backgroundColor: colors.surface800, borderRadius: BorderRadius.lg, padding: Spacing.md, marginBottom: Spacing.sm, borderWidth: 1, borderColor: colors.surface600 },
    unread: { borderLeftWidth: 3, borderLeftColor: colors.primary500 },
    dot: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
    title: { fontSize: FontSize.md, fontWeight: '700', color: colors.text },
    msg: { fontSize: FontSize.sm, color: colors.textMuted, marginTop: 2 },
    time: { fontSize: FontSize.xs, color: colors.textMuted, marginTop: Spacing.sm },
    loadingCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    empty: { alignItems: 'center', paddingVertical: 80, gap: Spacing.md },
    emptyT: { fontSize: FontSize.md, color: colors.textMuted },
  });
