import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, Alert, Modal, TextInput, KeyboardAvoidingView, Platform, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import api, { booksAPI, reviewsAPI, qrAPI } from '../../services/api';
import { getCachedBooks } from '../../services/db';
import { checkOnlineStatus } from '../../services/syncService';
import { useAuthStore } from '../../store/authStore';
import { useTheme } from '../../context/ThemeContext';
import { Spacing, FontSize, BorderRadius } from '../../constants/theme';

export default function BookDetailsScreen({ route, navigation }: any) {
  const { bookId } = route.params || {};
  const { user } = useAuthStore();
  const { colors, isDark } = useTheme();
  const styles = getStyles(colors);

  const isAdmin = ['super_admin', 'regency_admin', 'district_admin', 'school_admin'].includes(user?.user_role || '');

  const [book, setBook] = useState<any>(null);
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(false);

  // Review submission modal states
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [ratingScore, setRatingScore] = useState(5);
  const [reviewText, setReviewText] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  // QR Modal states
  const [activeQr, setActiveQr] = useState<any>(null);
  const [showQrModal, setShowQrModal] = useState(false);

  // QR Status Modal states
  const [activeQrForStatus, setActiveQrForStatus] = useState<any>(null);
  const [showStatusModal, setShowStatusModal] = useState(false);

  const fetchBookDetails = async () => {
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
        setLoading(false);
        return;
      }

      // Parallel fetch book and reviews
      const [bookRes, reviewRes] = await Promise.all([
        booksAPI.get(bookId),
        reviewsAPI.list({ book_id: bookId, limit: 30 }),
      ]);
      setBook(bookRes.data.data);
      setReviews(reviewRes.data.data || []);
    } catch (err: any) {
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
      const unsubscribe = navigation.addListener('focus', () => {
        fetchBookDetails();
      });
      return unsubscribe;
    }
  }, [bookId, navigation]);

  const handleSubmitReview = async () => {
    if (ratingScore < 1 || ratingScore > 5) {
      Alert.alert('Validasi Gagal', 'Skor rating harus di antara 1 sampai 5 bintang.');
      return;
    }
    setSubmittingReview(true);
    try {
      await reviewsAPI.create({
        book_id: bookId,
        rating_score: ratingScore,
        review_text: reviewText.trim() || undefined,
      });
      Alert.alert('Ulasan Dikirim', 'Terima kasih atas ulasan Anda!');
      setShowReviewModal(false);
      setReviewText('');
      setRatingScore(5);
      fetchBookDetails(); // Refresh
    } catch (err: any) {
      Alert.alert('Gagal Mengirim', err.response?.data?.message || 'Anda mungkin sudah memberikan ulasan untuk buku ini.');
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleShowQrImage = (qr: any) => {
    setActiveQr(qr);
    setShowQrModal(true);
  };

  const handleOpenStatusModal = (qr: any) => {
    setActiveQrForStatus(qr);
    setShowStatusModal(true);
  };

  const handleUpdateQrStatus = async (status: string) => {
    if (!activeQrForStatus) return;
    try {
      await qrAPI.updateStatus(activeQrForStatus.book_qr_id, status);
      setShowStatusModal(false);
      Alert.alert('Sukses', 'Status salinan berhasil diperbarui.');
      fetchBookDetails();
    } catch (err: any) {
      Alert.alert('Gagal', err.response?.data?.message || 'Gagal mengubah status salinan.');
    }
  };

  const handleDeleteQr = (qrId: number) => {
    Alert.alert(
      'Hapus Salinan Fisik',
      'Apakah Anda yakin ingin menghapus salinan QR Code ini dari katalog? Tindakan ini tidak dapat dibatalkan.',
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus',
          style: 'destructive',
          onPress: async () => {
            try {
              await qrAPI.delete(qrId);
              Alert.alert('Sukses', 'Salinan QR Code berhasil dihapus.');
              fetchBookDetails();
            } catch (err: any) {
              Alert.alert('Gagal Menghapus', err.response?.data?.message || 'Gagal menghapus salinan. Mungkin ada riwayat peminjaman aktif.');
            }
          },
        },
      ]
    );
  };

  const handleDeleteBook = () => {
    Alert.alert(
      'Hapus Buku Dari Katalog',
      'Apakah Anda yakin ingin menghapus buku ini sepenuhnya dari katalog perpustakaan? Semua data salinan fisik juga akan ikut terhapus.',
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus',
          style: 'destructive',
          onPress: async () => {
            try {
              await booksAPI.delete(bookId);
              Alert.alert('Sukses', 'Katalog buku berhasil dihapus dari perpustakaan.');
              navigation.goBack();
            } catch (err: any) {
              Alert.alert('Gagal Menghapus', err.response?.data?.message || 'Terjadi kesalahan saat menghapus buku.');
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary400} />
        <Text style={styles.loadingText}>Memuat Detail Buku...</Text>
      </View>
    );
  }

  if (!book) {
    return (
      <View style={styles.center}>
        <Ionicons name="alert-circle-outline" size={48} color={colors.danger500} />
        <Text style={styles.errorText}>Buku tidak ditemukan</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backBtnText}>Kembali</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const statusColor = (s: string) => ({
    available: colors.success500,
    borrowed: colors.warning500,
    maintenance: colors.surface400,
    damaged: colors.danger500,
    lost: colors.danger500,
    inactive: colors.surface500,
  }[s] || colors.surface400);

  const statusLabel = (s: string) => ({
    available: 'Tersedia',
    borrowed: 'Dipinjam',
    maintenance: 'Perawatan',
    damaged: 'Rusak',
    lost: 'Hilang',
    inactive: 'Tidak Tersedia',
  }[s] || s);

  // Compute average score
  const avgRating = reviews.length > 0 
    ? (reviews.reduce((acc, r) => acc + (r.rating_score || 0), 0) / reviews.length).toFixed(1)
    : '0.0';

  // Check if current user already submitted a review
  const hasReviewed = reviews.some((r) => r.user_id === user?.user_id);

  // Modal QR logic
  const qrPayload = activeQr ? JSON.stringify({
    uuid: activeQr.qr_uuid,
    serial: activeQr.qr_serial_number,
    book_id: book.book_id,
    type: 'book_qr',
    version: 1,
  }) : '';
  const qrImageUrl = activeQr ? `https://api.qrserver.com/v1/create-qr-code/?size=350x350&color=0b1120&bgcolor=ffffff&data=${encodeURIComponent(qrPayload)}` : '';

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backHeaderBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{book.book_title}</Text>
        {isAdmin && (
          <View style={{ flexDirection: 'row', gap: Spacing.sm, alignItems: 'center' }}>
            <TouchableOpacity style={{ padding: Spacing.xs }} onPress={() => navigation.navigate('BookCreateEdit', { bookId: book.book_id })}>
              <Ionicons name="create-outline" size={22} color={colors.text} />
            </TouchableOpacity>
            <TouchableOpacity style={{ padding: Spacing.xs }} onPress={handleDeleteBook}>
              <Ionicons name="trash-outline" size={22} color={colors.danger500} />
            </TouchableOpacity>
          </View>
        )}
        {!isAdmin && <View style={{ width: 24 }} />}
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* Offline Alert Banner */}
        {isOffline && (
          <View style={styles.offlineBanner}>
            <Ionicons name="cloud-offline-outline" size={16} color={colors.warning500} />
            <Text style={styles.offlineText}>Memuat detail dari penyimpanan lokal</Text>
          </View>
        )}

        {/* Book Cover Header */}
        <View style={styles.headerCard}>
          <View style={styles.coverPlaceholder}>
            {book.cover_image_url ? (
              <Image
                source={{ uri: book.cover_image_url.startsWith('http') ? book.cover_image_url : `${(api.defaults.baseURL || '').replace('/api', '')}${book.cover_image_url}` }}
                style={{ width: '100%', height: '100%', resizeMode: 'cover' }}
              />
            ) : (
              <Ionicons name="book" size={80} color={colors.surface500} />
            )}
          </View>
          <Text style={styles.title}>{book.book_title}</Text>
          <Text style={styles.author}>Oleh: {book.author_name || 'Penulis Tidak Diketahui'}</Text>
          
          <View style={styles.ratingSummary}>
            <Ionicons name="star" size={18} color={colors.accent400} />
            <Text style={styles.ratingAvg}>{avgRating}</Text>
            <Text style={styles.ratingCount}>({reviews.length} Ulasan)</Text>
          </View>

          <View style={styles.badgeRow}>
            <View style={[styles.badge, { backgroundColor: statusColor(book.book_status) + '15' }]}>
              <Text style={[styles.badgeText, { color: statusColor(book.book_status) }]}>
                {statusLabel(book.book_status)}
              </Text>
            </View>
            <View style={styles.stockBadge}>
              <Text style={styles.stockText}>Stok: {book.available_stock || 0} / {book.total_stock || 0}</Text>
            </View>
          </View>
        </View>

        {/* Details Box */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Informasi Buku</Text>
          <View style={styles.detailsCard}>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>PENERBIT</Text>
              <Text style={styles.detailValue}>{book.publisher_name || book.publisher || '-'}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>TAHUN TERBIT</Text>
              <Text style={styles.detailValue}>{book.publication_year || '-'}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>KATEGORI</Text>
              <Text style={styles.detailValue}>
                {book.category?.category_name || book.category_name || '-'}
              </Text>
            </View>
            {book.rack_location && (
              <>
                <View style={styles.divider} />
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>LOKASI RAK</Text>
                  <Text style={styles.detailValue}>{book.rack_location}</Text>
                </View>
              </>
            )}
          </View>
        </View>

        {/* Physical Copies and QRs (Admin Only) */}
        {isAdmin && !isOffline && (
          <View style={styles.section}>
            <View style={styles.reviewsHeaderRow}>
              <Text style={styles.sectionTitle}>Salinan Fisik (QR Code)</Text>
              <TouchableOpacity
                style={styles.writeReviewBtn}
                onPress={() => navigation.navigate('QrGenerator', { preselectedBook: book })}
              >
                <Ionicons name="add" size={14} color={colors.accent500} />
                <Text style={styles.writeReviewBtnText}>Tambah Salinan</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.qrListCard}>
              {book.qr_codes && book.qr_codes.length > 0 ? (
                book.qr_codes.map((qr: any, idx: number) => (
                  <View key={qr.book_qr_id || idx} style={styles.qrRowItem}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.qrSerialText}>{qr.qr_serial_number}</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                        <View style={[styles.miniBullet, { backgroundColor: statusColor(qr.qr_status) }]} />
                        <Text style={styles.qrStatusText}>{statusLabel(qr.qr_status)}</Text>
                      </View>
                    </View>

                    <View style={styles.qrRowActions}>
                      {/* View QR Code */}
                      <TouchableOpacity
                        style={styles.qrActionIconBtn}
                        onPress={() => handleShowQrImage(qr)}
                      >
                        <Ionicons name="qr-code-outline" size={18} color={colors.primary400} />
                      </TouchableOpacity>

                      {/* Change Status Dropdown */}
                      <TouchableOpacity
                        style={styles.qrActionIconBtn}
                        onPress={() => handleOpenStatusModal(qr)}
                      >
                        <Ionicons name="options-outline" size={18} color={colors.accent500} />
                      </TouchableOpacity>

                      {/* Delete QR */}
                      <TouchableOpacity
                        style={styles.qrActionIconBtn}
                        onPress={() => handleDeleteQr(qr.book_qr_id)}
                      >
                        <Ionicons name="trash-outline" size={18} color={colors.danger500} />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              ) : (
                <Text style={styles.emptyQrText}>Belum ada salinan fisik terdaftar untuk buku ini.</Text>
              )}
            </View>
          </View>
        )}

        {/* Reviews Section */}
        <View style={styles.section}>
          <View style={styles.reviewsHeaderRow}>
            <Text style={styles.sectionTitle}>Ulasan Pembaca</Text>
            {!hasReviewed && !isOffline && (
              <TouchableOpacity style={styles.writeReviewBtn} onPress={() => setShowReviewModal(true)}>
                <Ionicons name="create-outline" size={14} color={colors.accent500} />
                <Text style={styles.writeReviewBtnText}>Beri Ulasan</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.reviewsContainer}>
            {reviews.length > 0 ? (
              reviews.map((r, idx) => (
                <View key={`review-${r.review_id || idx}-${idx}`} style={styles.reviewCard}>
                  <View style={styles.reviewHeader}>
                    <View style={styles.reviewerAvatar}>
                      <Text style={styles.reviewerAvatarText}>{r.user?.full_name?.charAt(0).toUpperCase() || 'U'}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.reviewerName}>{r.user?.full_name || 'Pembaca Anonim'}</Text>
                      <View style={styles.starsRow}>
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Ionicons
                            key={star}
                            name={star <= r.rating_score ? 'star' : 'star-outline'}
                            size={12}
                            color={colors.accent400}
                          />
                        ))}
                      </View>
                    </View>
                    <Text style={styles.reviewDate}>{r.created_at ? new Date(r.created_at).toLocaleDateString('id-ID') : '-'}</Text>
                  </View>
                  {r.review_text && <Text style={styles.reviewTextContent}>{r.review_text}</Text>}
                </View>
              ))
            ) : (
              <View style={styles.emptyReviews}>
                <Ionicons name="chatbubble-outline" size={32} color={colors.surface500} />
                <Text style={styles.emptyReviewsText}>Belum ada ulasan untuk buku ini.</Text>
              </View>
            )}
          </View>
        </View>

        {/* Action buttons */}
        <TouchableOpacity style={styles.backBtnAction} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={20} color={colors.white} />
          <Text style={styles.backBtnActionText}>Kembali ke Koleksi</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Write Review Modal */}
      <Modal visible={showReviewModal} transparent animationType="fade">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Tulis Ulasan Anda</Text>
              
              {/* Stars Selector */}
              <View style={styles.ratingRowSelector}>
                {[1, 2, 3, 4, 5].map((num) => (
                  <TouchableOpacity key={num} onPress={() => setRatingScore(num)}>
                    <Ionicons
                      name={num <= ratingScore ? 'star' : 'star-outline'}
                      size={36}
                      color={colors.accent500}
                      style={{ marginHorizontal: 4 }}
                    />
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Komentar / Ulasan</Text>
                <TextInput
                  style={styles.textarea}
                  multiline
                  numberOfLines={4}
                  placeholder="Bagikan pendapat Anda mengenai isi, bahasa, atau wawasan dari buku ini..."
                  placeholderTextColor={colors.surface400}
                  value={reviewText}
                  onChangeText={setReviewText}
                />
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowReviewModal(false)}>
                  <Text style={styles.cancelBtnText}>Batal</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.saveBtn} onPress={handleSubmitReview} disabled={submittingReview}>
                  {submittingReview ? (
                    <ActivityIndicator size="small" color={colors.white} />
                  ) : (
                    <Text style={styles.saveBtnText}>Kirim</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* View QR Code Modal */}
      <Modal visible={showQrModal} transparent animationType="fade" onRequestClose={() => setShowQrModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={styles.modalTitle}>QR Code Salinan Fisik</Text>
              <TouchableOpacity onPress={() => setShowQrModal(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            {activeQr && (
              <View style={{ alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.md }}>
                <View style={styles.modalQrWrapper}>
                  <Image source={{ uri: qrImageUrl }} style={styles.modalQrImage} />
                </View>
                <Text style={styles.modalQrSerial}>{activeQr.qr_serial_number}</Text>
                <Text style={styles.modalQrInfo}>Gunakan kode QR di atas untuk transaksi peminjaman / pengembalian fisik.</Text>
              </View>
            )}

            <TouchableOpacity style={[styles.cancelBtn, { alignSelf: 'center', width: '100%', alignItems: 'center' }]} onPress={() => setShowQrModal(false)}>
              <Text style={styles.cancelBtnText}>Tutup</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Edit Status Modal */}
      <Modal visible={showStatusModal} transparent animationType="fade" onRequestClose={() => setShowStatusModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md }}>
              <Text style={styles.modalTitle}>Ubah Status Salinan</Text>
              <TouchableOpacity onPress={() => setShowStatusModal(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            {activeQrForStatus && (
              <View style={{ gap: Spacing.sm }}>
                <Text style={{ fontSize: FontSize.sm, color: colors.textMuted }}>
                  Nomor Seri: <Text style={{ fontWeight: '700', color: colors.text }}>{activeQrForStatus.qr_serial_number}</Text>
                </Text>
                
                <Text style={{ fontSize: FontSize.xs, fontWeight: '700', color: colors.textMuted, marginTop: Spacing.sm }}>
                  PILIH STATUS BARU
                </Text>

                {['active', 'inactive', 'damaged', 'lost', 'borrowed', 'maintenance'].map((status) => (
                  <TouchableOpacity
                    key={status}
                    style={[
                      styles.statusSelectOption,
                      activeQrForStatus.qr_status === status && styles.activeStatusOption,
                    ]}
                    onPress={() => handleUpdateQrStatus(status)}
                  >
                    <View style={[styles.miniBullet, { backgroundColor: statusColor(status) }]} />
                    <Text style={styles.statusOptionText}>{statusLabel(status)}</Text>
                    {activeQrForStatus.qr_status === status && (
                      <Ionicons name="checkmark" size={18} color={colors.primary400} style={{ marginLeft: 'auto' }} />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const getStyles = (colors: any) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.surface900 },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.md, height: 56, backgroundColor: colors.surface800, borderBottomWidth: 1, borderBottomColor: colors.surface600 },
    backHeaderBtn: { padding: Spacing.xs },
    headerTitle: { fontSize: FontSize.md, fontWeight: '700', color: colors.text, flex: 1, marginLeft: Spacing.sm },
    scrollView: { flex: 1 },
    content: { padding: Spacing.lg, paddingBottom: 40, gap: Spacing.xl },
    center: { flex: 1, backgroundColor: colors.surface900, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl },
    loadingText: { fontSize: FontSize.md, color: colors.textMuted, marginTop: Spacing.md },
    errorText: { fontSize: FontSize.md, color: colors.textMuted, marginTop: Spacing.md, marginBottom: Spacing.xl },
    backBtn: { backgroundColor: colors.primary500, paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md, borderRadius: BorderRadius.md },
    backBtnText: { color: colors.white, fontWeight: '700', fontSize: FontSize.md },
    offlineBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, backgroundColor: colors.warning500 + '15', paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: colors.warning500 + '30' },
    offlineText: { fontSize: FontSize.xs, fontWeight: '600', color: colors.warning500 },
    
    headerCard: { backgroundColor: colors.surface800, borderRadius: BorderRadius.xl, padding: Spacing.xl, alignItems: 'center', borderWidth: 1, borderColor: colors.surface600 },
    coverPlaceholder: { width: 140, height: 180, borderRadius: BorderRadius.lg, backgroundColor: colors.surface700, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.lg, borderWidth: 1, borderColor: colors.surface600 },
    title: { fontSize: FontSize.xl, fontWeight: '800', color: colors.text, textAlign: 'center', marginBottom: Spacing.xs },
    author: { fontSize: FontSize.md, color: colors.textMuted, textAlign: 'center', marginBottom: Spacing.md },
    ratingSummary: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: Spacing.lg },
    ratingAvg: { color: colors.text, fontWeight: '800', fontSize: FontSize.md },
    ratingCount: { color: colors.textMuted, fontSize: FontSize.xs },
    badgeRow: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'center' },
    badge: { paddingHorizontal: Spacing.lg, paddingVertical: 6, borderRadius: BorderRadius.full },
    badgeText: { fontSize: FontSize.sm, fontWeight: '700' },
    stockBadge: { backgroundColor: colors.surface700, paddingHorizontal: Spacing.lg, paddingVertical: 6, borderRadius: BorderRadius.full, borderWidth: 1, borderColor: colors.surface600 },
    stockText: { fontSize: FontSize.sm, fontWeight: '700', color: colors.text },
    
    section: { gap: Spacing.md },
    sectionTitle: { fontSize: FontSize.lg, fontWeight: '800', color: colors.text },
    detailsCard: { backgroundColor: colors.surface800, borderRadius: BorderRadius.xl, padding: Spacing.lg, borderWidth: 1, borderColor: colors.surface600 },
    detailItem: { paddingVertical: Spacing.xs },
    detailLabel: { fontSize: FontSize.xs, fontWeight: '700', color: colors.textMuted, letterSpacing: 0.5 },
    detailValue: { fontSize: FontSize.md, fontWeight: '600', color: colors.text, marginTop: 4 },
    divider: { height: 1, backgroundColor: colors.surface600, marginVertical: Spacing.sm },
    
    // Qr list styles
    qrListCard: { backgroundColor: colors.surface800, borderRadius: BorderRadius.xl, padding: Spacing.lg, borderWidth: 1, borderColor: colors.surface600, gap: Spacing.md },
    qrRowItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.surface600 + '40' },
    qrSerialText: { fontSize: FontSize.md, fontWeight: '700', color: colors.text },
    miniBullet: { width: 6, height: 6, borderRadius: 3 },
    qrStatusText: { fontSize: FontSize.xs, color: colors.textMuted, fontWeight: '600' },
    qrRowActions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    qrActionIconBtn: { width: 36, height: 36, borderRadius: BorderRadius.md, backgroundColor: colors.surface900, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.surface600 },
    emptyQrText: { fontSize: FontSize.sm, color: colors.textMuted, textAlign: 'center', paddingVertical: Spacing.md },

    reviewsHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    writeReviewBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.accent500 + '10', borderWidth: 1, borderColor: colors.accent500 + '30', paddingHorizontal: Spacing.md, paddingVertical: 6, borderRadius: BorderRadius.md },
    writeReviewBtnText: { color: colors.accent500, fontWeight: '700', fontSize: FontSize.xs },
    reviewsContainer: { gap: Spacing.sm },
    reviewCard: { backgroundColor: colors.surface800, borderRadius: BorderRadius.lg, padding: Spacing.md, borderWidth: 1, borderColor: colors.surface600, gap: Spacing.sm },
    reviewHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
    reviewerAvatar: { width: 32, height: 32, borderRadius: BorderRadius.md, backgroundColor: colors.primary500, alignItems: 'center', justifyContent: 'center' },
    reviewerAvatarText: { color: colors.white, fontWeight: '800', fontSize: FontSize.sm },
    reviewerName: { fontSize: FontSize.sm, fontWeight: '700', color: colors.text },
    starsRow: { flexDirection: 'row', gap: 2, marginTop: 2 },
    reviewDate: { fontSize: FontSize.xs, color: colors.textMuted },
    reviewTextContent: { fontSize: FontSize.sm, color: colors.text, lineHeight: 18 },
    emptyReviews: { backgroundColor: colors.surface800, borderRadius: BorderRadius.lg, padding: Spacing.xl, alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, borderWidth: 1, borderColor: colors.surface600 },
    emptyReviewsText: { fontSize: FontSize.sm, color: colors.textMuted, textAlign: 'center' },
    
    backBtnAction: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, backgroundColor: colors.surface700, borderRadius: BorderRadius.lg, paddingVertical: Spacing.lg, width: '100%', borderWidth: 1, borderColor: colors.surface600, marginTop: Spacing.md },
    backBtnActionText: { fontSize: FontSize.md, fontWeight: '700', color: colors.white },
    
    modalOverlay: { flex: 1, backgroundColor: 'rgba(11, 17, 32, 0.8)', justifyContent: 'center', padding: Spacing.xl },
    modalContent: { backgroundColor: colors.surface800, borderRadius: BorderRadius.xl, padding: Spacing.xl, borderWidth: 1, borderColor: colors.surface600, gap: Spacing.lg },
    modalTitle: { fontSize: FontSize.lg, fontWeight: '800', color: colors.text },
    ratingRowSelector: { flexDirection: 'row', justifyContent: 'center', marginVertical: Spacing.md },
    inputGroup: { gap: Spacing.sm },
    label: { fontSize: FontSize.xs, fontWeight: '700', color: colors.text },
    textarea: { height: 100, backgroundColor: colors.surface900, borderWidth: 1, borderColor: colors.surface600, borderRadius: BorderRadius.md, color: colors.text, padding: Spacing.md, fontSize: FontSize.md, textAlignVertical: 'top' },
    modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.md },
    cancelBtn: { paddingVertical: Spacing.md, paddingHorizontal: Spacing.xl, borderRadius: BorderRadius.md, backgroundColor: colors.surface700 },
    cancelBtnText: { color: colors.white, fontWeight: '700', fontSize: FontSize.md },
    saveBtn: { paddingVertical: Spacing.md, paddingHorizontal: Spacing.xxl, borderRadius: BorderRadius.md, backgroundColor: colors.primary500, minWidth: 100, alignItems: 'center' },
    saveBtnText: { color: colors.white, fontWeight: '700', fontSize: FontSize.md },

    modalQrWrapper: { backgroundColor: colors.white, padding: Spacing.md, borderRadius: BorderRadius.lg, borderWidth: 1, borderColor: colors.surface600 },
    modalQrImage: { width: 220, height: 220 },
    modalQrSerial: { fontSize: FontSize.md, fontWeight: '700', color: colors.text, marginTop: Spacing.xs },
    modalQrInfo: { fontSize: FontSize.xs, color: colors.textMuted, textAlign: 'center', paddingHorizontal: Spacing.lg },

    statusSelectOption: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, backgroundColor: colors.surface900, padding: Spacing.md, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: colors.surface600, marginTop: Spacing.xs },
    activeStatusOption: { borderColor: colors.primary400, backgroundColor: colors.primary500 + '10' },
    statusOptionText: { fontSize: FontSize.sm, fontWeight: '700', color: colors.text },
  });
