import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Modal, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useAuthStore } from '../../store/authStore';
import { Spacing, FontSize, BorderRadius } from '../../constants/theme';
import api, { booksAPI, categoriesAPI, regionsAPI } from '../../services/api';
import { resolveImageUrl } from '../../utils/imageUtils';
import * as ImagePicker from 'expo-image-picker';
import { checkOnlineStatus } from '../../services/syncService';
import { insertOfflineBook, insertLocalBookQr, getCachedCategories, updateOfflineBook, getCachedBookById } from '../../services/db';
import * as FileSystem from 'expo-file-system/legacy';
import qrcode from 'qrcode-generator';

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
  const [coverImageUri, setCoverImageUri] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<any>(null);
  const [customSerial, setCustomSerial] = useState('');

  // Dropdown visibility
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [showSchoolDropdown, setShowSchoolDropdown] = useState(false);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
        const isOnline = await checkOnlineStatus();
        let cats = [];
        if (isOnline) {
          try {
            const catRes = await categoriesAPI.list();
            cats = catRes.data.data || [];
          } catch (e) {
            cats = getCachedCategories();
          }
        } else {
          cats = getCachedCategories();
        }
        setCategories(cats);

        if (isHighAdmin) {
          try {
            const schoolRes = await regionsAPI.listSchools({ limit: 100 });
            setSchools(schoolRes.data.data || []);
          } catch (e) {
            // High admin offline fallback
          }
        }

        if (isEdit) {
          let b = null;
          if (isOnline) {
            try {
              const bookRes = await booksAPI.get(bookId);
              b = bookRes.data.data;
            } catch (e) {
              b = getCachedBookById(bookId);
            }
          } else {
            b = getCachedBookById(bookId);
          }

          if (b) {
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
            if (b.cover_image_url) {
              setCoverImageUri(resolveImageUrl(b.cover_image_url));
            } else {
              setCoverImageUri(null);
            }
          }
        }
      } catch (err) {
        Alert.alert('Kesalahan', 'Gagal memuat referensi data.');
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [bookId, isEdit, isHighAdmin]);

  const handlePickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Izin Ditolak', 'Aplikasi memerlukan izin galeri untuk memilih sampul.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [3, 4],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        if (asset.fileSize && asset.fileSize > 2 * 1024 * 1024) {
          Alert.alert('Gagal', 'Ukuran foto maksimal adalah 2MB.');
          return;
        }
        setCoverImageUri(asset.uri);
        setImageFile({
          uri: asset.uri,
          name: asset.fileName || `cover_${Date.now()}.jpg`,
          type: asset.mimeType || 'image/jpeg',
        });
      }
    } catch (e) {
      Alert.alert('Gagal', 'Gagal memilih gambar.');
    }
  };

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

    const online = await checkOnlineStatus();
    if (!online) {
      if (isEdit) {
        try {
          const updatedBook = {
            book_title: bookTitle.trim(),
            author_name: authorName.trim(),
            publisher_name: publisherName.trim() || '',
            publication_year: publicationYear.trim() ? parseInt(publicationYear.trim(), 10) : null,
            rack_location: rackLocation.trim() || '',
            category_id: categoryId,
            isbn_code: isbnCode.trim() || '',
            book_description: bookDescription.trim() || '',
            school_id: schoolId || user?.school_id || 1,
            available_stock: parseInt(totalStock, 10) || 0,
            total_stock: parseInt(totalStock, 10) || 0,
            cover_image_url: coverImageUri,
          };
          updateOfflineBook(bookId, updatedBook);
          Alert.alert('Sukses (Offline)', 'Perubahan katalog buku disimpan secara lokal dan akan disinkronkan saat online!');
          navigation.goBack();
        } catch (err: any) {
          Alert.alert('Gagal', err.message || 'Gagal menyimpan perubahan secara offline.');
        } finally {
          setSaving(false);
        }
        return;
      }

      // Offline add-book flow
      try {
        const targetSchoolId = schoolId || user?.school_id || 1;
        const tempBookId = -1000 - Math.floor(Math.random() * 1000000);
        
        // Copy cover image permanently
        let finalLocalCoverUrl = '';
        if (coverImageUri) {
          try {
            const BOOK_COVERS_DIR = `${FileSystem.documentDirectory}book_covers/`;
            const dirInfo = await FileSystem.getInfoAsync(BOOK_COVERS_DIR);
            if (!dirInfo.exists) {
              await FileSystem.makeDirectoryAsync(BOOK_COVERS_DIR, { intermediates: true });
            }
            const fileName = `cover_offline_${tempBookId}_${Date.now()}.jpg`;
            const localUri = BOOK_COVERS_DIR + fileName;
            await FileSystem.copyAsync({
              from: coverImageUri,
              to: localUri,
            });
            finalLocalCoverUrl = localUri;
          } catch (e) {
            console.warn('Failed to copy cover photo offline:', e);
            finalLocalCoverUrl = coverImageUri;
          }
        }

        // Determine serial codes
        const qty = parseInt(totalStock, 10) || 1;
        let serialBase = customSerial.trim();
        if (!serialBase) {
          const titleClean = bookTitle.trim().replace(/[^a-zA-Z0-9]/g, '').substring(0, 3).toUpperCase();
          serialBase = `LIB-${targetSchoolId}-${titleClean}-01`;
        }

        const generatedUUID = () => {
          return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
          });
        };

        const incrementSerialNumber = (serial: string): string => {
          const match = serial.match(/^(.*?)(\d+)$/);
          if (!match) return `${serial}-1`;
          const prefix = match[1];
          const numStr = match[2];
          const nextNum = parseInt(numStr, 10) + 1;
          const nextNumStr = String(nextNum).padStart(numStr.length, '0');
          return `${prefix}${nextNumStr}`;
        };

        let currentSerial = serialBase;
        for (let i = 0; i < qty; i++) {
          let qrSerialNumber = '';
          if (i === 0) {
            qrSerialNumber = currentSerial;
          } else {
            currentSerial = incrementSerialNumber(currentSerial);
            qrSerialNumber = currentSerial;
          }

          const qrUuid = generatedUUID();
          
          insertLocalBookQr({
            book_id: tempBookId,
            qr_uuid: qrUuid,
            qr_serial_number: qrSerialNumber,
            qr_image_url: null,
            qr_status: 'active'
          });
        }

        insertOfflineBook({
          book_id: tempBookId,
          book_code: `OFFLINE-${Math.floor(Date.now()/1000)}`,
          book_title: bookTitle.trim(),
          author_name: authorName.trim(),
          book_status: 'available',
          available_stock: qty,
          total_stock: qty,
          cover_image_url: finalLocalCoverUrl,
          publisher_name: publisherName.trim() || '',
          publication_year: publicationYear.trim() ? parseInt(publicationYear.trim(), 10) : null,
          rack_location: rackLocation.trim() || '',
          category_id: categoryId,
          isbn_code: isbnCode.trim() || '',
          book_description: bookDescription.trim() || '',
          school_id: targetSchoolId,
        });

        Alert.alert('Sukses', 'Buku berhasil disimpan secara lokal dan akan disinkronkan otomatis saat online!');
        navigation.goBack();
      } catch (err: any) {
        Alert.alert('Gagal Menyimpan', err.message || 'Terjadi kesalahan saat menyimpan data offline.');
      } finally {
        setSaving(false);
      }
      return;
    }

    const formData = new FormData();
    formData.append('book_title', bookTitle.trim());
    formData.append('author_name', authorName.trim());
    formData.append('publisher_name', publisherName.trim() || '');
    if (publicationYear.trim()) formData.append('publication_year', publicationYear.trim());
    formData.append('rack_location', rackLocation.trim() || '');
    if (categoryId) formData.append('category_id', String(categoryId));
    formData.append('isbn_code', isbnCode.trim() || '');
    formData.append('total_stock', totalStock || '0');
    formData.append('book_description', bookDescription.trim() || '');

    if (isHighAdmin && schoolId) {
      formData.append('school_id', String(schoolId));
    }

    if (imageFile) {
      formData.append('cover_image', {
        uri: imageFile.uri,
        name: imageFile.name,
        type: imageFile.type,
      } as any);
    }

    try {
      if (isEdit) {
        await booksAPI.update(bookId, formData);
        Alert.alert('Sukses', 'Katalog buku berhasil diperbarui!');
      } else {
        await booksAPI.create(formData);
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
            
            {/* Cover Image Selector */}
            <View style={styles.imageSelectorContainer}>
              <Text style={styles.label}>Sampul Buku</Text>
              <TouchableOpacity style={styles.imagePickerCard} onPress={handlePickImage} activeOpacity={0.8}>
                {coverImageUri ? (
                  <Image source={{ uri: coverImageUri }} style={styles.coverImagePreview} />
                ) : (
                  <View style={styles.placeholderCardContent}>
                    <Ionicons name="camera-outline" size={32} color={colors.textMuted} />
                    <Text style={styles.placeholderCardText}>Pilih Foto Sampul (Maks 2MB)</Text>
                  </View>
                )}
              </TouchableOpacity>
              {coverImageUri && (
                <TouchableOpacity style={styles.removeImageBtn} onPress={() => { setCoverImageUri(null); setImageFile(null); }}>
                  <Text style={styles.removeImageBtnText}>Hapus Sampul</Text>
                </TouchableOpacity>
              )}
            </View>
            
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

            {!isEdit && (
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Nomor Seri QR Pertama (Kustom, Opsional)</Text>
                <TextInput style={styles.input} placeholder="Contoh: BUKU-XYZ-01" placeholderTextColor={colors.surface500} value={customSerial} onChangeText={setCustomSerial} />
              </View>
            )}

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

    imageSelectorContainer: { gap: Spacing.sm, alignItems: 'center', marginBottom: Spacing.md },
    imagePickerCard: { width: 140, height: 180, borderRadius: BorderRadius.lg, backgroundColor: colors.surface800, borderStyle: 'dashed', borderWidth: 2, borderColor: colors.surface600, overflow: 'hidden', justifyContent: 'center', alignItems: 'center' },
    coverImagePreview: { width: '100%', height: '100%', resizeMode: 'cover' },
    placeholderCardContent: { alignItems: 'center', gap: Spacing.xs, paddingHorizontal: Spacing.md },
    placeholderCardText: { color: colors.textMuted, fontSize: FontSize.xs, fontWeight: '600', textAlign: 'center' },
    removeImageBtn: { paddingVertical: Spacing.xs, paddingHorizontal: Spacing.md, borderRadius: BorderRadius.sm, backgroundColor: colors.danger500 + '20', borderWidth: 1, borderColor: colors.danger500 + '30', marginTop: Spacing.xs },
    removeImageBtnText: { color: colors.danger500, fontSize: FontSize.xs, fontWeight: '700' },
  });
