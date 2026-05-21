import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, FontSize, BorderRadius } from '../../constants/theme';
import { useAuthStore } from '../../store/authStore';
import { booksAPI, borrowingsAPI } from '../../services/api';

export default function HomeScreen({ navigation }: any) {
  const { user } = useAuthStore();
  const [recentBooks, setRecentBooks] = useState<any[]>([]);
  const [activeBorrowings, setActiveBorrowings] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async () => {
    try {
      const [booksRes, borrowRes] = await Promise.all([
        booksAPI.list({ limit: 4, sort_by: 'created_at', sort_order: 'DESC' }),
        borrowingsAPI.list({ borrowing_status: 'borrowed', limit: 3 }),
      ]);
      setRecentBooks(booksRes.data.data || []);
      setActiveBorrowings(borrowRes.data.data || []);
    } catch {}
  };

  useEffect(() => { fetchData(); }, []);

  const onRefresh = async () => { setRefreshing(true); await fetchData(); setRefreshing(false); };

  const quickActions = [
    { icon: 'book-outline', label: 'Buku', screen: 'BooksTab', color: Colors.primary500 },
    { icon: 'qr-code-outline', label: 'Scan QR', screen: 'ScanTab', color: Colors.accent500 },
    { icon: 'time-outline', label: 'Pinjaman', screen: 'Borrowings', color: Colors.success500 },
    { icon: 'notifications-outline', label: 'Notifikasi', screen: 'NotificationsTab', color: Colors.info500 },
  ];

  return (
    <ScrollView style={styles.container} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary400} />}>
      {/* Welcome */}
      <View style={styles.welcomeCard}>
        <View style={styles.welcomeRow}>
          <View style={styles.avatar}><Text style={styles.avatarText}>{user?.full_name?.charAt(0)?.toUpperCase() || 'U'}</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.welcomeTitle}>Halo, {user?.full_name?.split(' ')[0]}! 👋</Text>
            <Text style={styles.welcomeSub}>{user?.school?.school_name || 'Perpustakaan Digital'}</Text>
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

      {/* Active Borrowings */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Buku Dipinjam</Text>
        {activeBorrowings.length ? activeBorrowings.map((b) => {
          const isLate = b.borrowing_status === 'late' || (b.due_date && new Date(b.due_date) < new Date());
          const bookId = b.book_qr?.book?.book_id;
          return (
            <TouchableOpacity 
              key={b.borrowing_id} 
              style={styles.borrowCard}
              activeOpacity={0.8}
              onPress={() => bookId && navigation.navigate('BookDetails', { bookId })}
            >
              <View style={styles.borrowIcon}><Ionicons name="book" size={20} color={Colors.primary400} /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.borrowTitle} numberOfLines={1}>{b.book_qr?.book?.book_title || 'Unknown'}</Text>
                <Text style={styles.borrowSub}>Tenggat: {b.due_date ? new Date(b.due_date).toLocaleDateString('id-ID') : '-'}</Text>
              </View>
              <View style={[styles.badge, isLate ? styles.badgeDanger : styles.badgeSuccess]}>
                <Text style={[styles.badgeText, { color: isLate ? Colors.danger500 : Colors.success500 }]}>
                  {isLate ? 'Terlambat' : 'Aktif'}
                </Text>
              </View>
            </TouchableOpacity>
          );
        }) : (
          <View style={styles.emptyState}><Ionicons name="book-outline" size={32} color={Colors.surface500} /><Text style={styles.emptyText}>Belum ada buku dipinjam</Text></View>
        )}
      </View>

      {/* Recent Books */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Buku Terbaru</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {recentBooks.map((book) => (
            <TouchableOpacity key={book.book_id} style={styles.bookCard} activeOpacity={0.8} onPress={() => navigation.navigate('BookDetails', { bookId: book.book_id })}>
              <View style={styles.bookCover}><Ionicons name="book" size={28} color={Colors.surface500} /></View>
              <Text style={styles.bookTitle} numberOfLines={2}>{book.book_title}</Text>
              <Text style={styles.bookAuthor} numberOfLines={1}>{book.author_name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <View style={{ height: Spacing.xxxl }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surface900, paddingHorizontal: Spacing.lg },
  welcomeCard: { backgroundColor: Colors.surface800, borderRadius: BorderRadius.xl, padding: Spacing.xl, marginTop: Spacing.lg, borderWidth: 1, borderColor: Colors.surface600, borderLeftWidth: 4, borderLeftColor: Colors.primary500 },
  welcomeRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  avatar: { width: 48, height: 48, borderRadius: BorderRadius.lg, backgroundColor: Colors.primary500, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: FontSize.xl, fontWeight: '800', color: Colors.white },
  welcomeTitle: { fontSize: FontSize.xl, fontWeight: '800', color: Colors.white },
  welcomeSub: { fontSize: FontSize.sm, color: Colors.surface300, marginTop: 2 },
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md, marginTop: Spacing.xl },
  quickCard: { width: '47%', backgroundColor: Colors.surface800, borderRadius: BorderRadius.lg, padding: Spacing.lg, alignItems: 'center', borderWidth: 1, borderColor: Colors.surface600 },
  quickIcon: { width: 48, height: 48, borderRadius: BorderRadius.lg, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.sm },
  quickLabel: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.white },
  section: { marginTop: Spacing.xxl },
  sectionTitle: { fontSize: FontSize.lg, fontWeight: '800', color: Colors.white, marginBottom: Spacing.md },
  borrowCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, backgroundColor: Colors.surface700, borderRadius: BorderRadius.lg, padding: Spacing.md, marginBottom: Spacing.sm },
  borrowIcon: { width: 40, height: 40, borderRadius: BorderRadius.md, backgroundColor: Colors.primary500 + '15', alignItems: 'center', justifyContent: 'center' },
  borrowTitle: { fontSize: FontSize.md, fontWeight: '600', color: Colors.white },
  borrowSub: { fontSize: FontSize.xs, color: Colors.surface400, marginTop: 2 },
  badge: { paddingHorizontal: Spacing.sm, paddingVertical: 3, borderRadius: BorderRadius.full },
  badgeSuccess: { backgroundColor: Colors.success500 + '20' },
  badgeDanger: { backgroundColor: Colors.danger500 + '20' },
  badgeText: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.success500 },
  emptyState: { alignItems: 'center', paddingVertical: Spacing.xxl },
  emptyText: { fontSize: FontSize.sm, color: Colors.surface400, marginTop: Spacing.sm },
  bookCard: { width: 120, marginRight: Spacing.md },
  bookCover: { width: 120, height: 160, borderRadius: BorderRadius.lg, backgroundColor: Colors.surface700, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.sm },
  bookTitle: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.white },
  bookAuthor: { fontSize: FontSize.xs, color: Colors.surface400, marginTop: 2 },
});
