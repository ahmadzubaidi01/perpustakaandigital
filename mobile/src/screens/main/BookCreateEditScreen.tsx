import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useAuthStore } from '../../store/authStore';
import { Spacing, FontSize, BorderRadius } from '../../constants/theme';
import { booksAPI, categoriesAPI, regionsAPI } from '../../services/api';

export default function BookCreateEditScreen({ route, navigation }: any) {
  const { bookId } = route.params || {};
  const isEdit = !!bookId;

  const { colors } = useTheme();
  const { user } = useAuthStore();
  const styles = getStyles(colors);

  const isHighAdmin = ['super_admin', 'regency_admin', 'district_admin'].includes(user?.user_role || '');

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState<any[]>([]);
  const [schools, setSchools] = useState<any[]>([]);

  // Form Fields
  const [bookTitle, setBookTitle] = useState('');
  const [authorName, setAuthorName] = useState('');
  const [publisherName, setPublisherName] = useState('');
  const [publicationYear, setPublicationYear] = useState('');
  const [rackLocation, setRackLocation] = useState('');
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [isbnCode, setIsbnCode] = useState('');
  const [totalStock, setTotalStock] = useState('1');
  const [bookDescription, setBookDescription] = useState('');
  const [schoolId, setSchoolId] = useState<number | null>(null);

  // Dropdown visibility
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [showSchoolDropdown, setShowSchoolDropdown] = useState(false);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
        const catRes = await categoriesAPI.list();
        setCategories(catRes.data.data || []);

        if (isHighAdmin) {
          const schoolRes = await regionsAPI.listSchools({ limit: 100 });
          setSchools(schoolRes.data.data || []);
        }

        if (isEdit) {
          const bookRes = await booksAPI.get(bookId);
          const b = bookRes.data.data;
          setBookTitle(b.book_title || '');
          setAuthorName(b.author_name || '');
          setPublisherName(b.publisher_name || '');
          setPublicationYear(b.publication_year ? String(b.publication_year) : '');
          setRackLocation(b.rack_location || '');
          setCategoryId(b.category_id || null);
          setIsbnCode(b.isbn_code || '');
          setTotalStock(String(b.total_stock || '0'));
          setBookDescription(b.book_description || '');
          setSchoolId(b.school_id || null);
        }
      } catch (err) {
        Alert.alert('Kesalahan', 'Gagal memuat referensi data.');
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [bookId, isEdit, isHighAdmin]);

  const handleSave = async () => {
    if (!bookTitle.trim() || !authorName.trim() || !categoryId) {
      Alert.alert('Validasi Gagal', 'Judul, Penulis, dan Kategori wajib diisi!');
      return;
    }

    if (isHighAdmin && !schoolId) {
      Alert.alert('Validasi Gagal', 'Sekolah wajib dipilih untuk admin wilayah!');
      return;
    }

    setSaving(true);
    const payload: any = {
      book_title: bookTitle.trim(),
      author_name: authorName.trim(),
      publisher_name: publisherName.trim() || null,
      publication_year: publicationYear.trim() ? Number(publicationYear) : null,
      rack_location: rackLocation.trim() || null,
      category_id: categoryId,
      isbn_code: isbnCode.trim() || null,
      total_stock: Number(totalStock) || 0,
      book_description: bookDescription.trim() || null,
    };

    if (isHighAdmin) {
      payload.school_id = schoolId;
    }

    try {
      if (isEdit) {
        await booksAPI.update(bookId, payload);
        Alert.alert('Sukses', 'Katalog buku berhasil diperbarui!');
      } else {
        await booksAPI.create(payload);
        Alert.alert('Sukses', 'Buku baru berhasil didaftarkan!');
      }
      navigation.goBack();
    } catch (err: any) {
      Alert.alert('Gagal Menyimpan', err.response?.data?.message || 'Terjadi kesalahan sistem.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{isEdit ? 'Edit Katalog Buku' : 'Tambah Buku Baru'}</Text>
        <View style={{ width: 32 }} />
      </View>

      {loading ? (
        <View style={styles.loadingCenter}>
          <ActivityIndicator size="large" color={colors.primary400} />
          <Text style={styles.loadingText}>Memuat data referensi...</Text>
        </View>
      ) : (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            
            {/* School Selector (High-level Admins Only) */}
            {isHighAdmin && (
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Sekolah / Unit Perpustakaan</Text>
                <TouchableOpacity style={styles.dropdownHeader} onPress={() => setShowSchoolDropdown(true)}>
                  <Text style={styles.dropdownText}>
                    {schools.find((s) => s.school_id === schoolId)?.school_name || 'Pilih Sekolah'}
                  </Text>
                  <Ionicons name="chevron-down" size={18} color={colors.text} />
                </TouchableOpacity>
              </View>
            )}

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Judul Buku</Text>
              <TextInput style={styles.input} placeholder="Ketik judul buku lengkap..." placeholderTextColor={colors.surface500} value={bookTitle} onChangeText={setBookTitle} />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Nama Penulis / Pengarang</Text>
              <TextInput style={styles.input} placeholder="Nama lengkap penulis..." placeholderTextColor={colors.surface500} value={authorName} onChangeText={setAuthorName} />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Penerbit</Text>
              <TextInput style={styles.input} placeholder="Nama perusahaan penerbit..." placeholderTextColor={colors.surface500} value={publisherName} onChangeText={setPublisherName} />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Tahun Terbit</Text>
              <TextInput style={styles.input} keyboardType="number-pad" placeholder="Contoh: 2024" placeholderTextColor={colors.surface500} value={publicationYear} onChangeText={setPublicationYear} />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Lokasi Rak</Text>
              <TextInput style={styles.input} placeholder="Contoh: RAK-B3" placeholderTextColor={colors.surface500} value={rackLocation} onChangeText={setRackLocation} />
            </View>

            {/* Category Selector */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Kategori Buku</Text>
              <TouchableOpacity style={styles.dropdownHeader} onPress={() => setShowCategoryDropdown(true)}>
                <Text style={styles.dropdownText}>
                  {categories.find((c) => c.category_id === categoryId)?.category_name || 'Pilih Kategori'}
                </Text>
                <Ionicons name="chevron-down" size={18} color={colors.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Nomor Kode / ISBN</Text>
              <TextInput style={styles.input} placeholder="Ketik nomor ISBN buku..." placeholderTextColor={colors.surface500} value={isbnCode} onChangeText={setIsbnCode} />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Jumlah Total Stok</Text>
              <TextInput style={styles.input} keyboardType="number-pad" placeholder="Jumlah fisik buku..." placeholderTextColor={colors.surface500} value={totalStock} onChangeText={setTotalStock} />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Deskripsi & Sinopsis</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                multiline
                numberOfLines={4}
                placeholder="Tulis ringkasan isi buku..."
                placeholderTextColor={colors.surface500}
                value={bookDescription}
                onChangeText={setBookDescription}
              />
            </View>

            <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
              {saving ? <ActivityIndicator size="small" color={colors.white} /> : <Text style={styles.saveBtnText}>Simpan Buku</Text>}
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      )}

      {/* Category Modal Selector */}
      <Modal
        visible={showCategoryDropdown}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCategoryDropdown(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>Pilih Kategori Buku</Text>
              <TouchableOpacity onPress={() => setShowCategoryDropdown(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 300 }} keyboardShouldPersistTaps="handled">
              {categories.map((c) => (
                <TouchableOpacity
                  key={c.category_id}
                  style={[
                    styles.modalSelectItem,
                    categoryId === c.category_id && styles.modalActiveItem,
                  ]}
                  onPress={() => {
                    setCategoryId(c.category_id);
                    setShowCategoryDropdown(false);
                  }}
                >
                  <Text style={styles.modalSelectItemText}>{c.category_name}</Text>
                  {categoryId === c.category_id && (
                    <Ionicons name="checkmark" size={18} color={colors.primary400} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* School Modal Selector */}
      <Modal
        visible={showSchoolDropdown}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSchoolDropdown(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>Pilih Sekolah</Text>
              <TouchableOpacity onPress={() => setShowSchoolDropdown(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 300 }} keyboardShouldPersistTaps="handled">
              {schools.map((s) => (
                <TouchableOpacity
                  key={s.school_id}
                  style={[
                    styles.modalSelectItem,
                    schoolId === s.school_id && styles.modalActiveItem,
                  ]}
                  onPress={() => {
                    setSchoolId(s.school_id);
                    setShowSchoolDropdown(false);
                  }}
                >
                  <Text style={styles.modalSelectItemText}>{s.school_name}</Text>
                  {schoolId === s.school_id && (
                    <Ionicons name="checkmark" size={18} color={colors.primary400} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
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
    backBtn: { padding: Spacing.xs },
    headerTitle: { fontSize: FontSize.lg, fontWeight: '700', color: colors.text },
    loadingCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl },
    loadingText: { fontSize: FontSize.sm, color: colors.textMuted, marginTop: Spacing.md },
    scroll: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: 40 },
    inputGroup: { gap: Spacing.xs },
    label: { fontSize: FontSize.xs, fontWeight: '700', color: colors.textMuted },
    input: { height: 46, backgroundColor: colors.surface800, borderWidth: 1, borderColor: colors.surface600, borderRadius: BorderRadius.md, color: colors.text, paddingHorizontal: Spacing.md, fontSize: FontSize.md },
    textArea: { height: 100, textAlignVertical: 'top', paddingTop: Spacing.sm },
    dropdownHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', height: 46, backgroundColor: colors.surface800, borderWidth: 1, borderColor: colors.surface600, borderRadius: BorderRadius.md, paddingHorizontal: Spacing.md },
    dropdownText: { color: colors.text, fontSize: FontSize.md },
    saveBtn: { paddingVertical: Spacing.md, borderRadius: BorderRadius.md, backgroundColor: colors.primary500, alignItems: 'center', marginTop: Spacing.lg },
    saveBtnText: { color: colors.white, fontWeight: '700', fontSize: FontSize.md },
    
    // Modal Styles
    modalOverlay: { flex: 1, backgroundColor: 'rgba(11, 17, 32, 0.8)', justifyContent: 'center', padding: Spacing.xl },
    modalContent: { backgroundColor: colors.surface800, borderRadius: BorderRadius.xl, padding: Spacing.xl, borderWidth: 1, borderColor: colors.surface600, gap: Spacing.md },
    modalHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm },
    modalTitle: { fontSize: FontSize.lg, fontWeight: '800', color: colors.text },
    modalSelectItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Spacing.md, borderRadius: BorderRadius.md, backgroundColor: colors.surface900, marginBottom: Spacing.xs, borderWidth: 1, borderColor: colors.surface600 },
    modalActiveItem: { borderColor: colors.primary400, backgroundColor: colors.primary500 + '10' },
    modalSelectItemText: { color: colors.text, fontSize: FontSize.sm, fontWeight: '600' },
  });
