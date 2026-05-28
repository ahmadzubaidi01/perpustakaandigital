import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator } from 'react-native';
import { CachedImage } from '../../components/CachedImage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../store/authStore';
import { booksAPI, borrowingsAPI, dashboardAPI } from '../../services/api';
import { resolveImageUrl } from '../../utils/imageUtils';
import { checkOnlineStatus } from '../../services/syncService';
import { getCachedBooks, getCachedBorrowings } from '../../services/db';
import { useTheme } from '../../context/ThemeContext';
import { useNetwork } from '../../context/NetworkContext';
import { useNotificationStore } from '../../store/notificationStore';
import { Spacing, FontSize, BorderRadius } from '../../constants/theme';

export default function HomeScreen({ navigation }: any) {
  const { user } = useAuthStore();
  const { colors, isDark } = useTheme();
  const styles = getStyles(colors);
  const { refreshTrigger } = useNotificationStore();
  
  const [recentBooks, setRecentBooks] = useState<any[]>([]);
  const [activeBorrowings, setActiveBorrowings] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const { isOnline } = useNetwork();
  
  // Admin stats states
  const isAdmin = user?.user_role && user.user_role !== 'student_member';
  const [adminStats, setAdminStats] = useState<any>(null);
  const [loadingStats, setLoadingStats] = useState(false);

  const fetchAdminStats = async () => {
    if (!isAdmin) return;
    setLoadingStats(true);
    try {
      let res;
      switch (user?.user_role) {
        case 'super_admin':
          res = await dashboardAPI.superAdmin();
          break;
        case 'regency_admin':
          res = await dashboardAPI.regencyAdmin();
          break;
        case 'district_admin':
          res = await dashboardAPI.districtAdmin();
          break;
        case 'school_admin':
        default:
          res = await dashboardAPI.schoolAdmin();
          break;
      }
      setAdminStats(res?.data?.data || null);
    } catch (err) {
      setAdminStats(null);
    } finally {
      setLoadingStats(false);
    }
  };

  const getStatsItems = () => {
    if (!adminStats) return [];
    
    switch (user?.user_role) {
      case 'super_admin':
        return [
          { icon: 'book-outline', value: adminStats.total_books, label: 'Total Buku', color: colors.primary400 },
          { icon: 'business-outline', value: adminStats.total_schools, label: 'Total Sekolah', color: colors.accent500 },
          { icon: 'people-outline', value: adminStats.total_students, label: 'Total Siswa', color: colors.info500 },
          { icon: 'swap-horizontal-outline', value: adminStats.active_borrowings, label: 'Pinjaman Aktif', color: colors.success500 },
        ];
      case 'regency_admin':
        return [
          { icon: 'business-outline', value: adminStats.total_schools, label: 'Total Sekolah', color: colors.primary400 },
          { icon: 'map-outline', value: adminStats.total_districts, label: 'Kecamatan', color: colors.accent500 },
          { icon: 'book-outline', value: adminStats.total_books, label: 'Total Buku', color: colors.info500 },
          { icon: 'swap-horizontal-outline', value: adminStats.total_borrowings, label: 'Total Pinjaman', color: colors.success500 },
        ];
      case 'district_admin':
        return [
          { icon: 'business-outline', value: adminStats.total_schools, label: 'Total Sekolah', color: colors.primary400 },
          { icon: 'book-outline', value: adminStats.total_books, label: 'Total Buku', color: colors.info500 },
          { icon: 'swap-horizontal-outline', value: adminStats.total_borrowings, label: 'Total Pinjaman', color: colors.success500 },
        ];
      case 'school_admin':
      default:
        return [
          { icon: 'book-outline', value: adminStats.total_books, label: 'Total Buku', color: colors.info500 },
          { icon: 'checkmark-circle-outline', value: adminStats.available_books, label: 'Tersedia', color: colors.success500 },
          { icon: 'swap-horizontal-outline', value: adminStats.borrowed_books, label: 'Dipinjam', color: colors.primary400 },
          { icon: 'trending-up-outline', value: adminStats.daily_borrowings, label: 'Hari Ini', color: colors.accent500 },
        ];
    }
  };

  const fetchData = async () => {
    if (isFetching) return;
    setIsFetching(true);
    try {
      const online = await checkOnlineStatus();
      if (!online) {
        // Fallback to local SQLite cache
        const offlineBooks = getCachedBooks().slice(0, 4);
        setRecentBooks(offlineBooks);

        const offlineBorrowings = getCachedBorrowings().slice(0, 10);
        const activeStates = ['pending', 'approved', 'borrowed', 'late'];
        const filteredActive = offlineBorrowings.filter((b: any) => {
          let status = b.borrowing_status;
          if (status === 'borrowed' && b.due_date && new Date(b.due_date) < new Date()) {
            status = 'late';
          }
          return activeStates.includes(status);
        }).slice(0, 3);
        
        // Reconstruct nested structure for list rendering offline
        const processedActive = filteredActive.map((b: any) => {
          return {
            ...b,
            book_qr: {
              book: {
                book_id: b.book_id,
                book_title: b.book_title || 'Unknown',
              }
            }
          };
        });
        setActiveBorrowings(processedActive);
        
        // Populate mock stats offline if admin
        if (isAdmin) {
          setAdminStats({
            total_books: offlineBooks.length,
            available_books: offlineBooks.filter(x => x.book_status === 'available').length,
            borrowed_books: processedActive.length,
            daily_borrowings: 0
          });
        }
        setIsFetching(false);
        return;
      }

      const [booksRes, borrowRes] = await Promise.all([
        booksAPI.list({ limit: 4, sort_by: 'created_at', sort_order: 'DESC' }),
        borrowingsAPI.list({ limit: 10 }),
      ]);
      setRecentBooks(booksRes.data.data || []);
      
      const allBorrowings = borrowRes.data.data || [];
      const activeStates = ['pending', 'approved', 'borrowed', 'late'];
      const filteredActive = allBorrowings.filter((b: any) => {
        let status = b.borrowing_status;
        if (status === 'borrowed' && b.due_date && new Date(b.due_date) < new Date()) {
          status = 'late';
        }
        return activeStates.includes(status);
      }).slice(0, 3);
      setActiveBorrowings(filteredActive);
      
      if (isAdmin) {
        await fetchAdminStats();
      }
    } catch {} finally {
      setIsFetching(false);
    }
  };

  useEffect(() => {
    fetchData();
    const unsubscribe = navigation.addListener('focus', () => {
      fetchData();
    });
    return unsubscribe;
  }, [navigation, refreshTrigger]);



  const onRefresh = async () => { 
    setRefreshing(true); 
    await fetchData(); 
    setRefreshing(false); 
  };

  const quickActions = [
    { icon: 'book-outline', label: 'Buku', screen: 'BooksTab', color: colors.primary500 },
    { icon: 'qr-code-outline', label: 'Scan QR', screen: 'ScanTab', color: colors.accent500 },
    { icon: 'time-outline', label: 'Pinjaman', screen: 'Borrowings', color: colors.success500 },
    ...(isAdmin 
      ? [{ icon: 'people-outline', label: 'User', screen: 'UserManagement', color: colors.info500 }]
      : []),
  ];

  return (
    <View style={styles.safeContainer}>
      <ScrollView style={styles.container} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary400} />}>
        {/* Welcome */}
        <View style={styles.welcomeCard}>
          <View style={styles.welcomeRow}>
            <View style={styles.avatar}><Text style={styles.avatarText}>{user?.full_name?.charAt(0)?.toUpperCase() || 'U'}</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.welcomeTitle}>Halo, {user?.full_name?.split(' ')[0]}! 👋</Text>
              <Text style={styles.welcomeSub}>{user?.school?.school_name || 'Perpustakaan Digital'}</Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: isOnline ? colors.success500 + '15' : colors.danger500 + '15', borderColor: isOnline ? colors.success500 + '30' : colors.danger500 + '30' }]}>
              <View style={[styles.statusDot, { backgroundColor: isOnline ? colors.success500 : colors.danger500 }]} />
              <Text style={[styles.statusText, { color: isOnline ? colors.success500 : colors.danger500 }]}>
                {isOnline ? 'Online' : 'Offline'}
              </Text>
            </View>
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.quickGrid}>
          {quickActions.map((a) => (
            <TouchableOpacity key={a.label} style={styles.quickCard} onPress={() => navigation.navigate(a.screen)} activeOpacity={0.7}>
              <View style={[styles.quickIcon, { backgroundColor: a.color + '20' }]}>
                <Ionicons name={a.icon as any} size={24} color={a.color} />
              </View>
              <Text style={styles.quickLabel}>{a.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Admin Stats Grid */}
        {isAdmin && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Statistik Perpustakaan</Text>
            {loadingStats ? (
              <ActivityIndicator color={colors.primary400} style={{ marginVertical: Spacing.xl }} />
            ) : adminStats ? (
              <View style={styles.statsGrid}>
                {getStatsItems().map((item, idx) => (
                  <View key={`stat-${idx}`} style={styles.statsCard}>
                    <Ionicons name={item.icon as any} size={20} color={item.color} />
                    <Text style={[styles.statsValue, { color: item.color }]}>{item.value ?? 0}</Text>
                    <Text style={styles.statsLabel}>{item.label}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.emptyState}><Text style={styles.emptyText}>Gagal memuat statistik</Text></View>
            )}
          </View>
        )}



        {/* Active Borrowings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Buku Dipinjam</Text>
          {activeBorrowings.length ? activeBorrowings.map((b, idx) => {
            const isLate = b.borrowing_status === 'late' || (b.due_date && new Date(b.due_date) < new Date());
            const bookId = b.book_qr?.book?.book_id;
            
            // Map status dynamically
            let badgeLabel = 'Aktif';
            let badgeColor = colors.success500;
            let badgeBg = colors.success500 + '20';
            
            if (isLate || b.borrowing_status === 'late') {
              badgeLabel = 'Terlambat';
              badgeColor = colors.danger500;
              badgeBg = colors.danger500 + '20';
            } else {
              switch (b.borrowing_status) {
                case 'pending':
                  badgeLabel = 'Menunggu';
                  badgeColor = colors.warning500;
                  badgeBg = colors.warning500 + '20';
                  break;
                case 'approved':
                  badgeLabel = 'Disetujui';
                  badgeColor = colors.info500;
                  badgeBg = colors.info500 + '20';
                  break;

                case 'borrowed':
                default:
                  badgeLabel = 'Dipinjam';
                  badgeColor = colors.primary400;
                  badgeBg = colors.primary500 + '20';
                  break;
              }
            }

            return (
              <TouchableOpacity 
                key={`borrow-${b.borrowing_id || idx}-${idx}`} 
                style={styles.borrowCard}
                activeOpacity={0.8}
                onPress={() => bookId && navigation.navigate('BookDetails', { bookId })}
              >
                <View style={styles.borrowIcon}><Ionicons name="book" size={20} color={colors.primary400} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.borrowTitle} numberOfLines={1}>{b.book_qr?.book?.book_title || 'Unknown'}</Text>
                  <Text style={styles.borrowSub}>Tenggat: {b.due_date ? new Date(b.due_date).toLocaleString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'}</Text>
                </View>
                <View style={[styles.badge, { backgroundColor: badgeBg }]}>
                  <Text style={[styles.badgeText, { color: badgeColor }]}>
                    {badgeLabel}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          }) : (
            <View style={styles.emptyState}><Ionicons name="book-outline" size={32} color={colors.surface500} /><Text style={styles.emptyText}>Belum ada buku dipinjam</Text></View>
          )}
        </View>

        {/* Recent Books */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Buku Terbaru</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {recentBooks.map((book, idx) => {
              const coverUri = resolveImageUrl(book.cover_image_url);

              return (
                <TouchableOpacity 
                  key={`book-${book.book_id || idx}-${idx}`} 
                  style={styles.bookCard} 
                  activeOpacity={0.8} 
                  onPress={() => navigation.navigate('BookDetails', { bookId: book.book_id })}
                >
                  <View style={styles.bookCover}>
                    {coverUri ? (
                      <CachedImage remoteUri={coverUri} style={styles.bookCoverImage} />
                    ) : (
                      <Ionicons name="book" size={28} color={colors.surface500} />
                    )}
                  </View>
                  <Text style={styles.bookTitle} numberOfLines={2}>{book.book_title}</Text>
                  <Text style={styles.bookAuthor} numberOfLines={1}>{book.author_name}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        <View style={{ height: Spacing.xxxl }} />
      </ScrollView>
    </View>
  );
}

const getStyles = (colors: any) =>
  StyleSheet.create({
    safeContainer: { flex: 1, backgroundColor: colors.surface900 },
    container: { flex: 1, backgroundColor: colors.surface900, paddingHorizontal: Spacing.lg },
    welcomeCard: { backgroundColor: colors.surface800, borderRadius: BorderRadius.xl, padding: Spacing.xl, marginTop: Spacing.lg, borderWidth: 1, borderColor: colors.surface600, borderLeftWidth: 4, borderLeftColor: colors.primary500 },
    welcomeRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
    avatar: { width: 48, height: 48, borderRadius: BorderRadius.lg, backgroundColor: colors.primary500, alignItems: 'center', justifyContent: 'center' },
    avatarText: { fontSize: FontSize.xl, fontWeight: '800', color: colors.white },
    welcomeTitle: { fontSize: FontSize.xl, fontWeight: '800', color: colors.text },
    welcomeSub: { fontSize: FontSize.sm, color: colors.textMuted, marginTop: 2 },
    quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md, marginTop: Spacing.xl, justifyContent: 'space-between' },
    quickCard: { width: '48%', backgroundColor: colors.surface800, borderRadius: BorderRadius.lg, padding: Spacing.lg, alignItems: 'center', borderWidth: 1, borderColor: colors.surface600 },
    quickIcon: { width: 48, height: 48, borderRadius: BorderRadius.lg, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.sm },
    quickLabel: { fontSize: FontSize.sm, fontWeight: '700', color: colors.text },
    section: { marginTop: Spacing.xxl },
    sectionTitle: { fontSize: FontSize.lg, fontWeight: '800', color: colors.text, marginBottom: Spacing.md },
    borrowCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, backgroundColor: colors.surface800, borderRadius: BorderRadius.lg, padding: Spacing.md, marginBottom: Spacing.sm, borderWidth: 1, borderColor: colors.surface600 },
    borrowIcon: { width: 40, height: 40, borderRadius: BorderRadius.md, backgroundColor: colors.primary500 + '15', alignItems: 'center', justifyContent: 'center' },
    borrowTitle: { fontSize: FontSize.md, fontWeight: '600', color: colors.text },
    borrowSub: { fontSize: FontSize.xs, color: colors.textMuted, marginTop: 2 },
    badge: { paddingHorizontal: Spacing.sm, paddingVertical: 3, borderRadius: BorderRadius.full },
    badgeSuccess: { backgroundColor: colors.success500 + '20' },
    badgeDanger: { backgroundColor: colors.danger500 + '20' },
    badgeText: { fontSize: FontSize.xs, fontWeight: '700', color: colors.success500 },
    emptyState: { alignItems: 'center', paddingVertical: Spacing.xxl, backgroundColor: colors.surface800, borderRadius: BorderRadius.xl, borderWidth: 1, borderColor: colors.surface600, borderStyle: 'dashed' },
    emptyText: { fontSize: FontSize.sm, color: colors.textMuted, marginTop: Spacing.sm },
    bookCard: { width: 120, marginRight: Spacing.md },
    bookCover: { width: 120, height: 160, borderRadius: BorderRadius.lg, backgroundColor: colors.surface800, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.sm, borderWidth: 1, borderColor: colors.surface600, overflow: 'hidden' },
    bookCoverImage: { width: '100%', height: '100%', resizeMode: 'cover' },
    bookTitle: { fontSize: FontSize.sm, fontWeight: '600', color: colors.text },
    bookAuthor: { fontSize: FontSize.xs, color: colors.textMuted, marginTop: 2 },
    
    // Admin stats styles
    statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md, justifyContent: 'space-between' },
    statsCard: { width: '48%', backgroundColor: colors.surface800, borderRadius: BorderRadius.lg, padding: Spacing.md, alignItems: 'center', borderWidth: 1, borderColor: colors.surface600, gap: 4 },
    statsValue: { fontSize: FontSize.xxl, fontWeight: '800', color: colors.text, marginTop: 4 },
    statsLabel: { fontSize: FontSize.xs, fontWeight: '600', color: colors.textMuted },

    // Admin management styles
    managementGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md, justifyContent: 'space-between' },
    managementCard: { width: '48%', backgroundColor: colors.surface800, borderRadius: BorderRadius.lg, padding: Spacing.md, alignItems: 'center', borderWidth: 1, borderColor: colors.surface600, gap: 8 },
    managementIcon: { width: 44, height: 44, borderRadius: BorderRadius.md, alignItems: 'center', justifyContent: 'center' },
    managementLabel: { fontSize: FontSize.xs, fontWeight: '700', color: colors.text, textAlign: 'center' },
    statusBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: Spacing.sm,
      paddingVertical: 4,
      borderRadius: BorderRadius.full,
      borderWidth: 1,
    },
    statusDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
    },
    statusText: {
      fontSize: FontSize.xs,
      fontWeight: '700',
    },
  });
