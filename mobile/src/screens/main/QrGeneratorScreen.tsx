import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Image, TextInput, Alert, KeyboardAvoidingView, Platform, Share, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../store/authStore';
import { booksAPI, qrAPI } from '../../services/api';
import { useTheme } from '../../context/ThemeContext';
import { Spacing, FontSize, BorderRadius } from '../../constants/theme';

const { width } = Dimensions.get('window');
const cardWidth = (width - Spacing.lg * 2 - Spacing.md) / 2;

interface SelectedBookItem {
  book: any;
  quantity: number;
  customSerial?: string;
}

export default function QrGeneratorScreen({ navigation }: any) {
  const { user } = useAuthStore();
  const { colors, isDark } = useTheme();
  const styles = getStyles(colors, isDark);
  const [mode, setMode] = useState<'member' | 'book'>('member');

  // Member card state
  const [memberQrUrl, setMemberQrUrl] = useState('');

  // Book batch state
  const [searchBookQuery, setSearchBookQuery] = useState('');
  const [booksList, setBooksList] = useState<any[]>([]);
  const [loadingBooks, setLoadingBooks] = useState(false);
  const [showBookSelector, setShowBookSelector] = useState(false);

  // Cart state
  const [selectedBooks, setSelectedBooks] = useState<SelectedBookItem[]>([]);
  const [generating, setGenerating] = useState(false);
  const [generatedQrs, setGeneratedQrs] = useState<any[]>([]);

  // Generate Member Card QR (Passive show-only mode, aligned with versioned JSON payload)
  useEffect(() => {
    if (mode === 'member' && user) {
      const payload = JSON.stringify({
        uuid: user.member_qr_uuid || '',
        user_id: user.user_id,
        type: 'member_qr',
        version: 1,
      });
      setMemberQrUrl(`https://api.qrserver.com/v1/create-qr-code/?size=300x300&color=0b1120&bgcolor=ffffff&data=${encodeURIComponent(payload)}`);
    } else {
      setMemberQrUrl('');
    }
  }, [mode, user]);

  const searchBooks = async () => {
    if (!searchBookQuery.trim()) return;
    setLoadingBooks(true);
    try {
      const res = await booksAPI.list({ search: searchBookQuery.trim(), limit: 10 });
      setBooksList(res.data.data || []);
      setShowBookSelector(true);
    } catch (err) {
      Alert.alert('Kesalahan', 'Gagal memuat buku untuk pembuatan QR');
    } finally {
      setLoadingBooks(false);
    }
  };

  const handleAddBookToCart = (book: any) => {
    const exists = selectedBooks.find((item) => item.book.book_id === book.book_id);
    if (exists) {
      Alert.alert('Info', 'Buku ini sudah ditambahkan ke dalam keranjang.');
      return;
    }
    setSelectedBooks([...selectedBooks, { book, quantity: 1 }]);
    setShowBookSelector(false);
    setSearchBookQuery('');
  };

  const handleRemoveFromCart = (bookId: number) => {
    setSelectedBooks(selectedBooks.filter((item) => item.book.book_id !== bookId));
  };

  const handleUpdateQuantity = (bookId: number, delta: number) => {
    setSelectedBooks(
      selectedBooks.map((item) => {
        if (item.book.book_id === bookId) {
          const newQty = item.quantity + delta;
          return { ...item, quantity: Math.max(1, Math.min(50, newQty)) };
        }
        return item;
      })
    );
  };

  const handleUpdateCustomSerial = (bookId: number, serial: string) => {
    setSelectedBooks(
      selectedBooks.map((item) => {
        if (item.book.book_id === bookId) {
          const qty = serial.trim() ? 1 : item.quantity;
          return { ...item, customSerial: serial, quantity: qty };
        }
        return item;
      })
    );
  };

  // Triggers batch generation sequentially
  const handleGenerateBatch = async () => {
    if (selectedBooks.length === 0) return;
    setGenerating(true);
    const results: any[] = [];
    try {
      for (const item of selectedBooks) {
        const res = await qrAPI.generate({
          book_id: item.book.book_id,
          quantity: item.quantity,
          custom_serial: item.customSerial?.trim() || undefined,
        });
        if (res.data && res.data.data) {
          // Flatten physical copy array
          const generatedCopies = res.data.data.map((copy: any) => ({
            ...copy,
            book_title: item.book.book_title,
            author_name: item.book.author_name,
          }));
          results.push(...generatedCopies);
        }
      }
      setGeneratedQrs(results);
      setSelectedBooks([]);
      Alert.alert('Sukses', `${results.length} Unit QR Code berhasil didaftarkan ke sistem!`);
    } catch (err: any) {
      Alert.alert('Gagal Membuat QR', err.response?.data?.message || 'Terjadi kesalahan saat menghubungi server.');
    } finally {
      setGenerating(false);
    }
  };

  // Uses React Native Native Sharing sheet
  const handleShareQr = async (item: any) => {
    try {
      const payload = JSON.stringify({
        uuid: item.qr_uuid,
        serial: item.qr_serial_number,
        book_id: item.book_id,
        type: 'book_qr',
        version: 1,
      });
      const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&color=0b1120&bgcolor=ffffff&data=${encodeURIComponent(payload)}`;

      await Share.share({
        title: `QR Code: ${item.book_title}`,
        message: `Buku: ${item.book_title}\nPenulis: ${item.author_name}\nSerial Number: ${item.qr_serial_number}\nLink QR: ${qrImageUrl}`,
      });
    } catch (error) {
      Alert.alert('Kesalahan', 'Gagal membagikan data QR');
    }
  };

  const handleShareAll = async () => {
    if (generatedQrs.length === 0) return;
    try {
      let compilationText = `HASIL BATCH QR CODE GENERATION\nSekolah: ${user?.school?.school_name || 'Perpustakaan'}\nTanggal: ${new Date().toLocaleDateString('id-ID')}\n\n`;
      generatedQrs.forEach((item, index) => {
        const payload = JSON.stringify({
          uuid: item.qr_uuid,
          serial: item.qr_serial_number,
          book_id: item.book_id,
          type: 'book_qr',
          version: 1,
        });
        const qrLink = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&color=0b1120&bgcolor=ffffff&data=${encodeURIComponent(payload)}`;
        compilationText += `${index + 1}. [${item.qr_serial_number}] ${item.book_title}\n   Tautan QR: ${qrLink}\n\n`;
      });

      await Share.share({
        title: 'Batch QR Code Cetak',
        message: compilationText,
      });
    } catch (error) {
      Alert.alert('Kesalahan', 'Gagal membagikan data QR');
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'super_admin': return 'Super Admin';
      case 'school_admin': return 'Admin Sekolah';
      case 'student_member': return 'Siswa / Anggota';
      default: return role;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>QR Generator</Text>
        <View style={{ width: 24 }} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {/* Toggle Mode */}
          <View style={styles.tabContainer}>
            <TouchableOpacity style={[styles.tabButton, mode === 'member' && styles.activeTabButton]} onPress={() => setMode('member')}>
              <Ionicons name="person-outline" size={16} color={mode === 'member' ? colors.white : colors.surface300} />
              <Text style={[styles.tabText, mode === 'member' && styles.activeTabText]}>Kartu Anggota</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.tabButton, mode === 'book' && styles.activeTabButton]} onPress={() => setMode('book')}>
              <Ionicons name="book-outline" size={16} color={mode === 'book' ? colors.white : colors.surface300} />
              <Text style={[styles.tabText, mode === 'book' && styles.activeTabText]}>Buku / QR Code</Text>
            </TouchableOpacity>
          </View>

          {mode === 'member' ? (
            /* ==================== STUDENT MEMBER CARD VIEW ==================== */
            memberQrUrl ? (
              <View style={styles.qrCard}>
                <View style={styles.cardBranding}>
                  <Ionicons name="library" size={22} color={colors.accent400} />
                  <Text style={styles.brandingText}>{user?.school?.school_name || 'Perpustakaan Digital'}</Text>
                </View>

                <View style={styles.qrWrapper}>
                  <Image source={{ uri: memberQrUrl }} style={styles.qrImage} />
                </View>

                <View style={styles.infoSection}>
                  <Text style={styles.cardName}>{user?.full_name}</Text>
                  <View style={styles.roleBadge}>
                    <Text style={styles.roleText}>{getRoleLabel(user?.user_role || '')}</Text>
                  </View>
                  {user?.student_id_number && <Text style={styles.cardSub}>NISN: {user.student_id_number}</Text>}
                  <Text style={styles.payloadText}>ID: USER-{user?.user_id}</Text>
                </View>
              </View>
            ) : (
              <View style={styles.emptyCard}>
                <Ionicons name="qr-code-outline" size={64} color={colors.surface500} />
                <Text style={styles.emptyText}>Tidak dapat memuat QR Code Anggota</Text>
              </View>
            )
          ) : (
            /* ==================== BATCH BOOK QR MODE VIEW ==================== */
            <View style={{ width: '100%', gap: Spacing.lg }}>
              {generatedQrs.length > 0 ? (
                /* Generated Preview Screen */
                <View style={{ gap: Spacing.md }}>
                  <View style={styles.resultsHeader}>
                    <View>
                      <Text style={styles.sectionTitle}>Hasil Pembuatan QR</Text>
                      <Text style={styles.sectionSubtitle}>{generatedQrs.length} Physical Copies Terdaftar</Text>
                    </View>
                    <TouchableOpacity style={styles.shareAllBtn} onPress={handleShareAll}>
                      <Ionicons name="share-social-outline" size={16} color={colors.white} />
                      <Text style={styles.shareAllBtnText}>Bagikan Semua</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Generated Grid */}
                  <View style={styles.gridContainer}>
                    {generatedQrs.map((item, idx) => {
                      const payload = JSON.stringify({
                        uuid: item.qr_uuid,
                        serial: item.qr_serial_number,
                        book_id: item.book_id,
                        type: 'book_qr',
                        version: 1,
                      });
                      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&color=0b1120&bgcolor=ffffff&data=${encodeURIComponent(payload)}`;

                      return (
                        <View key={`qr-${item.book_qr_id || item.qr_uuid || idx}-${idx}`} style={styles.gridItemCard}>
                          <View style={styles.gridQrWrapper}>
                            <Image source={{ uri: qrUrl }} style={styles.gridQrImage} />
                          </View>
                          <Text style={styles.gridSerial} numberOfLines={1}>{item.qr_serial_number}</Text>
                          <Text style={styles.gridBookTitle} numberOfLines={1}>{item.book_title}</Text>
                          <TouchableOpacity style={styles.gridShareBtn} onPress={() => handleShareQr(item)}>
                            <Ionicons name="share-outline" size={14} color={colors.primary400} />
                            <Text style={styles.gridShareBtnText}>Share</Text>
                          </TouchableOpacity>
                        </View>
                      );
                    })}
                  </View>

                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: colors.surface700, marginTop: Spacing.md }]}
                    onPress={() => setGeneratedQrs([])}
                  >
                    <Ionicons name="refresh-outline" size={20} color={colors.white} />
                    <Text style={styles.actionBtnText}>Kembali ke Pembuat QR</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                /* Search & Cart Selection Screen */
                <View style={{ gap: Spacing.lg }}>
                  {/* Catalog search bar */}
                  <View style={styles.searchSection}>
                    <Text style={styles.label}>Cari Buku Dari Katalog</Text>
                    <View style={styles.searchRow}>
                      <TextInput
                        style={styles.input}
                        placeholder="Ketik judul buku..."
                        placeholderTextColor={colors.surface400}
                        value={searchBookQuery}
                        onChangeText={setSearchBookQuery}
                        onSubmitEditing={searchBooks}
                      />
                      <TouchableOpacity style={styles.searchBtn} onPress={searchBooks}>
                        {loadingBooks ? <ActivityIndicator size="small" color={colors.white} /> : <Ionicons name="search" size={20} color={colors.white} />}
                      </TouchableOpacity>
                    </View>

                    {showBookSelector && booksList.length > 0 && (
                      <ScrollView nestedScrollEnabled={true} style={styles.resultsList}>
                        {booksList.map((b, index) => (
                          <TouchableOpacity key={`book-selector-${b.book_id || index}-${index}`} style={styles.resultCard} onPress={() => handleAddBookToCart(b)}>
                            <Ionicons name="add-circle" size={22} color={colors.success500} />
                            <View style={{ flex: 1 }}>
                              <Text style={styles.resultTitle} numberOfLines={1}>{b.book_title}</Text>
                              <Text style={styles.resultSub} numberOfLines={1}>{b.author_name}</Text>
                            </View>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    )}

                    {showBookSelector && booksList.length === 0 && !loadingBooks && (
                      <View style={styles.noResults}>
                        <Text style={styles.noResultsText}>Buku tidak ditemukan.</Text>
                      </View>
                    )}
                  </View>

                  {/* Selected Cart list */}
                  <View style={{ gap: Spacing.md }}>
                    <Text style={styles.sectionTitle}>Keranjang Batch QR ({selectedBooks.length})</Text>

                    {selectedBooks.length > 0 ? (
                      <View style={{ gap: Spacing.md }}>
                        {selectedBooks.map((item, index) => (
                          <View key={`selected-book-${item.book.book_id || index}-${index}`} style={styles.cartItemCard}>
                            <View style={{ flex: 1 }}>
                              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm }}>
                                <View style={{ flex: 1, marginRight: Spacing.sm }}>
                                  <Text style={styles.cartBookTitle} numberOfLines={1}>{item.book.book_title}</Text>
                                  <Text style={styles.cartBookSub} numberOfLines={1}>{item.book.author_name}</Text>
                                </View>
                                
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.md }}>
                                  <View style={styles.counterWrapper}>
                                    <TouchableOpacity style={styles.counterBtn} onPress={() => handleUpdateQuantity(item.book.book_id, -1)} disabled={!!item.customSerial?.trim()}>
                                      <Ionicons name="remove" size={16} color={colors.white} />
                                    </TouchableOpacity>
                                    <Text style={styles.counterText}>{item.quantity}</Text>
                                    <TouchableOpacity style={styles.counterBtn} onPress={() => handleUpdateQuantity(item.book.book_id, 1)} disabled={!!item.customSerial?.trim()}>
                                      <Ionicons name="add" size={16} color={colors.white} />
                                    </TouchableOpacity>
                                  </View>

                                  <TouchableOpacity onPress={() => handleRemoveFromCart(item.book.book_id)}>
                                    <Ionicons name="trash-outline" size={22} color={colors.danger500} />
                                  </TouchableOpacity>
                                </View>
                              </View>

                              {/* Custom Serial Row */}
                              <View style={styles.customSerialRow}>
                                <Text style={styles.customSerialLabel}>No. Seri Kustom (Opsional):</Text>
                                <TextInput
                                  style={styles.customSerialInput}
                                  placeholder="Contoh: BUKU-XYZ-01"
                                  placeholderTextColor={colors.surface400}
                                  value={item.customSerial || ''}
                                  onChangeText={(val) => handleUpdateCustomSerial(item.book.book_id, val)}
                                />
                              </View>
                            </View>
                          </View>
                        ))}

                        <TouchableOpacity
                          style={[styles.actionBtn, generating && styles.disabledBtn]}
                          disabled={generating}
                          onPress={handleGenerateBatch}
                        >
                          {generating ? (
                            <ActivityIndicator size="small" color={colors.white} />
                          ) : (
                            <>
                              <Ionicons name="checkmark-circle-outline" size={20} color={colors.white} />
                              <Text style={styles.actionBtnText}>
                                Generate Batch ({selectedBooks.reduce((acc, curr) => acc + curr.quantity, 0)} Salinan)
                              </Text>
                            </>
                          )}
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <View style={styles.emptyCartBox}>
                        <Ionicons name="cart-outline" size={48} color={colors.surface500} />
                        <Text style={styles.emptyCartText}>Keranjang batch kosong. Cari dan tambahkan buku katalog di atas untuk mulai membuat QR Code salinan fisik.</Text>
                      </View>
                    )}
                  </View>
                </View>
              )}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const getStyles = (colors: any, isDark: boolean) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.surface900 },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.md, height: 56, backgroundColor: colors.surface800, borderBottomWidth: 1, borderBottomColor: colors.surface600 },
    backBtn: { padding: Spacing.xs },
    headerTitle: { fontSize: FontSize.lg, fontWeight: '700', color: colors.text },
    content: { padding: Spacing.lg, paddingBottom: 60, alignItems: 'center', gap: Spacing.xl },
    tabContainer: { flexDirection: 'row', backgroundColor: colors.surface800, padding: 6, borderRadius: BorderRadius.lg, borderWidth: 1, borderColor: colors.surface600, width: '100%' },
    tabButton: { flex: 1, paddingVertical: Spacing.md, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: Spacing.sm, borderRadius: BorderRadius.md },
    activeTabButton: { backgroundColor: colors.primary500 },
    tabText: { fontSize: FontSize.sm, fontWeight: '700', color: colors.surface300 },
    activeTabText: { color: colors.white },
    searchSection: { width: '100%', gap: Spacing.sm },
    label: { fontSize: FontSize.sm, fontWeight: '700', color: colors.text },
    searchRow: { flexDirection: 'row', gap: Spacing.sm },
    input: { flex: 1, height: 46, backgroundColor: colors.surface800, borderWidth: 1, borderColor: colors.surface600, borderRadius: BorderRadius.md, color: colors.text, paddingHorizontal: Spacing.md, fontSize: FontSize.md },
    searchBtn: { width: 48, height: 46, backgroundColor: colors.primary500, borderRadius: BorderRadius.md, alignItems: 'center', justifyContent: 'center' },
    resultsList: { backgroundColor: colors.surface800, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: colors.surface600, padding: Spacing.xs, maxHeight: 180, overflow: 'hidden', marginTop: 4 },
    resultCard: { flexDirection: 'row', gap: Spacing.sm, padding: Spacing.md, borderBottomWidth: 1, borderBottomColor: colors.surface700, alignItems: 'center' },
    resultTitle: { fontSize: FontSize.sm, fontWeight: '700', color: colors.text },
    resultSub: { fontSize: FontSize.xs, color: colors.textMuted },
    noResults: { padding: Spacing.md, alignItems: 'center', backgroundColor: colors.surface800, borderRadius: BorderRadius.md },
    noResultsText: { fontSize: FontSize.xs, color: colors.textMuted },

    // Cart components
    cartItemCard: { flexDirection: 'row', backgroundColor: colors.surface800, borderWidth: 1, borderColor: colors.surface600, padding: Spacing.md, borderRadius: BorderRadius.lg },
    cartBookTitle: { fontSize: FontSize.sm, fontWeight: '700', color: colors.text },
    cartBookSub: { fontSize: FontSize.xs, color: colors.textMuted, marginTop: 2 },
    counterWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface700, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: colors.surface600 },
    counterBtn: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
    counterText: { color: colors.white, fontSize: FontSize.sm, fontWeight: '700', paddingHorizontal: Spacing.md },
    emptyCartBox: { width: '100%', padding: Spacing.xxl, backgroundColor: colors.surface800, borderRadius: BorderRadius.xl, borderWidth: 1, borderColor: colors.surface600, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', gap: Spacing.md },
    emptyCartText: { fontSize: FontSize.xs, color: colors.textMuted, textAlign: 'center', lineHeight: 18 },

    // Custom Serial styles
    customSerialRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginTop: Spacing.sm, borderTopWidth: 1, borderTopColor: colors.surface600 + '30', paddingTop: Spacing.sm },
    customSerialLabel: { fontSize: FontSize.xs, fontWeight: '600', color: colors.textMuted },
    customSerialInput: { flex: 1, height: 32, backgroundColor: colors.surface900, borderWidth: 1, borderColor: colors.surface600, borderRadius: BorderRadius.sm, color: colors.text, paddingHorizontal: Spacing.sm, fontSize: FontSize.xs },

    // Generated preview styles
    resultsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: Spacing.sm },
    sectionTitle: { fontSize: FontSize.md, fontWeight: '800', color: colors.text },
    sectionSubtitle: { fontSize: FontSize.xs, color: colors.textMuted, marginTop: 2 },
    shareAllBtn: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, backgroundColor: colors.primary500, paddingHorizontal: Spacing.md, paddingVertical: 8, borderRadius: BorderRadius.md },
    shareAllBtnText: { color: colors.white, fontSize: FontSize.xs, fontWeight: '700' },
    gridContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md, width: '100%', justifyContent: 'space-between' },
    gridItemCard: { width: cardWidth, backgroundColor: colors.surface800, borderRadius: BorderRadius.xl, padding: Spacing.md, borderWidth: 1, borderColor: colors.surface600, alignItems: 'center', gap: Spacing.xs },
    gridQrWrapper: { backgroundColor: colors.white, padding: Spacing.sm, borderRadius: BorderRadius.md, overflow: 'hidden' },
    gridQrImage: { width: cardWidth - 40, height: cardWidth - 40 },
    gridSerial: { fontSize: 10, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', fontWeight: '700', color: colors.accent500, textAlign: 'center', marginTop: Spacing.xs },
    gridBookTitle: { fontSize: FontSize.xs, fontWeight: '700', color: colors.text, textAlign: 'center', width: '90%' },
    gridShareBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.primary500 + '15', borderWidth: 1, borderColor: colors.primary500 + '30', borderRadius: BorderRadius.md, paddingVertical: 4, paddingHorizontal: Spacing.md, marginTop: Spacing.xs },
    gridShareBtnText: { color: colors.primary400, fontSize: 10, fontWeight: '700' },

    // Passive member card styles
    qrCard: { backgroundColor: colors.surface800, borderRadius: BorderRadius.xl, padding: Spacing.xl, alignItems: 'center', borderStyle: 'solid', borderWidth: 2, borderColor: colors.accent500, width: '100%', gap: Spacing.lg, marginTop: Spacing.lg },
    cardBranding: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'center', alignSelf: 'flex-start' },
    brandingText: { fontSize: FontSize.md, fontWeight: '800', color: colors.accent500 },
    qrWrapper: { backgroundColor: colors.white, padding: Spacing.lg, borderRadius: BorderRadius.lg, overflow: 'hidden' },
    qrImage: { width: 180, height: 180 },
    infoSection: { alignItems: 'center', gap: 6 },
    cardName: { fontSize: FontSize.lg, fontWeight: '800', color: colors.text, textAlign: 'center' },
    cardSub: { fontSize: FontSize.xs, color: colors.textMuted, textAlign: 'center' },
    roleBadge: { backgroundColor: colors.surface700, paddingHorizontal: Spacing.lg, paddingVertical: 4, borderRadius: BorderRadius.sm, alignSelf: 'center', marginTop: 4 },
    roleText: { color: colors.accent500, fontWeight: '700', fontSize: FontSize.xs },
    payloadText: { fontSize: FontSize.xs, color: colors.textMuted, letterSpacing: 1, marginTop: 4 },
    emptyCard: { width: '100%', height: 260, backgroundColor: colors.surface800, borderRadius: BorderRadius.xl, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.surface600, borderStyle: 'dashed', gap: Spacing.md },
    emptyText: { fontSize: FontSize.sm, color: colors.textMuted, textAlign: 'center', paddingHorizontal: Spacing.xl },

    actionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, backgroundColor: colors.primary500, borderRadius: BorderRadius.md, paddingVertical: Spacing.md, paddingHorizontal: Spacing.xxl, width: '100%' },
    disabledBtn: { opacity: 0.5 },
    actionBtnText: { color: colors.white, fontWeight: '700', fontSize: FontSize.md },
  });
