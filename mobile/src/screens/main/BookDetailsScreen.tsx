import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, FontSize, BorderRadius } from '../../constants/theme';
import { booksAPI } from '../../services/api';
import { getCachedBooks } from '../../services/db';
import { checkOnlineStatus } from '../../services/syncService';

export default function BookDetailsScreen({ route, navigation }: any) {
  const { bookId } = route.params || {};
  const [book, setBook] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(false);

  const fetchBookDetails = async () => {
    setLoading(true);
    try {
      const online = await checkOnlineStatus();
      setIsOffline(!online);

      if (!online) {
        const cached = getCachedBooks().find((b) => b.book_id === bookId);
        if (cached) {
          setBook(cached);
        } else {
          Alert.alert('Mode Offline', 'Detail buku ini tidak ditemukan di penyimpanan lokal.');
        }
        return;
      }

      const res = await booksAPI.get(bookId);
      setBook(res.data.data);
    } catch (err: any) {
      // Offline fallback on API error
      setIsOffline(true);
      const cached = getCachedBooks().find((b) => b.book_id === bookId);
      if (cached) {
        setBook(cached);
      } else {
        Alert.alert('Gagal Memuat', err.response?.data?.message || 'Gagal memuat detail buku dari server.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (bookId) {
      fetchBookDetails();
    }
  }, [bookId]);

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color={Colors.primary400} />
        <Text style={s.loadingText}>Memuat Detail Buku...</Text>
      </View>
    );
  }

  if (!book) {
    return (
      <View style={s.center}>
        <Ionicons name="alert-circle-outline" size={48} color={Colors.danger500} />
        <Text style={s.errorText}>Buku tidak ditemukan</Text>
        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
          <Text style={s.backBtnText}>Kembali</Text>
        </TouchableOpacity>
      </View>
    );
  }

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

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      {/* Offline Alert Banner */}
      {isOffline && (
        <View style={s.offlineBanner}>
          <Ionicons name="cloud-offline-outline" size={16} color={Colors.warning500} />
          <Text style={s.offlineText}>Memuat detail dari penyimpanan lokal</Text>
        </View>
      )}

      {/* Book Cover Header */}
      <View style={s.headerCard}>
        <View style={s.coverPlaceholder}>
          <Ionicons name="book" size={80} color={Colors.surface500} />
        </View>
        <Text style={s.title}>{book.book_title}</Text>
        <Text style={s.author}>Oleh: {book.author_name || 'Penulis Tidak Diketahui'}</Text>
        
        <View style={s.badgeRow}>
          <View style={[s.badge, { backgroundColor: statusColor(book.book_status) + '15' }]}>
            <Text style={[s.badgeText, { color: statusColor(book.book_status) }]}>
              {statusLabel(book.book_status)}
            </Text>
          </View>
          <View style={s.stockBadge}>
            <Text style={s.stockText}>Stok: {book.available_stock || 0} / {book.total_stock || 0}</Text>
          </View>
        </View>
      </View>

      {/* Details Box */}
      <View style={s.section}>
        <Text style={s.sectionTitle}>Informasi Buku</Text>
        <View style={s.detailsCard}>
          <View style={s.detailItem}>
            <Text style={s.detailLabel}>PENERBIT</Text>
            <Text style={s.detailValue}>{book.publisher_name || book.publisher || '-'}</Text>
          </View>
          <View style={s.divider} />
          <View style={s.detailItem}>
            <Text style={s.detailLabel}>TAHUN TERBIT</Text>
            <Text style={s.detailValue}>{book.publication_year || '-'}</Text>
          </View>
          <View style={s.divider} />
          <View style={s.detailItem}>
            <Text style={s.detailLabel}>KATEGORI</Text>
            <Text style={s.detailValue}>
              {book.categories && book.categories.length > 0 
                ? book.categories.map((c: any) => c.category_name).join(', ')
                : book.category_name || '-'}
            </Text>
          </View>
          {book.shelf_location && (
            <>
              <View style={s.divider} />
              <View style={s.detailItem}>
                <Text style={s.detailLabel}>LOKASI RAK</Text>
                <Text style={s.detailValue}>{book.shelf_location}</Text>
              </View>
            </>
          )}
        </View>
      </View>

      {/* Action buttons */}
      <TouchableOpacity style={s.backBtnAction} onPress={() => navigation.goBack()}>
        <Ionicons name="arrow-back" size={20} color={Colors.white} />
        <Text style={s.backBtnActionText}>Kembali ke Koleksi</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surface900 },
  content: { padding: Spacing.lg, paddingBottom: 40, gap: Spacing.xl },
  center: { flex: 1, backgroundColor: Colors.surface900, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl },
  loadingText: { fontSize: FontSize.md, color: Colors.surface300, marginTop: Spacing.md },
  errorText: { fontSize: FontSize.md, color: Colors.surface300, marginTop: Spacing.md, marginBottom: Spacing.xl },
  backBtn: { backgroundColor: Colors.primary500, paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md, borderRadius: BorderRadius.md },
  backBtnText: { color: Colors.white, fontWeight: '700', fontSize: FontSize.md },
  offlineBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, backgroundColor: Colors.warning500 + '15', paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.warning500 + '30' },
  offlineText: { fontSize: FontSize.xs, fontWeight: '600', color: Colors.warning500 },
  headerCard: { backgroundColor: Colors.surface800, borderRadius: BorderRadius.xl, padding: Spacing.xl, alignItems: 'center', borderWidth: 1, borderColor: Colors.surface600 },
  coverPlaceholder: { width: 140, height: 180, borderRadius: BorderRadius.lg, backgroundColor: Colors.surface700, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.lg, borderWidth: 1, borderColor: Colors.surface500 },
  title: { fontSize: FontSize.xl, fontWeight: '800', color: Colors.white, textAlign: 'center', marginBottom: Spacing.xs },
  author: { fontSize: FontSize.md, color: Colors.surface300, textAlign: 'center', marginBottom: Spacing.lg },
  badgeRow: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'center' },
  badge: { paddingHorizontal: Spacing.lg, paddingVertical: 6, borderRadius: BorderRadius.full },
  badgeText: { fontSize: FontSize.sm, fontWeight: '700' },
  stockBadge: { backgroundColor: Colors.surface700, paddingHorizontal: Spacing.lg, paddingVertical: 6, borderRadius: BorderRadius.full, borderWidth: 1, borderColor: Colors.surface600 },
  stockText: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.white },
  section: { gap: Spacing.md },
  sectionTitle: { fontSize: FontSize.lg, fontWeight: '800', color: Colors.white },
  detailsCard: { backgroundColor: Colors.surface800, borderRadius: BorderRadius.xl, padding: Spacing.lg, borderWidth: 1, borderColor: Colors.surface600 },
  detailItem: { paddingVertical: Spacing.xs },
  detailLabel: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.surface400, letterSpacing: 0.5 },
  detailValue: { fontSize: FontSize.md, fontWeight: '600', color: Colors.white, marginTop: 4 },
  divider: { height: 1, backgroundColor: Colors.surface600, marginVertical: Spacing.sm },
  backBtnAction: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, backgroundColor: Colors.surface700, borderRadius: BorderRadius.lg, paddingVertical: Spacing.lg, width: '100%', borderWidth: 1, borderColor: Colors.surface600, marginTop: Spacing.md },
  backBtnActionText: { fontSize: FontSize.md, fontWeight: '700', color: Colors.white },
});
