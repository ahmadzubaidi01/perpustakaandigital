import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, RefreshControl, Modal, ActivityIndicator, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { categoriesAPI } from '../../services/api';
import { useTheme } from '../../context/ThemeContext';
import { Spacing, FontSize, BorderRadius } from '../../constants/theme';

export default function CategoryManagementScreen({ navigation }: any) {
  const { colors, isDark } = useTheme();
  const styles = getStyles(colors);

  const [categories, setCategories] = useState<any[]>([]);
  const [filteredCategories, setFilteredCategories] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Modal form states
  const [showFormModal, setShowFormModal] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<any>(null);
  const [categoryName, setCategoryName] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchCategories = async () => {
    try {
      const res = await categoriesAPI.list();
      const list = res.data.data || [];
      setCategories(list);
      setFilteredCategories(list);
    } catch (err: any) {
      Alert.alert('Kesalahan', 'Gagal memuat kategori buku dari server');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchCategories();
    const unsubscribe = navigation?.addListener('focus', () => {
      fetchCategories();
    });
    return unsubscribe;
  }, [navigation]);

  useEffect(() => {
    if (!search.trim()) {
      setFilteredCategories(categories);
    } else {
      const q = search.toLowerCase();
      setFilteredCategories(categories.filter((c) => c.category_name?.toLowerCase().includes(q)));
    }
  }, [search, categories]);

  const handleOpenForm = (category?: any) => {
    if (category) {
      setSelectedCategory(category);
      setCategoryName(category.category_name);
    } else {
      setSelectedCategory(null);
      setCategoryName('');
    }
    setShowFormModal(true);
  };

  const handleSave = async () => {
    if (!categoryName.trim()) {
      Alert.alert('Validasi Gagal', 'Nama kategori tidak boleh kosong!');
      return;
    }
    setSaving(true);
    try {
      if (selectedCategory) {
        // Edit Mode
        const res = await categoriesAPI.update(selectedCategory.category_id, { category_name: categoryName.trim() });
        Alert.alert('Sukses', res.data.message || 'Kategori berhasil diperbarui!');
      } else {
        // Create Mode
        const res = await categoriesAPI.create({ category_name: categoryName.trim() });
        Alert.alert('Sukses', res.data.message || 'Kategori baru berhasil dibuat!');
      }
      setShowFormModal(false);
      fetchCategories();
    } catch (err: any) {
      Alert.alert('Gagal Menyimpan', err.response?.data?.message || 'Gagal menyimpan perubahan');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (id: number) => {
    Alert.alert('Hapus Kategori', 'Apakah Anda yakin ingin menghapus kategori buku ini?', [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Hapus',
        style: 'destructive',
        onPress: async () => {
          try {
            const res = await categoriesAPI.delete(id);
            Alert.alert('Sukses', res.data.message || 'Kategori berhasil dihapus');
            fetchCategories();
          } catch (err: any) {
            Alert.alert('Gagal Menghapus', err.response?.data?.message || 'Gagal menghapus kategori. Kategori ini mungkin masih digunakan oleh beberapa buku.');
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Kategori Buku</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => handleOpenForm()}>
          <Ionicons name="add-circle" size={26} color={colors.text} />
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <Ionicons name="search-outline" size={18} color={colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Cari kategori buku..."
          placeholderTextColor={colors.textMuted}
          value={search}
          onChangeText={setSearch}
        />
        {search ? (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        ) : null}
      </View>

      {loading ? (
        <View style={styles.loadingCenter}>
          <ActivityIndicator size="large" color={colors.primary400} />
          <Text style={styles.loadingText}>Memuat Kategori...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredCategories}
          keyExtractor={(item, idx) => `category-${item.category_id || idx}-${idx}`}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchCategories(); }} tintColor={colors.primary400} />}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardInfo}>
                <View style={styles.iconWrapper}>
                  <Ionicons name="pricetag-outline" size={18} color={colors.primary400} />
                </View>
                <Text style={styles.categoryName}>{item.category_name}</Text>
              </View>
              <View style={styles.actions}>
                <TouchableOpacity style={styles.editAction} onPress={() => handleOpenForm(item)}>
                  <Ionicons name="create-outline" size={18} color={colors.accent500} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.deleteAction} onPress={() => handleDelete(item.category_id)}>
                  <Ionicons name="trash-outline" size={18} color={colors.danger500} />
                </TouchableOpacity>
              </View>
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="pricetags-outline" size={48} color={colors.surface500} />
              <Text style={styles.emptyText}>Tidak ada kategori buku ditemukan</Text>
            </View>
          }
        />
      )}

      {/* CRUD Modal Form */}
      <Modal visible={showFormModal} transparent animationType="fade">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>{selectedCategory ? 'Edit Kategori' : 'Kategori Baru'}</Text>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Nama Kategori</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Contoh: Fiksi Sains, Pemrograman..."
                  placeholderTextColor={colors.textMuted}
                  value={categoryName}
                  onChangeText={setCategoryName}
                />
              </View>
              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowFormModal(false)}>
                  <Text style={styles.cancelBtnText}>Batal</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
                  {saving ? <ActivityIndicator size="small" color={colors.white} /> : <Text style={styles.saveBtnText}>Simpan</Text>}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
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
    addBtn: { padding: Spacing.xs },
    searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface800, marginHorizontal: Spacing.lg, marginTop: Spacing.lg, borderRadius: BorderRadius.lg, paddingHorizontal: Spacing.md, height: 44, borderWidth: 1, borderColor: colors.surface600 },
    searchInput: { flex: 1, color: colors.text, fontSize: FontSize.sm, marginLeft: Spacing.sm },
    loadingCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl },
    loadingText: { fontSize: FontSize.sm, color: colors.textMuted, marginTop: Spacing.md },
    list: { padding: Spacing.lg, paddingBottom: 40 },
    card: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.surface800, padding: Spacing.md, borderRadius: BorderRadius.lg, marginBottom: Spacing.sm, borderWidth: 1, borderColor: colors.surface600 },
    cardInfo: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, flex: 1 },
    iconWrapper: { width: 36, height: 36, borderRadius: BorderRadius.md, backgroundColor: colors.primary500 + '15', alignItems: 'center', justifyContent: 'center' },
    categoryName: { fontSize: FontSize.md, fontWeight: '700', color: colors.text },
    actions: { flexDirection: 'row', gap: Spacing.md },
    editAction: { padding: 4 },
    deleteAction: { padding: 4 },
    empty: { alignItems: 'center', paddingVertical: 80, gap: Spacing.md },
    emptyText: { fontSize: FontSize.md, color: colors.textMuted, textAlign: 'center' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(11, 17, 32, 0.8)', justifyContent: 'center', padding: Spacing.xl },
    modalContent: { backgroundColor: colors.surface800, borderRadius: BorderRadius.xl, padding: Spacing.xl, borderWidth: 1, borderColor: colors.surface600, gap: Spacing.lg },
    modalTitle: { fontSize: FontSize.lg, fontWeight: '800', color: colors.text },
    inputGroup: { gap: Spacing.sm },
    label: { fontSize: FontSize.xs, fontWeight: '700', color: colors.textMuted },
    input: { height: 46, backgroundColor: colors.surface900, borderWidth: 1, borderColor: colors.surface600, borderRadius: BorderRadius.md, color: colors.text, paddingHorizontal: Spacing.md, fontSize: FontSize.md },
    modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.md },
    cancelBtn: { paddingVertical: Spacing.md, paddingHorizontal: Spacing.xl, borderRadius: BorderRadius.md, backgroundColor: colors.surface700 },
    cancelBtnText: { color: colors.white, fontWeight: '700', fontSize: FontSize.md },
    saveBtn: { paddingVertical: Spacing.md, paddingHorizontal: Spacing.xxl, borderRadius: BorderRadius.md, backgroundColor: colors.primary500, minWidth: 100, alignItems: 'center' },
    saveBtnText: { color: colors.white, fontWeight: '700', fontSize: FontSize.md },
  });
