import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, RefreshControl, Modal, ActivityIndicator, Alert, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Spacing, FontSize, BorderRadius } from '../../constants/theme';
import { regionsAPI } from '../../services/api';
import { useTheme } from '../../context/ThemeContext';

export default function SchoolManagementScreen({ navigation }: any) {
  const { colors } = useTheme();
  const s = getStyles(colors);

  const [schools, setSchools] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  // Dropdown lists
  const [districts, setDistricts] = useState<any[]>([]);
  const [regencies, setRegencies] = useState<any[]>([]);

  // Modal forms
  const [showFormModal, setShowFormModal] = useState(false);
  const [selectedSchool, setSelectedSchool] = useState<any>(null);
  const [schoolName, setSchoolName] = useState('');
  const [schoolAddress, setSchoolAddress] = useState('');
  const [selectedDistrictId, setSelectedDistrictId] = useState<number | null>(null);
  const [selectedRegencyId, setSelectedRegencyId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  // Selector toggles
  const [showDistrictDropdown, setShowDistrictDropdown] = useState(false);
  const [showRegencyDropdown, setShowRegencyDropdown] = useState(false);

  const fetchDropdowns = async () => {
    try {
      const [distRes, regRes] = await Promise.all([
        regionsAPI.listDistricts(),
        regionsAPI.listRegencies(),
      ]);
      setDistricts(distRes.data.data || []);
      setRegencies(regRes.data.data || []);
    } catch {}
  };

  const fetchSchools = async (reset = false, pageNum?: number) => {
    const p = reset ? 1 : (pageNum !== undefined ? pageNum : page);
    
    if (!reset && (loading || loadingMore || !hasMore)) return;

    if (reset) {
      setLoading(true);
      setHasMore(true);
    } else {
      setLoadingMore(true);
    }

    try {
      const params: any = { page: p, limit: 20 };
      if (search.trim()) params.search = search.trim();
      const res = await regionsAPI.listSchools(params);
      const list = res.data.data || [];
      const pagination = res.data.metadata?.pagination;

      setSchools((prev) => {
        if (reset) return list;
        const merged = [...prev];
        list.forEach((item: any) => {
          if (!merged.some((sc) => sc.school_id === item.school_id)) {
            merged.push(item);
          }
        });
        return merged;
      });

      if (pagination) {
        setHasMore(pagination.has_next_page);
        setPage(p);
      } else {
        setHasMore(list.length === 20);
        setPage(p);
      }
    } catch (err) {
      Alert.alert('Kesalahan', 'Gagal memuat daftar sekolah regional');
    } finally {
      setLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchSchools(true);
    const unsubscribe = navigation?.addListener('focus', () => {
      fetchSchools(true);
    });
    return unsubscribe;
  }, [navigation]);

  useEffect(() => {
    if (search === '') return;
    const delay = setTimeout(() => {
      fetchSchools(true);
    }, 400);
    return () => clearTimeout(delay);
  }, [search]);

  const handleOpenForm = (school?: any) => {
    fetchDropdowns();
    if (school) {
      setSelectedSchool(school);
      setSchoolName(school.school_name);
      setSchoolAddress(school.school_address);
      setSelectedDistrictId(school.district_id);
      setSelectedRegencyId(school.regency_id);
    } else {
      setSelectedSchool(null);
      setSchoolName('');
      setSchoolAddress('');
      setSelectedDistrictId(districts[0]?.district_id || null);
      setSelectedRegencyId(regencies[0]?.regency_id || null);
    }
    setShowFormModal(true);
  };

  const handleSave = async () => {
    if (!schoolName.trim() || !schoolAddress.trim() || !selectedDistrictId) {
      Alert.alert('Validasi Gagal', 'Nama, alamat, dan kecamatan wajib diisi!');
      return;
    }
    setSaving(true);
    const payload = {
      school_name: schoolName.trim(),
      school_address: schoolAddress.trim(),
      district_id: selectedDistrictId,
      regency_id: selectedRegencyId || undefined,
    };
    try {
      if (selectedSchool) {
        await regionsAPI.updateSchool(selectedSchool.school_id, payload);
        Alert.alert('Sukses', 'Profil sekolah berhasil diperbarui!');
      } else {
        await regionsAPI.createSchool(payload);
        Alert.alert('Sukses', 'Sekolah baru berhasil terdaftar!');
      }
      setShowFormModal(false);
      fetchSchools(true);
    } catch (err: any) {
      Alert.alert('Gagal Menyimpan', err.response?.data?.message || 'Gagal memproses pendaftaran sekolah');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (id: number) => {
    Alert.alert('Hapus Sekolah', 'Yakin ingin menghapus data sekolah ini?', [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Hapus',
        style: 'destructive',
        onPress: async () => {
          try {
            await regionsAPI.deleteSchool(id);
            Alert.alert('Sukses', 'Sekolah berhasil dihapus');
            fetchSchools(true);
          } catch (err: any) {
            Alert.alert('Gagal', err.response?.data?.message || 'Gagal menghapus data sekolah');
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Manajemen Sekolah</Text>
        <TouchableOpacity style={s.addBtn} onPress={() => handleOpenForm()}>
          <Ionicons name="add-circle" size={26} color={colors.primary400} />
        </TouchableOpacity>
      </View>

      <View style={s.searchContainer}>
        <Ionicons name="search-outline" size={18} color={colors.surface400} />
        <TextInput
          style={s.searchInput}
          placeholder="Cari sekolah berdasarkan nama..."
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

      {loading ? (
        <View style={s.loadingCenter}>
          <ActivityIndicator size="large" color={colors.primary400} />
          <Text style={s.loadingText}>Memuat Sekolah...</Text>
        </View>
      ) : (
        <FlatList
          data={schools}
          keyExtractor={(item, idx) => `school-${item.school_id || idx}-${idx}`}
          contentContainerStyle={s.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchSchools(true); }} tintColor={colors.primary400} />}
          renderItem={({ item }) => (
            <View style={s.card}>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={s.schoolName}>{item.school_name}</Text>
                <Text style={s.schoolAddress} numberOfLines={2}>Alamat: {item.school_address}</Text>
                <View style={s.badgeRow}>
                  {item.district?.district_name && (
                    <View style={s.tag}><Text style={s.tagText}>Kec. {item.district.district_name}</Text></View>
                  )}
                  {item.regency?.regency_name && (
                    <View style={[s.tag, { backgroundColor: colors.accent400 + '15' }]}><Text style={[s.tagText, { color: colors.accent400 }]}>{item.regency.regency_name}</Text></View>
                  )}
                </View>
              </View>
              <View style={s.actions}>
                <TouchableOpacity style={s.editAction} onPress={() => handleOpenForm(item)}>
                  <Ionicons name="create-outline" size={18} color={colors.accent400} />
                </TouchableOpacity>
                <TouchableOpacity style={s.deleteAction} onPress={() => handleDelete(item.school_id)}>
                  <Ionicons name="trash-outline" size={18} color={colors.danger500} />
                </TouchableOpacity>
              </View>
            </View>
          )}
          ListEmptyComponent={
            <View style={s.empty}>
              <Ionicons name="business-outline" size={48} color={colors.surface500} />
              <Text style={s.emptyText}>Tidak ada sekolah regional terdaftar</Text>
            </View>
          }
          onEndReached={() => {
            if (hasMore && !loadingMore && !loading) {
              fetchSchools(false, page + 1);
            }
          }}
          onEndReachedThreshold={0.3}
        />
      )}

      {/* CRUD Form Modal */}
      <Modal visible={showFormModal} transparent animationType="fade">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          <View style={s.modalOverlay}>
            <ScrollView contentContainerStyle={s.modalScroll} keyboardShouldPersistTaps="handled">
              <View style={s.modalContent}>
                <Text style={s.modalTitle}>{selectedSchool ? 'Edit Sekolah' : 'Registrasi Sekolah'}</Text>
                
                <View style={s.inputGroup}>
                  <Text style={s.label}>Nama Sekolah</Text>
                  <TextInput
                    style={s.input}
                    placeholder="Contoh: SMA Negeri 1 Regional..."
                    placeholderTextColor={colors.surface400}
                    value={schoolName}
                    onChangeText={setSchoolName}
                  />
                </View>

                <View style={s.inputGroup}>
                  <Text style={s.label}>Alamat Fisik</Text>
                  <TextInput
                    style={[s.input, { height: 80 }]}
                    multiline
                    placeholder="Ketik alamat lengkap sekolah..."
                    placeholderTextColor={colors.surface400}
                    value={schoolAddress}
                    onChangeText={setSchoolAddress}
                  />
                </View>

                {/* District Dropdown Selector */}
                <View style={s.inputGroup}>
                  <Text style={s.label}>Kecamatan</Text>
                  <TouchableOpacity style={s.dropdownHeader} onPress={() => setShowDistrictDropdown(!showDistrictDropdown)}>
                    <Text style={s.dropdownText}>
                      {districts.find((d) => d.district_id === selectedDistrictId)?.district_name || 'Pilih Kecamatan'}
                    </Text>
                    <Ionicons name={showDistrictDropdown ? 'chevron-up' : 'chevron-down'} size={18} color={colors.text} />
                  </TouchableOpacity>
                  {showDistrictDropdown && (
                    <ScrollView nestedScrollEnabled={true} style={s.dropdownList}>
                      {districts.map((d, idx) => (
                        <TouchableOpacity
                          key={`district-${d.district_id || idx}-${idx}`}
                          style={[s.dropdownItem, selectedDistrictId === d.district_id && s.activeItem]}
                          onPress={() => {
                            setSelectedDistrictId(d.district_id);
                            setShowDistrictDropdown(false);
                          }}
                        >
                          <Text style={s.dropdownItemText}>{d.district_name}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  )}
                </View>

                {/* Regency Dropdown Selector */}
                <View style={s.inputGroup}>
                  <Text style={s.label}>Kabupaten / Kota</Text>
                  <TouchableOpacity style={s.dropdownHeader} onPress={() => setShowRegencyDropdown(!showRegencyDropdown)}>
                    <Text style={s.dropdownText}>
                      {regencies.find((r) => r.regency_id === selectedRegencyId)?.regency_name || 'Pilih Kabupaten (Opsional)'}
                    </Text>
                    <Ionicons name={showRegencyDropdown ? 'chevron-up' : 'chevron-down'} size={18} color={colors.text} />
                  </TouchableOpacity>
                  {showRegencyDropdown && (
                    <ScrollView nestedScrollEnabled={true} style={s.dropdownList}>
                      <TouchableOpacity
                        style={[s.dropdownItem, !selectedRegencyId && s.activeItem]}
                        onPress={() => {
                          setSelectedRegencyId(null);
                          setShowRegencyDropdown(false);
                        }}
                      >
                        <Text style={s.dropdownItemText}>Tidak Ada (Kosongkan)</Text>
                      </TouchableOpacity>
                      {regencies.map((r, idx) => (
                        <TouchableOpacity
                          key={`regency-${r.regency_id || idx}-${idx}`}
                          style={[s.dropdownItem, selectedRegencyId === r.regency_id && s.activeItem]}
                          onPress={() => {
                            setSelectedRegencyId(r.regency_id);
                            setShowRegencyDropdown(false);
                          }}
                        >
                          <Text style={s.dropdownItemText}>{r.regency_name}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  )}
                </View>

                <View style={s.modalActions}>
                  <TouchableOpacity style={s.cancelBtn} onPress={() => setShowFormModal(false)}>
                    <Text style={s.cancelBtnText}>Batal</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={s.saveBtn} onPress={handleSave} disabled={saving}>
                    {saving ? <ActivityIndicator size="small" color={colors.white} /> : <Text style={s.saveBtnText}>{selectedSchool ? 'Simpan' : 'Registrasi'}</Text>}
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>
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
    card: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface800, padding: Spacing.lg, borderRadius: BorderRadius.xl, marginBottom: Spacing.sm, borderWidth: 1, borderColor: colors.surface600 },
    schoolName: { fontSize: FontSize.md, fontWeight: '800', color: colors.text },
    schoolAddress: { fontSize: FontSize.xs, color: colors.textMuted, marginTop: 2 },
    badgeRow: { flexDirection: 'row', gap: Spacing.xs, marginTop: Spacing.sm },
    tag: { paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: BorderRadius.sm, backgroundColor: colors.primary500 + '15' },
    tagText: { fontSize: FontSize.xs, fontWeight: '700', color: colors.primary400 },
    actions: { flexDirection: 'column', gap: Spacing.md, marginLeft: Spacing.md },
    editAction: { padding: 4 },
    deleteAction: { padding: 4 },
    empty: { alignItems: 'center', paddingVertical: 80, gap: Spacing.md },
    emptyText: { fontSize: FontSize.md, color: colors.textMuted, textAlign: 'center' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(11, 17, 32, 0.8)', justifyContent: 'center' },
    modalScroll: { paddingVertical: 40, paddingHorizontal: Spacing.xl, justifyContent: 'center' },
    modalContent: { backgroundColor: colors.surface800, borderRadius: BorderRadius.xl, padding: Spacing.xl, borderWidth: 1, borderColor: colors.surface600, gap: Spacing.lg },
    modalTitle: { fontSize: FontSize.lg, fontWeight: '800', color: colors.text },
    inputGroup: { gap: Spacing.sm },
    label: { fontSize: FontSize.xs, fontWeight: '700', color: colors.textMuted },
    input: { height: 46, backgroundColor: colors.surface700, borderWidth: 1, borderColor: colors.surface600, borderRadius: BorderRadius.md, color: colors.text, paddingHorizontal: Spacing.md, fontSize: FontSize.md },
    dropdownHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', height: 46, backgroundColor: colors.surface700, borderWidth: 1, borderColor: colors.surface600, borderRadius: BorderRadius.md, paddingHorizontal: Spacing.md },
    dropdownText: { color: colors.text, fontSize: FontSize.md },
    dropdownList: { backgroundColor: colors.surface700, borderRadius: BorderRadius.md, padding: Spacing.xs, maxHeight: 150, overflow: 'hidden', borderWidth: 1, borderColor: colors.surface600 },
    dropdownItem: { padding: Spacing.md, borderRadius: BorderRadius.sm },
    activeItem: { backgroundColor: colors.primary500 + '20' },
    dropdownItemText: { color: colors.text, fontSize: FontSize.sm },
    modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.md, marginTop: Spacing.lg },
    cancelBtn: { paddingVertical: Spacing.md, paddingHorizontal: Spacing.xl, borderRadius: BorderRadius.md, backgroundColor: colors.surface700 },
    cancelBtnText: { color: colors.text, fontWeight: '700', fontSize: FontSize.md },
    saveBtn: { paddingVertical: Spacing.md, paddingHorizontal: Spacing.xxl, borderRadius: BorderRadius.md, backgroundColor: colors.primary500, minWidth: 100, alignItems: 'center' },
    saveBtnText: { color: colors.white, fontWeight: '700', fontSize: FontSize.md },
  });
