import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, ActivityIndicator, TextInput, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, FontSize, BorderRadius } from '../../constants/theme';
import { borrowingsAPI } from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import { checkOnlineStatus } from '../../services/syncService';

type FilterType = 'active' | 'history';

export default function BorrowingsScreen({ navigation }: any) {
  const { user } = useAuthStore();
  const isAdmin = user?.user_role === 'school_admin' || user?.user_role === 'super_admin';

  const [borrowings, setBorrowings] = useState<any[]>([]);
  const [filter, setFilter] = useState<FilterType>('active');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isOffline, setIsOffline] = useState(false);

  const fetchBorrowings = useCallback(async () => {
    try {
      const online = await checkOnlineStatus();
      setIsOffline(!online);

      if (!online) {
        setLoading(false);
        setRefreshing(false);
        return;
      }

      const params: any = {
        limit: 50,
        sort_by: 'created_at',
        sort_order: 'DESC',
      };

      if (filter === 'active') {
        params.borrowing_status = 'borrowed';
      } else {
        params.borrowing_status = 'returned';
      }

      if (isAdmin && searchQuery.trim()) {
        params.search = searchQuery.trim();
      }

      const res = await borrowingsAPI.list(params);
      setBorrowings(res.data.data || []);
    } catch (err: any) {
      setIsOffline(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filter, searchQuery, isAdmin]);

  useEffect(() => {
    fetchBorrowings();
  }, [filter, searchQuery]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchBorrowings();
  };

  const handleExtend = async (borrowingId: number) => {
    Alert.alert('Perpanjang Pinjaman', 'Yakin ingin memperpanjang tenggat waktu peminjaman buku ini?', [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Perpanjang',
        onPress: async () => {
          try {
            const res = await borrowingsAPI.extend(borrowingId);
            Alert.alert('Berhasil', res.data.message || 'Peminjaman berhasil diperpanjang!');
            fetchBorrowings();
          } catch (err: any) {
            Alert.alert('Gagal', err.response?.data?.message || 'Gagal memperpanjang peminjaman.');
          }
        },
      },
    ]);
  };

  const getStatusStyle = (status: string) => {
    if (status === 'late') return { bg: Colors.danger500 + '15', text: Colors.danger500, label: 'Terlambat' };
    if (status === 'returned') return { bg: Colors.success500 + '15', text: Colors.success500, label: 'Dikembalikan' };
    return { bg: Colors.info500 + '15', text: Colors.info500, label: 'Aktif' };
  };

  const renderItem = ({ item }: { item: any }) => {
    const bookTitle = item.book_qr?.book?.book_title || 'Buku Tidak Diketahui';
    const authorName = item.book_qr?.book?.author_name || '';
    const studentName = item.student?.full_name || `NISN: ${item.student?.student_id_number || '-'}`;
    const dueDate = item.due_date ? new Date(item.due_date).toLocaleDateString('id-ID') : '-';
    
    // Determine status (check if overdue)
    let status = item.borrowing_status;
    if (status === 'borrowed' && item.due_date && new Date(item.due_date) < new Date()) {
      status = 'late';
    }
    const badge = getStatusStyle(status);

    return (
      <View style={s.card}>
        <View style={s.cardHeader}>
          <View style={s.bookInfo}>
            <Ionicons name="book" size={20} color={Colors.primary400} />
            <View style={{ flex: 1 }}>
              <Text style={s.bookTitle} numberOfLines={1}>{bookTitle}</Text>
              <Text style={s.bookAuthor} numberOfLines={1}>{authorName}</Text>
            </View>
          </View>
          <View style={[s.badge, { backgroundColor: badge.bg }]}>
            <Text style={[s.badgeText, { color: badge.text }]}>{badge.label}</Text>
          </View>
        </View>

        <View style={s.divider} />

        <View style={s.cardBody}>
          {isAdmin && (
            <View style={s.infoRow}>
              <Ionicons name="person-outline" size={14} color={Colors.surface400} />
              <Text style={s.infoText}>Peminjam: <Text style={s.boldText}>{studentName}</Text></Text>
            </View>
          )}
          <View style={s.infoRow}>
            <Ionicons name="calendar-outline" size={14} color={Colors.surface400} />
            <Text style={s.infoText}>Tenggat Pengembalian: <Text style={s.boldText}>{dueDate}</Text></Text>
          </View>
          {item.returned_at && (
            <View style={s.infoRow}>
              <Ionicons name="checkmark-done-outline" size={14} color={Colors.surface400} />
              <Text style={s.infoText}>Dikembalikan Pada: <Text style={s.boldText}>{new Date(item.returned_at).toLocaleDateString('id-ID')}</Text></Text>
            </View>
          )}
        </View>

        {status === 'borrowed' && (
          <TouchableOpacity style={s.extendBtn} onPress={() => handleExtend(item.borrowing_id)}>
            <Ionicons name="time-outline" size={16} color={Colors.white} />
            <Text style={s.extendBtnText}>Perpanjang Pinjaman</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <View style={s.container}>
      {/* Header back navigation */}
      <View style={s.header}>
        <TouchableOpacity style={s.backIcon} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={Colors.white} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Peminjaman</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Tabs Filter */}
      <View style={s.tabContainer}>
        <TouchableOpacity style={[s.tabButton, filter === 'active' && s.activeTabButton]} onPress={() => setFilter('active')}>
          <Text style={[s.tabText, filter === 'active' && s.activeTabText]}>Aktif / Dipinjam</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.tabButton, filter === 'history' && s.activeTabButton]} onPress={() => setFilter('history')}>
          <Text style={[s.tabText, filter === 'history' && s.activeTabText]}>Riwayat Selesai</Text>
        </TouchableOpacity>
      </View>

      {/* Admin Student Search */}
      {isAdmin && (
        <View style={s.searchContainer}>
          <Ionicons name="search-outline" size={18} color={Colors.surface400} />
          <TextInput
            style={s.searchInput}
            placeholder="Cari berdasarkan nama siswa..."
            placeholderTextColor={Colors.surface400}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color={Colors.surface400} />
            </TouchableOpacity>
          ) : null}
        </View>
      )}

      {/* Offline Alert Banner */}
      {isOffline && (
        <View style={s.offlineBanner}>
          <Ionicons name="cloud-offline-outline" size={16} color={Colors.warning500} />
          <Text style={s.offlineText}>Koneksi terputus. Silakan hubungkan internet untuk memuat data.</Text>
        </View>
      )}

      {loading ? (
        <View style={s.loadingCenter}>
          <ActivityIndicator size="large" color={Colors.primary400} />
          <Text style={s.loadingText}>Memuat Log Peminjaman...</Text>
        </View>
      ) : (
        <FlatList
          data={borrowings}
          renderItem={renderItem}
          keyExtractor={(item) => String(item.borrowing_id)}
          contentContainerStyle={s.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={Colors.primary400} />
          }
          ListEmptyComponent={
            <View style={s.empty}>
              <Ionicons name="hourglass-outline" size={48} color={Colors.surface500} />
              <Text style={s.emptyText}>Tidak ada transaksi peminjaman ditemukan</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surface900 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.md, height: 56, backgroundColor: Colors.surface800, borderBottomWidth: 1, borderBottomColor: Colors.surface600 },
  backIcon: { padding: 4 },
  headerTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.white },
  tabContainer: { flexDirection: 'row', backgroundColor: Colors.surface800, padding: 6, marginHorizontal: Spacing.lg, marginTop: Spacing.lg, borderRadius: BorderRadius.lg, borderWidth: 1, borderColor: Colors.surface600 },
  tabButton: { flex: 1, paddingVertical: Spacing.md, alignItems: 'center', borderRadius: BorderRadius.md },
  activeTabButton: { backgroundColor: Colors.primary500 },
  tabText: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.surface300 },
  activeTabText: { color: Colors.white },
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface700, marginHorizontal: Spacing.lg, marginTop: Spacing.md, borderRadius: BorderRadius.lg, paddingHorizontal: Spacing.md, height: 44, borderWidth: 1, borderColor: Colors.surface500 },
  searchInput: { flex: 1, color: Colors.text, fontSize: FontSize.sm, marginLeft: Spacing.sm },
  offlineBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, backgroundColor: Colors.warning500 + '15', marginHorizontal: Spacing.lg, marginTop: Spacing.md, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.warning500 + '30' },
  offlineText: { fontSize: FontSize.xs, fontWeight: '600', color: Colors.warning500, textAlign: 'center', flex: 1 },
  loadingCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl },
  loadingText: { fontSize: FontSize.sm, color: Colors.surface300, marginTop: Spacing.md },
  list: { padding: Spacing.lg, paddingBottom: 30 },
  card: { backgroundColor: Colors.surface800, borderRadius: BorderRadius.xl, padding: Spacing.lg, marginBottom: Spacing.md, borderWidth: 1, borderColor: Colors.surface600 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: Spacing.sm },
  bookInfo: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, flex: 1 },
  bookTitle: { fontSize: FontSize.md, fontWeight: '700', color: Colors.white },
  bookAuthor: { fontSize: FontSize.xs, color: Colors.surface300, marginTop: 2 },
  badge: { paddingHorizontal: Spacing.md, paddingVertical: 4, borderRadius: BorderRadius.full },
  badgeText: { fontSize: FontSize.xs, fontWeight: '800' },
  divider: { height: 1, backgroundColor: Colors.surface600, marginVertical: Spacing.md },
  cardBody: { gap: Spacing.sm },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  infoText: { fontSize: FontSize.sm, color: Colors.surface300 },
  boldText: { fontWeight: '700', color: Colors.white },
  extendBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.xs, backgroundColor: Colors.primary500, borderRadius: BorderRadius.md, paddingVertical: Spacing.md, marginTop: Spacing.lg },
  extendBtnText: { color: Colors.white, fontSize: FontSize.sm, fontWeight: '700' },
  empty: { alignItems: 'center', paddingVertical: 80, gap: Spacing.md },
  emptyText: { fontSize: FontSize.md, color: Colors.surface400, textAlign: 'center' },
});
