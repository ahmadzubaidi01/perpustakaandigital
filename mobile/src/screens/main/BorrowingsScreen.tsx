import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, ActivityIndicator, TextInput, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { borrowingsAPI } from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import { useTheme } from '../../context/ThemeContext';
import { checkOnlineStatus } from '../../services/syncService';
import { Spacing, FontSize, BorderRadius } from '../../constants/theme';

type FilterType = 'active' | 'history';

export default function BorrowingsScreen({ navigation }: any) {
  const { user } = useAuthStore();
  const { colors, isDark } = useTheme();
  const styles = getStyles(colors);
  const isAdmin = ['super_admin', 'regency_admin', 'district_admin', 'school_admin'].includes(user?.user_role || '');

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
    if (status === 'late') return { bg: colors.danger500 + '15', text: colors.danger500, label: 'Terlambat' };
    if (status === 'returned') return { bg: colors.success500 + '15', text: colors.success500, label: 'Dikembalikan' };
    return { bg: colors.primary500 + '15', text: colors.primary400, label: 'Aktif' };
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
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.bookInfo}>
            <Ionicons name="book" size={20} color={colors.primary400} />
            <View style={{ flex: 1 }}>
              <Text style={styles.bookTitle} numberOfLines={1}>{bookTitle}</Text>
              <Text style={styles.bookAuthor} numberOfLines={1}>{authorName}</Text>
            </View>
          </View>
          <View style={[styles.badge, { backgroundColor: badge.bg }]}>
            <Text style={[styles.badgeText, { color: badge.text }]}>{badge.label}</Text>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.cardBody}>
          {isAdmin && (
            <View style={styles.infoRow}>
              <Ionicons name="person-outline" size={14} color={colors.textMuted} />
              <Text style={styles.infoText}>Peminjam: <Text style={styles.boldText}>{studentName}</Text></Text>
            </View>
          )}
          <View style={styles.infoRow}>
            <Ionicons name="calendar-outline" size={14} color={colors.textMuted} />
            <Text style={styles.infoText}>Tenggat Pengembalian: <Text style={styles.boldText}>{dueDate}</Text></Text>
          </View>
          {item.returned_at && (
            <View style={styles.infoRow}>
              <Ionicons name="checkmark-done-outline" size={14} color={colors.textMuted} />
              <Text style={styles.infoText}>Dikembalikan Pada: <Text style={styles.boldText}>{new Date(item.returned_at).toLocaleDateString('id-ID')}</Text></Text>
            </View>
          )}
        </View>

        {status === 'borrowed' && (
          <TouchableOpacity style={styles.extendBtn} onPress={() => handleExtend(item.borrowing_id)}>
            <Ionicons name="time-outline" size={16} color={colors.white} />
            <Text style={styles.extendBtnText}>Perpanjang Pinjaman</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header back navigation */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backIcon} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Peminjaman</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Tabs Filter */}
      <View style={styles.tabContainer}>
        <TouchableOpacity style={[styles.tabButton, filter === 'active' && styles.activeTabButton]} onPress={() => setFilter('active')}>
          <Text style={[styles.tabText, filter === 'active' && styles.activeTabText]}>Aktif / Dipinjam</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tabButton, filter === 'history' && styles.activeTabButton]} onPress={() => setFilter('history')}>
          <Text style={[styles.tabText, filter === 'history' && styles.activeTabText]}>Riwayat Selesai</Text>
        </TouchableOpacity>
      </View>

      {/* Admin Student Search */}
      {isAdmin && (
        <View style={styles.searchContainer}>
          <Ionicons name="search-outline" size={18} color={colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Cari berdasarkan nama siswa..."
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          ) : null}
        </View>
      )}

      {/* Offline Alert Banner */}
      {isOffline && (
        <View style={styles.offlineBanner}>
          <Ionicons name="cloud-offline-outline" size={16} color={colors.warning500} />
          <Text style={styles.offlineText}>Koneksi terputus. Silakan hubungkan internet untuk memuat data.</Text>
        </View>
      )}

      {loading ? (
        <View style={styles.loadingCenter}>
          <ActivityIndicator size="large" color={colors.primary400} />
          <Text style={styles.loadingText}>Memuat Log Peminjaman...</Text>
        </View>
      ) : (
        <FlatList
          data={borrowings}
          renderItem={renderItem}
          keyExtractor={(item, idx) => `borrowing-${item.borrowing_id || idx}-${idx}`}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary400} />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="hourglass-outline" size={48} color={colors.surface500} />
              <Text style={styles.emptyText}>Tidak ada transaksi peminjaman ditemukan</Text>
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
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.md, height: 56, backgroundColor: colors.surface800, borderBottomWidth: 1, borderBottomColor: colors.surface600 },
    backIcon: { padding: 4 },
    headerTitle: { fontSize: FontSize.lg, fontWeight: '700', color: colors.text },
    tabContainer: { flexDirection: 'row', backgroundColor: colors.surface800, padding: 6, marginHorizontal: Spacing.lg, marginTop: Spacing.lg, borderRadius: BorderRadius.lg, borderWidth: 1, borderColor: colors.surface600 },
    tabButton: { flex: 1, paddingVertical: Spacing.md, alignItems: 'center', borderRadius: BorderRadius.md },
    activeTabButton: { backgroundColor: colors.primary500 },
    tabText: { fontSize: FontSize.sm, fontWeight: '700', color: colors.textMuted },
    activeTabText: { color: colors.white },
    searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface800, marginHorizontal: Spacing.lg, marginTop: Spacing.md, borderRadius: BorderRadius.lg, paddingHorizontal: Spacing.md, height: 44, borderWidth: 1, borderColor: colors.surface600 },
    searchInput: { flex: 1, color: colors.text, fontSize: FontSize.sm, marginLeft: Spacing.sm },
    offlineBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, backgroundColor: colors.warning500 + '15', marginHorizontal: Spacing.lg, marginTop: Spacing.md, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: colors.warning500 + '30' },
    offlineText: { fontSize: FontSize.xs, fontWeight: '600', color: colors.warning500, textAlign: 'center', flex: 1 },
    loadingCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl },
    loadingText: { fontSize: FontSize.sm, color: colors.textMuted, marginTop: Spacing.md },
    list: { padding: Spacing.lg, paddingBottom: 30 },
    card: { backgroundColor: colors.surface800, borderRadius: BorderRadius.xl, padding: Spacing.lg, marginBottom: Spacing.md, borderWidth: 1, borderColor: colors.surface600 },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: Spacing.sm },
    bookInfo: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, flex: 1 },
    bookTitle: { fontSize: FontSize.md, fontWeight: '700', color: colors.text },
    bookAuthor: { fontSize: FontSize.xs, color: colors.textMuted, marginTop: 2 },
    badge: { paddingHorizontal: Spacing.md, paddingVertical: 4, borderRadius: BorderRadius.full },
    badgeText: { fontSize: FontSize.xs, fontWeight: '800' },
    divider: { height: 1, backgroundColor: colors.surface600, marginVertical: Spacing.md },
    cardBody: { gap: Spacing.sm },
    infoRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    infoText: { fontSize: FontSize.sm, color: colors.textMuted },
    boldText: { fontWeight: '700', color: colors.text },
    extendBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.xs, backgroundColor: colors.primary500, borderRadius: BorderRadius.md, paddingVertical: Spacing.md, marginTop: Spacing.lg },
    extendBtnText: { color: colors.white, fontSize: FontSize.sm, fontWeight: '700' },
    empty: { alignItems: 'center', paddingVertical: 80, gap: Spacing.md },
    emptyText: { fontSize: FontSize.md, color: colors.textMuted, textAlign: 'center' },
  });
