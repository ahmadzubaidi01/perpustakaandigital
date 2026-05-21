import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { Spacing, FontSize, BorderRadius } from '../../constants/theme';
import { booksAPI, categoriesAPI } from '../../services/api';

export default function BookCreateEditScreen({ route, navigation }: any) {
  const { bookId } = route.params || {};
  const isEdit = !!bookId;

  const { colors } = useTheme();
  const styles = getStyles(colors);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState<any[]>([]);

  // Form Fields
  const [bookTitle, setBookTitle] = useState('');
  const [authorName, setAuthorName] = useState('');
  const [publisherName, setPublisherName] = useState('');
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [isbn, setIsbn] = useState('');
  const [totalStock, setTotalStock] = useState('1');
  const [description, setDescription] = useState('');

  // Dropdown visibility
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
        const catRes = await categoriesAPI.list();
        setCategories(catRes.data.data || []);

        if (isEdit) {
          const bookRes = await booksAPI.get(bookId);
          const b = bookRes.data.data;
          setBookTitle(b.book_title || '');
          setAuthorName(b.author_name || '');
          setPublisherName(b.publisher_name || '');
          setCategoryId(b.category_id || null);
          setIsbn(b.isbn || '');
          setTotalStock(String(b.total_stock || '0'));
          setDescription(b.description || '');
        }
      } catch (err) {
        Alert.alert('Kesalahan', 'Gagal memuat referensi data.');
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [bookId, isEdit]);

  const handleSave = async () => {
    if (!bookTitle.trim() || !authorName.trim() || !categoryId) {
      Alert.alert('Validasi Gagal', 'Judul, Penulis, dan Kategori wajib diisi!');
      return;
    }

    setSaving(true);
    const payload = {
      book_title: bookTitle.trim(),
      author_name: authorName.trim(),
      publisher_name: publisherName.trim() || null,
      category_id: categoryId,
      isbn: isbn.trim() || null,
      total_stock: Number(totalStock) || 0,
      description: description.trim() || null,
    };

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
          <Text style={styles.loadingText}>Memuat data buku...</Text>
        </View>
      ) : (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Judul Buku</Text>
              <TextInput style={styles.input} placeholder="Ketik judul buku lengkap..." placeholderTextColor={colors.surface500} value={bookTitle} onChangeText={setBookTitle} />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Nama Penulis / Pengarang</Text>
              <TextInput style={styles.input} placeholder="Nama lengkap penulis..." placeholderTextColor={colors.surface500} value={authorName} onChangeText={setAuthorName} />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Penerbit (Opsional)</Text>
              <TextInput style={styles.input} placeholder="Nama perusahaan penerbit..." placeholderTextColor={colors.surface500} value={publisherName} onChangeText={setPublisherName} />
            </View>

            {/* Category Selector */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Kategori Buku</Text>
              <TouchableOpacity style={styles.dropdownHeader} onPress={() => setShowCategoryDropdown(!showCategoryDropdown)}>
                <Text style={styles.dropdownText}>
                  {categories.find((c) => c.category_id === categoryId)?.category_name || 'Pilih Kategori'}
                </Text>
                <Ionicons name={showCategoryDropdown ? 'chevron-up' : 'chevron-down'} size={18} color={colors.text} />
              </TouchableOpacity>
              {showCategoryDropdown && (
                <ScrollView nestedScrollEnabled={true} style={styles.dropdownList}>
                  {categories.map((c) => (
                    <TouchableOpacity
                      key={c.category_id}
                      style={[styles.dropdownItem, categoryId === c.category_id && styles.activeItem]}
                      onPress={() => {
                        setCategoryId(c.category_id);
                        setShowCategoryDropdown(false);
                      }}
                    >
                      <Text style={styles.dropdownItemText}>{c.category_name}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Nomor Kode / ISBN</Text>
              <TextInput style={styles.input} placeholder="Ketik nomor ISBN buku..." placeholderTextColor={colors.surface500} value={isbn} onChangeText={setIsbn} />
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
                value={description}
                onChangeText={setDescription}
              />
            </View>

            <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
              {saving ? <ActivityIndicator size="small" color={colors.white} /> : <Text style={styles.saveBtnText}>Simpan Buku</Text>}
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      )}
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
    dropdownList: { backgroundColor: colors.surface800, borderRadius: BorderRadius.md, maxHeight: 150, overflow: 'hidden', borderWidth: 1, borderColor: colors.surface600 },
    dropdownItem: { padding: Spacing.md, borderRadius: BorderRadius.sm },
    activeItem: { backgroundColor: colors.primary500 + '20' },
    dropdownItemText: { color: colors.text, fontSize: FontSize.sm },
    saveBtn: { paddingVertical: Spacing.md, borderRadius: BorderRadius.md, backgroundColor: colors.primary500, alignItems: 'center', marginTop: Spacing.lg },
    saveBtnText: { color: colors.white, fontWeight: '700', fontSize: FontSize.md },
  });
