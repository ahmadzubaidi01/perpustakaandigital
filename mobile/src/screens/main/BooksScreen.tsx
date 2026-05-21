import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, RefreshControl, Dimensions, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Spacing, FontSize, BorderRadius } from '../../constants/theme';
import { booksAPI, categoriesAPI } from '../../services/api';
import { cacheBooks, getCachedBooks } from '../../services/db';
import { checkOnlineStatus } from '../../services/syncService';
import { useTheme } from '../../context/ThemeContext';
import { useAuthStore } from '../../store/authStore';

const { width } = Dimensions.get('window');

const statusLabels: Record<string, string> = {
  available: 'Tersedia',
  borrowed: 'Dipinjam',
  reserved: 'Dipesan',
  maintenance: 'Perawatan',
  damaged: 'Rusak',
  lost: 'Hilang',
};

export default function BooksScreen({ navigation }: any) {
  const { colors, isDark } = useTheme();
  const { user } = useAuthStore();
  const styles = getStyles(colors);

  const isAdmin = ['super_admin', 'regency_admin', 'district_admin', 'school_admin'].includes(user?.user_role || '');

  const [books, setBooks] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  // UI state
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showFilters, setShowFilters] = useState(false);
  const [showCategoryMenu, setShowCategoryMenu] = useState(false);
  const [showStatusMenu, setShowStatusMenu] = useState(false);

  // Load categories
  useEffect(() => {
    categoriesAPI
      .list()
      .then((r) => setCategories(r.data.data || []))
      .catch(() => {});
  }, []);

  const fetchBooks = useCallback(async (reset = false, pageNum?: number) => {
    const p = reset ? 1 : (pageNum !== undefined ? pageNum : page);
    
    if (!reset && (loading || loadingMore || !hasMore)) return;

    if (reset) {
      setLoading(true);
      setHasMore(true);
    } else {
      setLoadingMore(true);
    }

    try {
      const online = await checkOnlineStatus();
      
      if (!online) {
        setIsOfflineMode(true);
        const cached = getCachedBooks(search);
        setBooks(cached);
        setHasMore(false);
        return;
      }

      setIsOfflineMode(false);
      const params: any = { page: p, limit: 12, sort_by: 'created_at', sort_order: 'DESC' };
      if (search) params.search = search;
      if (selectedCategory) params.category_id = selectedCategory;
      if (selectedStatus) params.book_status = selectedStatus;
      
      const res = await booksAPI.list(params);
      const data = res.data.data || [];
      const pagination = res.data.metadata?.pagination;
      
      setBooks((prev) => {
        if (reset) return data;
        const merged = [...prev];
        data.forEach((item: any) => {
          if (!merged.some((b) => b.book_id === item.book_id)) {
            merged.push(item);
          }
        });
        return merged;
      });

      if (pagination) {
        setHasMore(pagination.has_next_page);
        setPage(p);
      } else {
        setHasMore(data.length === 12);
        setPage(p);
      }

      if (reset) {
        cacheBooks(data);
      }
    } catch (err) {
      setIsOfflineMode(true);
      const cached = getCachedBooks(search);
      setBooks(cached);
      setHasMore(false);
    } finally {
      setLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
    }
  }, [page, search, selectedCategory, selectedStatus, loading, loadingMore, hasMore]);

  useEffect(() => {
    fetchBooks(true);
  }, [search, selectedCategory, selectedStatus]);

  const statusColor = (s: string) => ({
    available: colors.success500,
    borrowed: colors.warning500,
    reserved: colors.info500,
    maintenance: colors.surface400,
    damaged: colors.danger500,
    lost: colors.danger500,
  }[s] || colors.surface400);

  const renderBook = ({ item }: any) => {
    if (viewMode === 'grid') {
      return (
        <TouchableOpacity
          style={styles.gridCard}
          activeOpacity={0.8}
          onPress={() => navigation.navigate('BookDetails', { bookId: item.book_id })}
        >
          <View style={styles.gridBookCover}>
            <Ionicons name="book" size={32} color={colors.surface400} />
          </View>
          <View style={styles.gridInfo}>
            <Text style={styles.gridTitle} numberOfLines={2}>{item.book_title}</Text>
            <Text style={styles.gridAuthor} numberOfLines={1}>{item.author_name}</Text>
            <View style={styles.gridMeta}>
              <View style={[styles.badge, { backgroundColor: statusColor(item.book_status) + '15' }]}>
                <Text style={[styles.badgeText, { color: statusColor(item.book_status) }]}>{statusLabels[item.book_status] || item.book_status}</Text>
              </View>
              <Text style={styles.stockText}>{item.available_stock}/{item.total_stock}</Text>
            </View>
          </View>
        </TouchableOpacity>
      );
    }

    return (
      <TouchableOpacity
        style={styles.listCard}
        activeOpacity={0.8}
        onPress={() => navigation.navigate('BookDetails', { bookId: item.book_id })}
      >
        <View style={styles.listBookCover}>
          <Ionicons name="book" size={24} color={colors.surface400} />
        </View>
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <Text style={styles.listTitle} numberOfLines={1}>{item.book_title}</Text>
          <Text style={styles.listAuthor} numberOfLines={1}>{item.author_name}</Text>
          <View style={styles.listMeta}>
            <View style={[styles.badge, { backgroundColor: statusColor(item.book_status) + '15' }]}>
              <Text style={[styles.badgeText, { color: statusColor(item.book_status) }]}>{statusLabels[item.book_status] || item.book_status}</Text>
            </View>
            <Text style={styles.stockText}>{item.available_stock}/{item.total_stock}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header bar actions */}
      <View style={styles.headerRow}>
        <View style={styles.searchContainer}>
          <Ionicons name="search-outline" size={18} color={colors.surface400} />
          <TextInput
            style={styles.searchInput}
            placeholder="Cari judul, penulis, ISBN..."
            placeholderTextColor={colors.surface400}
            value={search}
            onChangeText={setSearch}
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={18} color={colors.surface400} />
            </TouchableOpacity>
          ) : null}
        </View>

        <View style={styles.actionsBar}>
          <TouchableOpacity style={styles.actionBtn} onPress={() => setShowFilters(!showFilters)}>
            <Ionicons name={showFilters ? 'funnel' : 'funnel-outline'} size={20} color={colors.text} />
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.actionBtn} onPress={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}>
            <Ionicons name={viewMode === 'grid' ? 'list-outline' : 'grid-outline'} size={20} color={colors.text} />
          </TouchableOpacity>

          {isAdmin && (
            <TouchableOpacity style={[styles.actionBtn, styles.addBtn]} onPress={() => navigation.navigate('BookCreateEdit')}>
              <Ionicons name="add" size={20} color={colors.white} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Filter Options */}
      {showFilters && (
        <View style={styles.filtersPanel}>
          <View style={styles.filterRow}>
            {/* Category selection */}
            <View style={{ flex: 1 }}>
              <Text style={styles.filterLabel}>Kategori</Text>
              <TouchableOpacity style={styles.filterSelector} onPress={() => { setShowCategoryMenu(!showCategoryMenu); setShowStatusMenu(false); }}>
                <Text style={styles.filterSelectorText} numberOfLines={1}>
                  {categories.find((c) => String(c.category_id) === selectedCategory)?.category_name || 'Semua Kategori'}
                </Text>
                <Ionicons name="chevron-down" size={14} color={colors.text} />
              </TouchableOpacity>
            </View>

            {/* Status selection */}
            <View style={{ flex: 1 }}>
              <Text style={styles.filterLabel}>Status Buku</Text>
              <TouchableOpacity style={styles.filterSelector} onPress={() => { setShowStatusMenu(!showStatusMenu); setShowCategoryMenu(false); }}>
                <Text style={styles.filterSelectorText} numberOfLines={1}>
                  {statusLabels[selectedStatus] || 'Semua Status'}
                </Text>
                <Ionicons name="chevron-down" size={14} color={colors.text} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Category Dropdown List */}
          {showCategoryMenu && (
            <FlatList
              data={[{ category_id: '', category_name: 'Semua Kategori' }, ...categories]}
              keyExtractor={(item) => `cat-${item.category_id}`}
              style={styles.dropdownMenu}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.dropdownItem, selectedCategory === String(item.category_id) && styles.activeDropdownItem]}
                  onPress={() => {
                    setSelectedCategory(String(item.category_id));
                    setShowCategoryMenu(false);
                  }}
                >
                  <Text style={styles.dropdownItemText}>{item.category_name}</Text>
                </TouchableOpacity>
              )}
            />
          )}

          {/* Status Dropdown List */}
          {showStatusMenu && (
            <FlatList
              data={[
                { id: '', label: 'Semua Status' },
                { id: 'available', label: 'Tersedia' },
                { id: 'borrowed', label: 'Dipinjam' },
                { id: 'reserved', label: 'Dipesan' },
                { id: 'maintenance', label: 'Perawatan' },
                { id: 'damaged', label: 'Rusak' },
                { id: 'lost', label: 'Hilang' },
              ]}
              keyExtractor={(item) => `status-${item.id}`}
              style={styles.dropdownMenu}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.dropdownItem, selectedStatus === item.id && styles.activeDropdownItem]}
                  onPress={() => {
                    setSelectedStatus(item.id);
                    setShowStatusMenu(false);
                  }}
                >
                  <Text style={styles.dropdownItemText}>{item.label}</Text>
                </TouchableOpacity>
              )}
            />
          )}
        </View>
      )}

      {/* Offline Alert Banner */}
      {isOfflineMode && (
        <View style={styles.offlineBanner}>
          <Ionicons name="cloud-offline-outline" size={16} color={colors.warning500} />
          <Text style={styles.offlineText}>Menampilkan katalog offline (Kabel internet terputus)</Text>
        </View>
      )}

      {loading ? (
        <View style={styles.loadingCenter}>
          <ActivityIndicator size="large" color={colors.primary400} />
        </View>
      ) : (
        <FlatList
          data={books}
          renderItem={renderBook}
          key={viewMode}
          numColumns={viewMode === 'grid' ? 2 : 1}
          keyExtractor={(item, index) => `book-${item.book_id || index}-${index}`}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchBooks(true); }} tintColor={colors.primary400} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="book-outline" size={48} color={colors.surface500} />
              <Text style={styles.emptyText}>Tidak ada buku ditemukan</Text>
            </View>
          }
          onEndReached={() => {
            if (!isOfflineMode && hasMore && !loadingMore) {
              fetchBooks(false, page + 1);
            }
          }}
          onEndReachedThreshold={0.3}
        />
      )}
    </View>
  );
}

