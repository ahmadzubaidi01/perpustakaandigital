import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, RefreshControl, Modal, ActivityIndicator, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Spacing, FontSize, BorderRadius } from '../../constants/theme';
import { regionsAPI } from '../../services/api';
import { useTheme } from '../../context/ThemeContext';

export default function RegionManagementScreen({ navigation }: any) {
  const { colors } = useTheme();
  const styles = getStyles(colors);

  const [regencies, setRegencies] = useState<any[]>([]);
  const [filteredRegencies, setFilteredRegencies] = useState<any[]>([]);
  const [searchRegency, setSearchRegency] = useState('');
  const [loadingRegencies, setLoadingRegencies] = useState(true);
  const [refreshingRegencies, setRefreshingRegencies] = useState(false);

  // Selected Regency & Districts State
  const [selectedRegency, setSelectedRegency] = useState<any>(null);
  const [districts, setDistricts] = useState<any[]>([]);
  const [filteredDistricts, setFilteredDistricts] = useState<any[]>([]);
  const [searchDistrict, setSearchDistrict] = useState('');
  const [loadingDistricts, setLoadingDistricts] = useState(false);

  // Regency Form Modal
  const [showRegencyModal, setShowRegencyModal] = useState(false);
  const [editingRegency, setEditingRegency] = useState<any>(null);
  const [regencyName, setRegencyName] = useState('');
  const [savingRegency, setSavingRegency] = useState(false);

  // District Form Modal
  const [showDistrictModal, setShowDistrictModal] = useState(false);
  const [editingDistrict, setEditingDistrict] = useState<any>(null);
  const [districtName, setDistrictName] = useState('');
  const [savingDistrict, setSavingDistrict] = useState(false);

  // Fetch Regencies
  const fetchRegencies = async () => {
    setLoadingRegencies(true);
    try {
      const res = await regionsAPI.listRegencies();
      const list = res.data.data || [];
      setRegencies(list);
      setFilteredRegencies(list);
    } catch (err: any) {
      Alert.alert('Kesalahan', 'Gagal memuat data Kabupaten/Kota');
    } finally {
      setLoadingRegencies(false);
      setRefreshingRegencies(false);
    }
  };

  // Fetch Districts for selected Regency
  const fetchDistricts = async (regencyId: number) => {
    setLoadingDistricts(true);
    try {
      const res = await regionsAPI.listDistricts({ regency_id: regencyId });
      const list = res.data.data || [];
      setDistricts(list);
      setFilteredDistricts(list);
    } catch (err: any) {
      Alert.alert('Kesalahan', 'Gagal memuat data Kecamatan');
    } finally {
      setLoadingDistricts(false);
    }
  };

  useEffect(() => {
    fetchRegencies();
    const unsubscribe = navigation?.addListener('focus', () => {
      fetchRegencies();
    });
    return unsubscribe;
  }, [navigation]);

  // Filter Regencies
  useEffect(() => {
    if (!searchRegency.trim()) {
      setFilteredRegencies(regencies);
    } else {
      const q = searchRegency.toLowerCase();
      setFilteredRegencies(regencies.filter((r) => r.regency_name?.toLowerCase().includes(q)));
    }
  }, [searchRegency, regencies]);

  // Filter Districts
  useEffect(() => {
    if (!searchDistrict.trim()) {
      setFilteredDistricts(districts);
    } else {
      const q = searchDistrict.toLowerCase();
      setFilteredDistricts(districts.filter((d) => d.district_name?.toLowerCase().includes(q)));
    }
  }, [searchDistrict, districts]);

  // Regency Modal handlers
  const handleOpenRegencyForm = (item?: any) => {
    if (item) {
      setEditingRegency(item);
      setRegencyName(item.regency_name);
    } else {
      setEditingRegency(null);
      setRegencyName('');
    }
    setShowRegencyModal(true);
  };

  const handleSaveRegency = async () => {
    if (!regencyName.trim()) {
      Alert.alert('Validasi Gagal', 'Nama Kabupaten/Kota tidak boleh kosong!');
      return;
    }
    setSavingRegency(true);
    try {
      if (editingRegency) {
        await regionsAPI.updateRegency(editingRegency.regency_id, { regency_name: regencyName.trim() });
        Alert.alert('Sukses', 'Kabupaten/Kota berhasil diperbarui!');
      } else {
        await regionsAPI.createRegency({ regency_name: regencyName.trim() });
        Alert.alert('Sukses', 'Kabupaten/Kota berhasil didaftarkan!');
      }
      setShowRegencyModal(false);
      fetchRegencies();
    } catch (err: any) {
      Alert.alert('Gagal Menyimpan', err.response?.data?.message || 'Terjadi kesalahan saat menyimpan data');
    } finally {
      setSavingRegency(false);
    }
  };

  const handleDeleteRegency = (item: any) => {
    Alert.alert('Konfirmasi Hapus', `Apakah Anda yakin ingin menghapus "${item.regency_name}" beserta seluruh kecamatan di dalamnya?`, [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Hapus',
        style: 'destructive',
        onPress: async () => {
          try {
            await regionsAPI.deleteRegency(item.regency_id);
            Alert.alert('Sukses', 'Kabupaten/Kota berhasil dihapus');
            fetchRegencies();
          } catch (err: any) {
            Alert.alert('Gagal', err.response?.data?.message || 'Gagal menghapus. Kabupaten ini mungkin masih memiliki data terkait.');
          }
        },
      },
    ]);
  };

  // Regency Click handler (opens District modal)
  const handleRegencyClick = (regency: any) => {
    setSelectedRegency(regency);
    setSearchDistrict('');
    fetchDistricts(regency.regency_id);
  };

  // District CRUD handlers
  const handleOpenDistrictForm = (item?: any) => {
    if (item) {
      setEditingDistrict(item);
      setDistrictName(item.district_name);
    } else {
      setEditingDistrict(null);
      setDistrictName('');
    }
    setShowDistrictModal(true);
  };

  const handleSaveDistrict = async () => {
    if (!districtName.trim()) {
      Alert.alert('Validasi Gagal', 'Nama kecamatan tidak boleh kosong!');
      return;
    }
    if (!selectedRegency) return;
    setSavingDistrict(true);
    try {
      if (editingDistrict) {
        await regionsAPI.updateDistrict(editingDistrict.district_id, { district_name: districtName.trim() });
        Alert.alert('Sukses', 'Kecamatan berhasil diperbarui!');
      } else {
        await regionsAPI.createDistrict({
          district_name: districtName.trim(),
          regency_id: selectedRegency.regency_id
        });
        Alert.alert('Sukses', 'Kecamatan berhasil didaftarkan!');
      }
      setShowDistrictModal(false);
      fetchDistricts(selectedRegency.regency_id);
    } catch (err: any) {
      Alert.alert('Gagal Menyimpan', err.response?.data?.message || 'Terjadi kesalahan saat menyimpan data');
    } finally {
      setSavingDistrict(false);
    }
  };

  const handleDeleteDistrict = (item: any) => {
    Alert.alert('Konfirmasi Hapus', `Apakah Anda yakin ingin menghapus kecamatan "${item.district_name}"?`, [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Hapus',
        style: 'destructive',
        onPress: async () => {
          try {
            await regionsAPI.deleteDistrict(item.district_id);
            Alert.alert('Sukses', 'Kecamatan berhasil dihapus');
            if (selectedRegency) {
              fetchDistricts(selectedRegency.regency_id);
            }
          } catch (err: any) {
            Alert.alert('Gagal', err.response?.data?.message || 'Gagal menghapus kecamatan. Wilayah ini mungkin masih memiliki sekolah terkait.');
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
        <Text style={styles.headerTitle}>Wilayah Regional</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => handleOpenRegencyForm()}>
          <Ionicons name="add-circle" size={26} color={colors.primary400} />
        </TouchableOpacity>
      </View>

      {/* Search Regency */}
      <View style={styles.searchContainer}>
        <Ionicons name="search-outline" size={18} color={colors.surface400} />
        <TextInput
          style={styles.searchInput}
          placeholder="Cari kabupaten/kota..."
          placeholderTextColor={colors.surface400}
          value={searchRegency}
          onChangeText={setSearchRegency}
        />
        {searchRegency ? (
          <TouchableOpacity onPress={() => setSearchRegency('')}>
            <Ionicons name="close-circle" size={18} color={colors.surface400} />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Main List - Regencies */}
      {loadingRegencies ? (
        <View style={styles.loadingCenter}>
          <ActivityIndicator size="large" color={colors.primary400} />
          <Text style={styles.loadingText}>Memuat Kabupaten...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredRegencies}
          keyExtractor={(item, idx) => `regency-${item.regency_id || idx}-${idx}`}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshingRegencies}
              onRefresh={() => {
                setRefreshingRegencies(true);
                fetchRegencies();
              }}
              tintColor={colors.primary400}
            />
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => handleRegencyClick(item)}
              activeOpacity={0.7}
            >
              <View style={styles.cardInfo}>
                <View style={styles.iconWrapper}>
                  <Ionicons name="map-outline" size={18} color={colors.primary400} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemName}>{item.regency_name}</Text>
                  <Text style={styles.itemSub}>Klik untuk lihat Kecamatan</Text>
                </View>
              </View>
              <View style={styles.actions}>
                <TouchableOpacity
                  style={styles.editAction}
                  onPress={() => handleOpenRegencyForm(item)}
                >
                  <Ionicons name="create-outline" size={18} color={colors.accent400} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.deleteAction}
                  onPress={() => handleDeleteRegency(item)}
                >
                  <Ionicons name="trash-outline" size={18} color={colors.danger500} />
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="locate-outline" size={48} color={colors.surface500} />
              <Text style={styles.emptyText}>Tidak ada data Kabupaten/Kota ditemukan</Text>
            </View>
          }
        />
      )}

      {/* Regency CRUD Form Modal */}
      <Modal visible={showRegencyModal} transparent animationType="fade">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>
                {editingRegency ? 'Edit' : 'Daftarkan'} Kabupaten/Kota
              </Text>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Nama Kabupaten/Kota</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Contoh: Sleman, Bantul, Yogyakarta..."
                  placeholderTextColor={colors.surface400}
                  value={regencyName}
                  onChangeText={setRegencyName}
                />
              </View>
              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowRegencyModal(false)}>
                  <Text style={styles.cancelBtnText}>Batal</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.saveBtn} onPress={handleSaveRegency} disabled={savingRegency}>
                  {savingRegency ? (
                    <ActivityIndicator size="small" color={colors.white} />
                  ) : (
                    <Text style={styles.saveBtnText}>Simpan</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* DISTRICT LIST & CRUD OVERLAY (MODAL) */}
      <Modal visible={selectedRegency !== null} animationType="slide" transparent={false}>
        <SafeAreaView style={styles.container}>
          {/* Modal Header */}
          <View style={styles.header}>
            <TouchableOpacity style={styles.backBtn} onPress={() => setSelectedRegency(null)}>
              <Ionicons name="arrow-back" size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {selectedRegency ? `${selectedRegency.regency_name}` : 'Kecamatan'}
            </Text>
            <TouchableOpacity style={styles.addBtn} onPress={() => handleOpenDistrictForm()}>
              <Ionicons name="add-circle" size={26} color={colors.primary400} />
            </TouchableOpacity>
          </View>

          {/* Search District */}
          <View style={styles.searchContainer}>
            <Ionicons name="search-outline" size={18} color={colors.surface400} />
            <TextInput
              style={styles.searchInput}
              placeholder="Cari kecamatan..."
              placeholderTextColor={colors.surface400}
              value={searchDistrict}
              onChangeText={setSearchDistrict}
            />
            {searchDistrict ? (
              <TouchableOpacity onPress={() => setSearchDistrict('')}>
                <Ionicons name="close-circle" size={18} color={colors.surface400} />
              </TouchableOpacity>
            ) : null}
          </View>

          {/* District List */}
          {loadingDistricts ? (
            <View style={styles.loadingCenter}>
              <ActivityIndicator size="large" color={colors.primary400} />
              <Text style={styles.loadingText}>Memuat Kecamatan...</Text>
            </View>
          ) : (
            <FlatList
              data={filteredDistricts}
              keyExtractor={(item, idx) => `district-${item.district_id || idx}-${idx}`}
              contentContainerStyle={styles.list}
              renderItem={({ item }) => (
                <View style={styles.card}>
                  <View style={styles.cardInfo}>
                    <View style={styles.iconWrapper}>
                      <Ionicons name="location-outline" size={18} color={colors.primary400} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.itemName}>{item.district_name}</Text>
                      <Text style={styles.itemSub}>{selectedRegency?.regency_name}</Text>
                    </View>
                  </View>
                  <View style={styles.actions}>
                    <TouchableOpacity
                      style={styles.editAction}
                      onPress={() => handleOpenDistrictForm(item)}
                    >
                      <Ionicons name="create-outline" size={18} color={colors.accent400} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.deleteAction}
                      onPress={() => handleDeleteDistrict(item)}
                    >
                      <Ionicons name="trash-outline" size={18} color={colors.danger500} />
                    </TouchableOpacity>
                  </View>
                </View>
              )}
              ListEmptyComponent={
                <View style={styles.empty}>
                  <Ionicons name="locate-outline" size={48} color={colors.surface500} />
                  <Text style={styles.emptyText}>Belum ada data Kecamatan di Kabupaten ini</Text>
                </View>
              }
            />
          )}

          {/* District CRUD Form Modal */}
          <Modal visible={showDistrictModal} transparent animationType="fade">
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
              style={{ flex: 1 }}
            >
              <View style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                  <Text style={styles.modalTitle}>
                    {editingDistrict ? 'Edit' : 'Daftarkan'} Kecamatan
                  </Text>
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Nama Kecamatan</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Contoh: Depok, Mlati, Gamping..."
                      placeholderTextColor={colors.surface400}
                      value={districtName}
                      onChangeText={setDistrictName}
                    />
                  </View>
                  <View style={styles.modalActions}>
                    <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowDistrictModal(false)}>
                      <Text style={styles.cancelBtnText}>Batal</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.saveBtn} onPress={handleSaveDistrict} disabled={savingDistrict}>
                      {savingDistrict ? (
                        <ActivityIndicator size="small" color={colors.white} />
                      ) : (
                        <Text style={styles.saveBtnText}>Simpan</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </KeyboardAvoidingView>
          </Modal>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const getStyles = (colors: any) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.surface900 },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.md, height: 56, backgroundColor: colors.surface800, borderBottomWidth: 1, borderBottomColor: colors.surface600 },
    backBtn: { padding: Spacing.xs },
    headerTitle: { fontSize: FontSize.lg, fontWeight: '700', color: colors.text, flex: 1, textAlign: 'center' },
    addBtn: { padding: Spacing.xs },
    searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface800, marginHorizontal: Spacing.lg, marginTop: Spacing.lg, borderRadius: BorderRadius.lg, paddingHorizontal: Spacing.md, height: 44, borderWidth: 1, borderColor: colors.surface600 },
    searchInput: { flex: 1, color: colors.text, fontSize: FontSize.sm, marginLeft: Spacing.sm },
    loadingCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl },
    loadingText: { fontSize: FontSize.sm, color: colors.textMuted, marginTop: Spacing.md },
    list: { padding: Spacing.lg, paddingBottom: 40 },
    card: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.surface800, padding: Spacing.md, borderRadius: BorderRadius.lg, marginBottom: Spacing.sm, borderWidth: 1, borderColor: colors.surface600 },
    cardInfo: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, flex: 1 },
    iconWrapper: { width: 36, height: 36, borderRadius: BorderRadius.md, backgroundColor: colors.primary500 + '15', alignItems: 'center', justifyContent: 'center' },
    itemName: { fontSize: FontSize.md, fontWeight: '700', color: colors.text },
    itemSub: { fontSize: FontSize.xs, color: colors.textMuted, marginTop: 2 },
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
    input: { height: 46, backgroundColor: colors.surface700, borderWidth: 1, borderColor: colors.surface600, borderRadius: BorderRadius.md, color: colors.text, paddingHorizontal: Spacing.md, fontSize: FontSize.md },
    modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.md },
    cancelBtn: { paddingVertical: Spacing.md, paddingHorizontal: Spacing.xl, borderRadius: BorderRadius.md, backgroundColor: colors.surface700 },
    cancelBtnText: { color: colors.text, fontWeight: '700', fontSize: FontSize.md },
    saveBtn: { paddingVertical: Spacing.md, paddingHorizontal: Spacing.xxl, borderRadius: BorderRadius.md, backgroundColor: colors.primary500, minWidth: 100, alignItems: 'center' },
    saveBtnText: { color: colors.white, fontWeight: '700', fontSize: FontSize.md },
  });
