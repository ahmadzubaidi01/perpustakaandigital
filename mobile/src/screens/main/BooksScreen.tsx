import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, FontSize, BorderRadius } from '../../constants/theme';
import { booksAPI } from '../../services/api';
import { cacheBooks, getCachedBooks } from '../../services/db';
import { checkOnlineStatus } from '../../services/syncService';

export default function BooksScreen({ navigation }: any) {
  const [books, setBooks] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isOfflineMode, setIsOfflineMode] = useState(false);

  const fetchBooks = useCallback(async (reset = false) => {
    const p = reset ? 1 : page;
    try {
      const online = await checkOnlineStatus();
      
      if (!online) {
        setIsOfflineMode(true);
        const cached = getCachedBooks(search);
        setBooks(cached);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      setIsOfflineMode(false);
      const params: any = { page: p, limit: 20, sort_by: 'created_at', sort_order: 'DESC' };
      if (search) params.search = search;
      
      const res = await booksAPI.list(params);
      const data = res.data.data || [];
      
      setBooks(reset ? data : [...books, ...data]);
      if (reset) {
        setPage(1);
        // Cache the freshly loaded books locally for offline use
        cacheBooks(data);
      }
    } catch (err) {
      // Fallback to cache on api failure
      setIsOfflineMode(true);
      const cached = getCachedBooks(search);
      setBooks(cached);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [page, search, books]);

  useEffect(() => {
    fetchBooks(true);
  }, [search]);

  const statusColor = (s: string) => ({
    available: Colors.success500,
    borrowed: Colors.warning500,
    reserved: Colors.info500,
    damaged: Colors.danger500,
    lost: Colors.danger500,
  }[s] || Colors.surface400);

  const statusLabel = (s: string) => ({
    available: 'Tersedia',
    borrowed: 'Dipinjam',
    reserved: 'Dipesan',
    damaged: 'Rusak',
    lost: 'Hilang',
  }[s] || s);

  const renderBook = ({ item }: any) => (
    <TouchableOpacity style={styles.bookCard} activeOpacity={0.8} onPress={() => navigation.navigate('BookDetails', { bookId: item.book_id })}>
      <View style={styles.bookCover}><Ionicons name="book" size={24} color={Colors.surface500} /></View>
      <View style={{ flex: 1 }}>
        <Text style={styles.bookTitle} numberOfLines={2}>{item.book_title}</Text>
        <Text style={styles.bookAuthor} numberOfLines={1}>{item.author_name}</Text>
        <View style={styles.bookMeta}>
          <View style={[styles.badge, { backgroundColor: statusColor(item.book_status) + '20' }]}>
            <Text style={[styles.badgeText, { color: statusColor(item.book_status) }]}>{statusLabel(item.book_status)}</Text>
          </View>
          <Text style={styles.stockText}>{item.available_stock}/{item.total_stock}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Search */}
      <View style={styles.searchContainer}>
        <Ionicons name="search-outline" size={20} color={Colors.surface400} />
        <TextInput style={styles.searchInput} placeholder="Cari buku..." placeholderTextColor={Colors.surface400} value={search} onChangeText={setSearch} />
        {search ? <TouchableOpacity onPress={() => setSearch('')}><Ionicons name="close-circle" size={20} color={Colors.surface400} /></TouchableOpacity> : null}
      </View>

      {/* Offline Alert Banner */}
      {isOfflineMode && (
        <View style={styles.offlineBanner}>
          <Ionicons name="cloud-offline-outline" size={16} color={Colors.warning500} />
          <Text style={styles.offlineText}>Menampilkan katalog offline (Kabel internet terputus)</Text>
        </View>
      )}

      <FlatList
        data={books}
        renderItem={renderBook}
        keyExtractor={(item, index) => String(item.book_id || index)}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchBooks(true); }} tintColor={Colors.primary400} />}
        ListEmptyComponent={
          !loading ? <View style={styles.empty}><Ionicons name="book-outline" size={48} color={Colors.surface500} /><Text style={styles.emptyText}>Tidak ada buku ditemukan</Text></View> : null
        }
        onEndReached={() => {
          if (!isOfflineMode) {
            setPage((p) => p + 1);
            fetchBooks();
          }
        }}
        onEndReachedThreshold={0.3}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surface900 },
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface700, marginHorizontal: Spacing.lg, marginTop: Spacing.lg, marginBottom: Spacing.md, borderRadius: BorderRadius.lg, paddingHorizontal: Spacing.md, borderWidth: 1, borderColor: Colors.surface500 },
  searchInput: { flex: 1, height: 44, fontSize: FontSize.md, color: Colors.text, marginLeft: Spacing.sm },
  list: { paddingHorizontal: Spacing.lg, paddingBottom: 20 },
  bookCard: { flexDirection: 'row', backgroundColor: Colors.surface800, borderRadius: BorderRadius.lg, padding: Spacing.md, marginBottom: Spacing.md, borderWidth: 1, borderColor: Colors.surface600, gap: Spacing.md },
  bookCover: { width: 60, height: 80, borderRadius: BorderRadius.md, backgroundColor: Colors.surface700, alignItems: 'center', justifyContent: 'center' },
  bookTitle: { fontSize: FontSize.md, fontWeight: '700', color: Colors.white },
  bookAuthor: { fontSize: FontSize.sm, color: Colors.surface300, marginTop: 2 },
  bookMeta: { flexDirection: 'row', alignItems: 'center', marginTop: Spacing.sm, gap: Spacing.sm },
  badge: { paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: BorderRadius.full },
  badgeText: { fontSize: FontSize.xs, fontWeight: '700' },
  stockText: { fontSize: FontSize.xs, color: Colors.surface400 },
  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyText: { fontSize: FontSize.md, color: Colors.surface400, marginTop: Spacing.md },
  offlineBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, backgroundColor: Colors.warning500 + '15', marginHorizontal: Spacing.lg, marginBottom: Spacing.md, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.warning500 + '30' },
  offlineText: { fontSize: FontSize.xs, fontWeight: '600', color: Colors.warning500 },
});