const getStyles = (colors: any) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.surface900 },
    headerRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, gap: Spacing.sm },
    searchContainer: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface800, borderRadius: BorderRadius.lg, paddingHorizontal: Spacing.md, height: 42, borderWidth: 1, borderColor: colors.surface600 },
    searchInput: { flex: 1, height: 40, fontSize: FontSize.sm, color: colors.text, marginLeft: Spacing.sm },
    actionsBar: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
    actionBtn: { width: 42, height: 42, borderRadius: BorderRadius.lg, backgroundColor: colors.surface800, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.surface600 },
    addBtn: { backgroundColor: colors.primary500, borderColor: colors.primary500 },
    
    filtersPanel: { backgroundColor: colors.surface800, paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md, borderBottomWidth: 1, borderBottomColor: colors.surface600 },
    filterRow: { flexDirection: 'row', gap: Spacing.md },
    filterLabel: { fontSize: 10, fontWeight: '700', color: colors.textMuted, marginBottom: 4 },
    filterSelector: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.surface900, height: 38, borderRadius: BorderRadius.md, paddingHorizontal: Spacing.md, borderWidth: 1, borderColor: colors.surface600 },
    filterSelectorText: { fontSize: FontSize.xs, color: colors.text },
    
    dropdownMenu: { backgroundColor: colors.surface900, borderRadius: BorderRadius.md, marginTop: Spacing.sm, maxHeight: 150, borderWidth: 1, borderColor: colors.surface600 },
    dropdownItem: { padding: Spacing.md, borderBottomWidth: 1, borderBottomColor: colors.surface600 + '30' },
    activeDropdownItem: { backgroundColor: colors.primary500 + '15' },
    dropdownItemText: { fontSize: FontSize.sm, color: colors.text },

    list: { paddingHorizontal: Spacing.lg, paddingBottom: 40 },
    listCard: { flexDirection: 'row', backgroundColor: colors.surface800, borderRadius: BorderRadius.lg, padding: Spacing.md, marginBottom: Spacing.sm, borderWidth: 1, borderColor: colors.surface600, gap: Spacing.md },
    listBookCover: { width: 50, height: 66, borderRadius: BorderRadius.md, backgroundColor: colors.surface700, alignItems: 'center', justifyContent: 'center' },
    listTitle: { fontSize: FontSize.md, fontWeight: '700', color: colors.text },
    listAuthor: { fontSize: FontSize.xs, color: colors.textMuted, marginTop: 2 },
    listMeta: { flexDirection: 'row', alignItems: 'center', marginTop: Spacing.xs, gap: Spacing.sm },

    gridCard: { width: (width - Spacing.lg * 2 - Spacing.md) / 2, backgroundColor: colors.surface800, borderRadius: BorderRadius.lg, overflow: 'hidden', marginBottom: Spacing.md, borderWidth: 1, borderColor: colors.surface600, marginRight: Spacing.md },
    gridBookCover: { height: 130, backgroundColor: colors.surface700, alignItems: 'center', justifyContent: 'center' },
    gridInfo: { padding: Spacing.md, gap: 2 },
    gridTitle: { fontSize: FontSize.sm, fontWeight: '700', color: colors.text },
    gridAuthor: { fontSize: FontSize.xs, color: colors.textMuted },
    gridMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: Spacing.sm },

    badge: { paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: BorderRadius.full },
    badgeText: { fontSize: 10, fontWeight: '700' },
    stockText: { fontSize: 10, color: colors.textMuted },
    
    empty: { alignItems: 'center', paddingVertical: 80 },
    emptyText: { fontSize: FontSize.md, color: colors.textMuted, marginTop: Spacing.md },
    
    offlineBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, backgroundColor: colors.warning500 + '15', marginHorizontal: Spacing.lg, marginBottom: Spacing.md, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: colors.warning500 + '30' },
    offlineText: { fontSize: FontSize.xs, fontWeight: '600', color: colors.warning500 },
    loadingCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  });
