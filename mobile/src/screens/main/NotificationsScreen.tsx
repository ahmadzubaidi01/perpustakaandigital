import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, FontSize, BorderRadius } from '../../constants/theme';
import { notificationsAPI } from '../../services/api';

export default function NotificationsScreen() {
  const [notifs, setNotifs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetch = async () => {
    try { const res = await notificationsAPI.list({ limit: 50 }); setNotifs(res.data.data || []); }
    catch {} finally { setLoading(false); setRefreshing(false); }
  };

  useEffect(() => { fetch(); }, []);

  const markRead = async (id: number) => {
    try { await notificationsAPI.markRead(id); fetch(); } catch {}
  };

  const typeColor = (t: string) => ({
    due_reminder: Colors.warning500, late_warning: Colors.danger500,
    availability_notice: Colors.success500, system_alert: Colors.primary400,
  }[t] || Colors.info500);

  const renderItem = ({ item }: any) => (
    <TouchableOpacity style={[s.card, !item.is_read && s.unread]} onPress={() => !item.is_read && markRead(item.notification_id)} activeOpacity={0.7}>
      <View style={[s.dot, { backgroundColor: typeColor(item.notification_type) }]} />
      <View style={{ flex: 1 }}>
        <Text style={s.title} numberOfLines={1}>{item.notification_title}</Text>
        <Text style={s.msg} numberOfLines={2}>{item.notification_message}</Text>
        <Text style={s.time}>{new Date(item.created_at).toLocaleString('id-ID')}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={s.container}>
      <FlatList data={notifs} renderItem={renderItem} keyExtractor={(i) => String(i.notification_id)}
        contentContainerStyle={s.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetch(); }} tintColor={Colors.primary400} />}
        ListEmptyComponent={!loading ? <View style={s.empty}><Ionicons name="notifications-off-outline" size={48} color={Colors.surface500} /><Text style={s.emptyT}>Tidak ada notifikasi</Text></View> : null}
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surface900 },
  list: { padding: Spacing.lg },
  card: { flexDirection: 'row', gap: Spacing.md, backgroundColor: Colors.surface800, borderRadius: BorderRadius.lg, padding: Spacing.md, marginBottom: Spacing.sm, borderWidth: 1, borderColor: Colors.surface600 },
  unread: { borderLeftWidth: 3, borderLeftColor: Colors.primary500 },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
  title: { fontSize: FontSize.md, fontWeight: '700', color: Colors.white },
  msg: { fontSize: FontSize.sm, color: Colors.surface300, marginTop: 2 },
  time: { fontSize: FontSize.xs, color: Colors.surface400, marginTop: Spacing.sm },
  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyT: { fontSize: FontSize.md, color: Colors.surface400, marginTop: Spacing.md },
});
