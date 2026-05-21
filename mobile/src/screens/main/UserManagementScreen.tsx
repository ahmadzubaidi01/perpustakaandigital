import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, RefreshControl, Modal, ActivityIndicator, Alert, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { usersAPI, regionsAPI } from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import { useTheme } from '../../context/ThemeContext';
import { Spacing, FontSize, BorderRadius } from '../../constants/theme';

export default function UserManagementScreen({ navigation }: any) {
  const { user: currentUser } = useAuthStore();
  const { colors, isDark } = useTheme();
  const styles = getStyles(colors);

  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  // Selector dropdowns
  const [schools, setSchools] = useState<any[]>([]);
  const [districts, setDistricts] = useState<any[]>([]);
  const [regencies, setRegencies] = useState<any[]>([]);

  // Modal form states
  const [showFormModal, setShowFormModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [fullName, setFullName] = useState('');
  const [emailAddress, setEmailAddress] = useState('');
  const [password, setPassword] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [studentIdNumber, setStudentIdNumber] = useState('');
  const [className, setClassName] = useState('');
  const [userRole, setUserRole] = useState('student_member');
  const [selectedSchoolId, setSelectedSchoolId] = useState<number | null>(null);
  const [selectedDistrictId, setSelectedDistrictId] = useState<number | null>(null);
  const [selectedRegencyId, setSelectedRegencyId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  // Dropdown visibility
  const [showRoleDropdown, setShowRoleDropdown] = useState(false);
  const [showSchoolDropdown, setShowSchoolDropdown] = useState(false);
  const [showDistrictDropdown, setShowDistrictDropdown] = useState(false);
  const [showRegencyDropdown, setShowRegencyDropdown] = useState(false);

  // Get active roles options based on Logged-in User RBAC
  const getRoleOptions = () => {
    const role = currentUser?.user_role || '';
    if (role === 'super_admin') {
      return [
        { value: 'super_admin', label: 'Super Admin' },
        { value: 'regency_admin', label: 'Admin Kabupaten' },
        { value: 'district_admin', label: 'Admin Kecamatan' },
        { value: 'school_admin', label: 'Admin Sekolah' },
        { value: 'student_member', label: 'Siswa' }
      ];
    } else if (role === 'regency_admin') {
      return [
        { value: 'regency_admin', label: 'Admin Kabupaten' },
        { value: 'district_admin', label: 'Admin Kecamatan' },
        { value: 'school_admin', label: 'Admin Sekolah' },
        { value: 'student_member', label: 'Siswa' }
      ];
    } else if (role === 'district_admin') {
      return [
        { value: 'district_admin', label: 'Admin Kecamatan' },
        { value: 'school_admin', label: 'Admin Sekolah' },
        { value: 'student_member', label: 'Siswa' }
      ];
    } else if (role === 'school_admin') {
      return [
        { value: 'student_member', label: 'Siswa' }
      ];
    }
    return [];
  };

  // Determine what regional selectors should be active / visible
  const isRegencyVisible = userRole !== 'super_admin' && currentUser?.user_role === 'super_admin';
  const isDistrictVisible = userRole !== 'super_admin' && ['district_admin', 'school_admin', 'student_member'].includes(userRole) && ['super_admin', 'regency_admin'].includes(currentUser?.user_role || '');
  const isSchoolVisible = userRole !== 'super_admin' && ['school_admin', 'student_member'].includes(userRole) && ['super_admin', 'regency_admin', 'district_admin'].includes(currentUser?.user_role || '');

  // Prepopulate locked regional values from currentUser
  useEffect(() => {
    if (!currentUser) return;
    
    if (currentUser.regency_id) {
      setSelectedRegencyId(Number(currentUser.regency_id));
    }
    if (currentUser.district_id) {
      setSelectedDistrictId(Number(currentUser.district_id));
    }
    if (currentUser.school_id) {
      setSelectedSchoolId(Number(currentUser.school_id));
    }
  }, [currentUser, userRole, showFormModal]);

  // Fetch Regencies (Only if super_admin or regency_id is not set)
  useEffect(() => {
    if (currentUser?.user_role === 'super_admin') {
      regionsAPI.listRegencies()
        .then((res) => setRegencies(res.data.data || []))
        .catch(() => {});
    }
  }, [currentUser]);

  // Fetch Districts when Regency changes
  useEffect(() => {
    const regencyId = currentUser?.user_role === 'super_admin' ? selectedRegencyId : currentUser?.regency_id;
    if (!regencyId) {
      setDistricts([]);
      setSchools([]);
      return;
    }

    regionsAPI.listDistricts({ regency_id: regencyId })
      .then((res) => {
        setDistricts(res.data.data || []);
      })
      .catch(() => {});
  }, [selectedRegencyId, currentUser]);

  // Fetch Schools when District changes
  useEffect(() => {
    const districtId = ['super_admin', 'regency_admin'].includes(currentUser?.user_role || '') 
      ? selectedDistrictId 
      : currentUser?.district_id;

    if (!districtId) {
      setSchools([]);
      return;
    }

    regionsAPI.listSchools({ district_id: districtId })
      .then((res) => {
        setSchools(res.data.data || []);
      })
      .catch(() => {});
  }, [selectedDistrictId, currentUser]);

  const fetchUsers = async (reset = false, pageNum?: number) => {
    const p = reset ? 1 : (pageNum !== undefined ? pageNum : page);
    
    if (!reset && (loading || loadingMore || !hasMore)) return;

    if (reset) {
      setLoading(true);
      setHasMore(true);
    } else {
      setLoadingMore(true);
    }

    try {
      const params: any = { page: p, limit: 15 };
      if (search.trim()) params.search = search.trim();
      if (roleFilter !== 'all') params.user_role = roleFilter;
      
      const res = await usersAPI.list(params);
      const list = res.data.data || [];
      const pagination = res.data.metadata?.pagination;
      
      setUsers((prev) => {
        if (reset) return list;
        const merged = [...prev];
        list.forEach((item: any) => {
          if (!merged.some((u) => u.user_id === item.user_id)) {
            merged.push(item);
          }
        });
        return merged;
      });

      if (pagination) {
        setHasMore(pagination.has_next_page);
        setPage(p);
      } else {
        setHasMore(list.length === 15);
        setPage(p);
      }
    } catch (err) {
      Alert.alert('Kesalahan', 'Gagal memuat daftar pengguna');
    } finally {
      setLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchUsers(true);
  }, [roleFilter]);

  useEffect(() => {
    const delay = setTimeout(() => {
      fetchUsers(true);
    }, 450);
    return () => clearTimeout(delay);
  }, [search]);

  const handleOpenForm = (user?: any) => {
    if (user) {
      setSelectedUser(user);
      setFullName(user.full_name || '');
      setEmailAddress(user.email_address || '');
      setPassword('');
      setPhoneNumber(user.phone_number || '');
      setStudentIdNumber(user.student_id_number || '');
      setClassName(user.class_name || '');
      setUserRole(user.user_role || 'student_member');
      setSelectedSchoolId(user.school_id || null);
      setSelectedDistrictId(user.district_id || null);
      setSelectedRegencyId(user.regency_id || null);
    } else {
      setSelectedUser(null);
      setFullName('');
      setEmailAddress('');
      setPassword('');
      setPhoneNumber('');
      setStudentIdNumber('');
      setClassName('');
      
      const options = getRoleOptions();
      if (options.length > 0) {
        // Default to student member if available, or first role option
        const hasMemberOption = options.some(o => o.value === 'student_member');
        setUserRole(hasMemberOption ? 'student_member' : options[0].value);
      } else {
        setUserRole('student_member');
      }

      setSelectedSchoolId(currentUser?.school_id || null);
      setSelectedDistrictId(currentUser?.district_id || null);
      setSelectedRegencyId(currentUser?.regency_id || null);
    }
    
    setShowRoleDropdown(false);
    setShowSchoolDropdown(false);
    setShowDistrictDropdown(false);
    setShowRegencyDropdown(false);
    setShowFormModal(true);
  };

  const handleSave = async () => {
    if (!fullName.trim() || !emailAddress.trim()) {
      Alert.alert('Validasi Gagal', 'Nama lengkap dan alamat email wajib diisi!');
      return;
    }
    if (!selectedUser && !password.trim()) {
      Alert.alert('Validasi Gagal', 'Kata sandi wajib diisi untuk pengguna baru!');
      return;
    }

    if (userRole === 'student_member') {
      if (!studentIdNumber.trim()) {
        Alert.alert('Validasi Gagal', 'Nomor NISN Siswa wajib diisi.');
        return;
      }
      if (!className.trim()) {
        Alert.alert('Validasi Gagal', 'Nama kelas wajib diisi.');
        return;
      }
    }

    // Determine final regional IDs based on lockouts
    const finalRegencyId = currentUser?.user_role === 'super_admin' ? selectedRegencyId : currentUser?.regency_id;
    const finalDistrictId = ['super_admin', 'regency_admin'].includes(currentUser?.user_role || '') ? selectedDistrictId : currentUser?.district_id;
    const finalSchoolId = ['super_admin', 'regency_admin', 'district_admin'].includes(currentUser?.user_role || '') ? selectedSchoolId : currentUser?.school_id;

    if (userRole !== 'super_admin') {
      if (!finalRegencyId) {
        Alert.alert('Validasi Gagal', 'Kabupaten wajib ditentukan.');
        return;
      }
      if (['district_admin', 'school_admin', 'student_member'].includes(userRole) && !finalDistrictId) {
        Alert.alert('Validasi Gagal', 'Kecamatan wajib ditentukan.');
        return;
      }
      if (['school_admin', 'student_member'].includes(userRole) && !finalSchoolId) {
        Alert.alert('Validasi Gagal', 'Sekolah wajib ditentukan.');
        return;
      }
    }

    setSaving(true);
    const payload: any = {
      full_name: fullName.trim(),
      email_address: emailAddress.trim(),
      phone_number: phoneNumber.trim() || null,
      user_role: userRole,
      student_id_number: userRole === 'student_member' ? studentIdNumber.trim() : null,
      class_name: userRole === 'student_member' ? className.trim() : null,
      regency_id: userRole === 'super_admin' ? null : finalRegencyId,
      district_id: ['super_admin', 'regency_admin'].includes(userRole) ? null : finalDistrictId,
      school_id: ['super_admin', 'regency_admin', 'district_admin'].includes(userRole) ? null : finalSchoolId,
    };

    if (password.trim()) {
      payload.password = password.trim();
    }

    try {
      if (selectedUser) {
        await usersAPI.update(selectedUser.user_id, payload);
        Alert.alert('Sukses', 'Profil pengguna berhasil diperbarui!');
      } else {
        await usersAPI.create(payload);
        Alert.alert('Sukses', 'Akun pengguna baru berhasil didaftarkan!');
      }
      setShowFormModal(false);
      fetchUsers(true);
    } catch (err: any) {
      Alert.alert('Gagal Menyimpan', err.response?.data?.message || 'Gagal menyimpan akun pengguna');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (id: number) => {
    Alert.alert('Hapus Pengguna', 'Yakin ingin menghapus akun pengguna ini?', [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Hapus',
        style: 'destructive',
        onPress: async () => {
          try {
            await usersAPI.delete(id);
            Alert.alert('Sukses', 'Akun berhasil dihapus');
            fetchUsers(true);
          } catch (err: any) {
            Alert.alert('Gagal', err.response?.data?.message || 'Gagal menghapus akun pengguna');
          }
        },
      },
    ]);
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'super_admin': return { bg: colors.danger500 + '15', text: colors.danger500, label: 'Super Admin' };
      case 'regency_admin': return { bg: colors.accent500 + '15', text: colors.accent500, label: 'Admin Kab' };
      case 'district_admin': return { bg: colors.info500 + '15', text: colors.info500, label: 'Admin Kec' };
      case 'school_admin': return { bg: colors.primary400 + '15', text: colors.primary400, label: 'Admin Sekolah' };
      default: return { bg: colors.success500 + '15', text: colors.success500, label: 'Siswa / Anggota' };
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Manajemen User</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => handleOpenForm()}>
          <Ionicons name="add-circle" size={26} color={colors.text} />
        </TouchableOpacity>
      </View>

      {/* Role filter bar */}
      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          <TouchableOpacity style={[styles.filterBtn, roleFilter === 'all' && styles.activeFilterBtn]} onPress={() => setRoleFilter('all')}>
            <Text style={[styles.filterText, roleFilter === 'all' && styles.activeFilterText]}>Semua</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.filterBtn, roleFilter === 'student_member' && styles.activeFilterBtn]} onPress={() => setRoleFilter('student_member')}>
            <Text style={[styles.filterText, roleFilter === 'student_member' && styles.activeFilterText]}>Siswa</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.filterBtn, roleFilter === 'school_admin' && styles.activeFilterBtn]} onPress={() => setRoleFilter('school_admin')}>
            <Text style={[styles.filterText, roleFilter === 'school_admin' && styles.activeFilterText]}>Admin Sekolah</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.filterBtn, roleFilter === 'district_admin' && styles.activeFilterBtn]} onPress={() => setRoleFilter('district_admin')}>
            <Text style={[styles.filterText, roleFilter === 'district_admin' && styles.activeFilterText]}>Admin Kecamatan</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.filterBtn, roleFilter === 'regency_admin' && styles.activeFilterBtn]} onPress={() => setRoleFilter('regency_admin')}>
            <Text style={[styles.filterText, roleFilter === 'regency_admin' && styles.activeFilterText]}>Admin Kabupaten</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Search Input */}
      <View style={styles.searchContainer}>
        <Ionicons name="search-outline" size={18} color={colors.surface400} />
        <TextInput
          style={styles.searchInput}
          placeholder="Cari user berdasarkan nama/email/NISN..."
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
        <View style={styles.loadingCenter}>
          <ActivityIndicator size="large" color={colors.primary400} />
          <Text style={styles.loadingText}>Memuat Anggota...</Text>
        </View>
      ) : (
        <FlatList
          data={users}
          keyExtractor={(item, idx) => `user-${item.user_id || idx}-${idx}`}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchUsers(true); }} tintColor={colors.primary400} />}
          renderItem={({ item }) => {
            const badge = getRoleBadgeColor(item.user_role);
            return (
              <View style={styles.card}>
                <View style={styles.avatar}><Text style={styles.avatarText}>{item.full_name?.charAt(0).toUpperCase()}</Text></View>
                <View style={{ flex: 1, gap: 2 }}>
                  <View style={styles.cardHeaderRow}>
                    <Text style={styles.userName} numberOfLines={1}>{item.full_name}</Text>
                    <View style={[styles.roleBadge, { backgroundColor: badge.bg }]}><Text style={[styles.roleBadgeText, { color: badge.text }]}>{badge.label}</Text></View>
                  </View>
                  <Text style={styles.userEmail} numberOfLines={1}>{item.email_address}</Text>
                  {item.student_id_number && <Text style={styles.userSub}>NISN: {item.student_id_number} • Kelas: {item.class_name || '-'}</Text>}
                  <Text style={styles.schoolText} numberOfLines={1}>Sekolah: {item.school?.school_name || '-'}</Text>
                </View>
                <View style={styles.actions}>
                  <TouchableOpacity style={styles.editAction} onPress={() => handleOpenForm(item)}>
                    <Ionicons name="create-outline" size={18} color={colors.accent500} />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.deleteAction} onPress={() => handleDelete(item.user_id)}>
                    <Ionicons name="trash-outline" size={18} color={colors.danger500} />
                  </TouchableOpacity>
                </View>
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="people-outline" size={48} color={colors.surface500} />
              <Text style={styles.emptyText}>Tidak ada akun pengguna ditemukan</Text>
            </View>
          }
          onEndReached={() => {
            if (hasMore && !loadingMore && !loading) {
              fetchUsers(false, page + 1);
            }
          }}
          onEndReachedThreshold={0.3}
        />
      )}

      {/* CRUD Form Modal */}
      <Modal visible={showFormModal} transparent animationType="slide">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          <View style={styles.modalOverlay}>
            <ScrollView contentContainerStyle={styles.modalScroll} keyboardShouldPersistTaps="handled">
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>{selectedUser ? 'Perbarui Akun' : 'Daftarkan Anggota Baru'}</Text>
                
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Nama Lengkap *</Text>
                  <TextInput style={styles.input} placeholder="Nama lengkap sesuai kartu identitas..." placeholderTextColor={colors.surface400} value={fullName} onChangeText={setFullName} />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Alamat Email *</Text>
                  <TextInput style={styles.input} keyboardType="email-address" placeholder="email@sekolah.sch.id..." placeholderTextColor={colors.surface400} value={emailAddress} onChangeText={setEmailAddress} />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Kata Sandi {selectedUser ? '(Kosongkan jika tidak diubah)' : '*'}</Text>
                  <TextInput style={styles.input} secureTextEntry placeholder="Ketik minimal 8 karakter..." placeholderTextColor={colors.surface400} value={password} onChangeText={setPassword} />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Nomor Telepon (Opsional)</Text>
                  <TextInput style={styles.input} keyboardType="phone-pad" placeholder="08xxxxxxxxxx..." placeholderTextColor={colors.surface400} value={phoneNumber} onChangeText={setPhoneNumber} />
                </View>

                {/* Roles Dropdown */}
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Peran Hak Akses (Role) *</Text>
                  <TouchableOpacity style={styles.dropdownHeader} onPress={() => setShowRoleDropdown(!showRoleDropdown)}>
                    <Text style={styles.dropdownText}>{getRoleBadgeColor(userRole).label}</Text>
                    <Ionicons name={showRoleDropdown ? 'chevron-up' : 'chevron-down'} size={18} color={colors.text} />
                  </TouchableOpacity>
                  {showRoleDropdown && (
                    <ScrollView nestedScrollEnabled={true} style={styles.dropdownList}>
                      {getRoleOptions().map((opt) => (
                        <TouchableOpacity
                          key={opt.value}
                          style={[styles.dropdownItem, userRole === opt.value && styles.activeItem]}
                          onPress={() => {
                            setUserRole(opt.value);
                            setShowRoleDropdown(false);
                          }}
                        >
                          <Text style={styles.dropdownItemText}>{opt.label}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  )}
                </View>

                {/* Student Fields */}
                {userRole === 'student_member' && (
                  <>
                    <View style={styles.inputGroup}>
                      <Text style={styles.label}>Nomor NISN Siswa *</Text>
                      <TextInput style={styles.input} keyboardType="number-pad" placeholder="Ketik NISN siswa..." placeholderTextColor={colors.surface400} value={studentIdNumber} onChangeText={setStudentIdNumber} />
                    </View>
                    <View style={styles.inputGroup}>
                      <Text style={styles.label}>Nama Kelas *</Text>
                      <TextInput style={styles.input} placeholder="Contoh: XII MIPA 2, X IPS 1..." placeholderTextColor={colors.surface400} value={className} onChangeText={setClassName} />
                    </View>
                  </>
                )}

                {/* Regency Dropdown */}
                {isRegencyVisible && (
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Kabupaten Terikat *</Text>
                    <TouchableOpacity style={styles.dropdownHeader} onPress={() => setShowRegencyDropdown(!showRegencyDropdown)}>
                      <Text style={styles.dropdownText}>
                        {regencies.find((re) => re.regency_id === selectedRegencyId)?.regency_name || 'Pilih Kabupaten/Kota'}
                      </Text>
                      <Ionicons name={showRegencyDropdown ? 'chevron-up' : 'chevron-down'} size={18} color={colors.text} />
                    </TouchableOpacity>
                    {showRegencyDropdown && (
                      <ScrollView nestedScrollEnabled={true} style={styles.dropdownList}>
                        <TouchableOpacity
                          style={[styles.dropdownItem, !selectedRegencyId && styles.activeItem]}
                          onPress={() => {
                            setSelectedRegencyId(null);
                            setShowRegencyDropdown(false);
                          }}
                        >
                          <Text style={styles.dropdownItemText}>Pilih Kabupaten</Text>
                        </TouchableOpacity>
                        {regencies.map((re, index) => (
                          <TouchableOpacity
                            key={`regency-${re.regency_id || index}-${index}`}
                            style={[styles.dropdownItem, selectedRegencyId === re.regency_id && styles.activeItem]}
                            onPress={() => {
                              setSelectedRegencyId(re.regency_id);
                              setShowRegencyDropdown(false);
                            }}
                          >
                            <Text style={styles.dropdownItemText}>{re.regency_name}</Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    )}
                  </View>
                )}

                {/* District Dropdown */}
                {isDistrictVisible && (
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Kecamatan Terikat *</Text>
                    <TouchableOpacity style={styles.dropdownHeader} onPress={() => setShowDistrictDropdown(!showDistrictDropdown)}>
                      <Text style={styles.dropdownText}>
                        {districts.find((di) => di.district_id === selectedDistrictId)?.district_name || 'Pilih Kecamatan'}
                      </Text>
                      <Ionicons name={showDistrictDropdown ? 'chevron-up' : 'chevron-down'} size={18} color={colors.text} />
                    </TouchableOpacity>
                    {showDistrictDropdown && (
                      <ScrollView nestedScrollEnabled={true} style={styles.dropdownList}>
                        <TouchableOpacity
                          style={[styles.dropdownItem, !selectedDistrictId && styles.activeItem]}
                          onPress={() => {
                            setSelectedDistrictId(null);
                            setShowDistrictDropdown(false);
                          }}
                        >
                          <Text style={styles.dropdownItemText}>Pilih Kecamatan</Text>
                        </TouchableOpacity>
                        {districts.map((di, index) => (
                          <TouchableOpacity
                            key={`district-${di.district_id || index}-${index}`}
                            style={[styles.dropdownItem, selectedDistrictId === di.district_id && styles.activeItem]}
                            onPress={() => {
                              setSelectedDistrictId(di.district_id);
                              setShowDistrictDropdown(false);
                            }}
                          >
                            <Text style={styles.dropdownItemText}>{di.district_name}</Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    )}
                  </View>
                )}

                {/* School Dropdown */}
                {isSchoolVisible && (
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Sekolah Terkait *</Text>
                    <TouchableOpacity style={styles.dropdownHeader} onPress={() => setShowSchoolDropdown(!showSchoolDropdown)}>
                      <Text style={styles.dropdownText}>
                        {schools.find((sc) => sc.school_id === selectedSchoolId)?.school_name || 'Pilih Sekolah'}
                      </Text>
                      <Ionicons name={showSchoolDropdown ? 'chevron-up' : 'chevron-down'} size={18} color={colors.text} />
                    </TouchableOpacity>
                    {showSchoolDropdown && (
                      <ScrollView nestedScrollEnabled={true} style={styles.dropdownList}>
                        <TouchableOpacity
                          style={[styles.dropdownItem, !selectedSchoolId && styles.activeItem]}
                          onPress={() => {
                            setSelectedSchoolId(null);
                            setShowSchoolDropdown(false);
                          }}
                        >
                          <Text style={styles.dropdownItemText}>Pilih Sekolah</Text>
                        </TouchableOpacity>
                        {schools.map((sc, index) => (
                          <TouchableOpacity
                            key={`school-${sc.school_id || index}-${index}`}
                            style={[styles.dropdownItem, selectedSchoolId === sc.school_id && styles.activeItem]}
                            onPress={() => {
                              setSelectedSchoolId(sc.school_id);
                              setShowSchoolDropdown(false);
                            }}
                          >
                            <Text style={styles.dropdownItemText}>{sc.school_name}</Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    )}
                  </View>
                )}

                <View style={styles.modalActions}>
                  <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowFormModal(false)}>
                    <Text style={styles.cancelBtnText}>Batal</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
                    {saving ? <ActivityIndicator size="small" color={colors.white} /> : <Text style={styles.saveBtnText}>Simpan</Text>}
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
    filterScroll: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, gap: Spacing.sm },
    filterBtn: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, borderRadius: BorderRadius.full, backgroundColor: colors.surface800, borderWidth: 1, borderColor: colors.surface600 },
    activeFilterBtn: { backgroundColor: colors.primary500, borderColor: colors.primary500 },
    filterText: { fontSize: FontSize.xs, fontWeight: '700', color: colors.textMuted },
    activeFilterText: { color: colors.white },
    searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface800, marginHorizontal: Spacing.lg, marginBottom: Spacing.md, borderRadius: BorderRadius.lg, paddingHorizontal: Spacing.md, height: 44, borderWidth: 1, borderColor: colors.surface600 },
    searchInput: { flex: 1, color: colors.text, fontSize: FontSize.sm, marginLeft: Spacing.sm },
    loadingCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl },
    loadingText: { fontSize: FontSize.sm, color: colors.textMuted, marginTop: Spacing.md },
    list: { padding: Spacing.lg, paddingBottom: 40 },
    card: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface800, padding: Spacing.md, borderRadius: BorderRadius.xl, marginBottom: Spacing.sm, borderWidth: 1, borderColor: colors.surface600, gap: Spacing.md },
    avatar: { width: 44, height: 44, borderRadius: BorderRadius.md, backgroundColor: colors.primary500, alignItems: 'center', justifyContent: 'center' },
    avatarText: { fontSize: FontSize.lg, fontWeight: '800', color: colors.white },
    cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: Spacing.sm, flex: 1 },
    userName: { fontSize: FontSize.md, fontWeight: '800', color: colors.text, flex: 1 },
    roleBadge: { paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: BorderRadius.sm, alignSelf: 'flex-start' },
    roleBadgeText: { fontSize: 10, fontWeight: '700' },
    userEmail: { fontSize: FontSize.xs, color: colors.textMuted },
    userSub: { fontSize: 10, color: colors.accent500, marginTop: 2 },
    schoolText: { fontSize: 10, color: colors.textMuted, marginTop: 1 },
    actions: { flexDirection: 'column', gap: Spacing.md, paddingLeft: 4 },
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
    input: { height: 46, backgroundColor: colors.surface900, borderWidth: 1, borderColor: colors.surface600, borderRadius: BorderRadius.md, color: colors.text, paddingHorizontal: Spacing.md, fontSize: FontSize.md },
    dropdownHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', height: 46, backgroundColor: colors.surface900, borderWidth: 1, borderColor: colors.surface600, borderRadius: BorderRadius.md, paddingHorizontal: Spacing.md },
    dropdownText: { color: colors.text, fontSize: FontSize.md },
    dropdownList: { backgroundColor: colors.surface900, borderRadius: BorderRadius.md, padding: Spacing.xs, maxHeight: 150, overflow: 'hidden', borderWidth: 1, borderColor: colors.surface600 },
    dropdownItem: { padding: Spacing.md, borderRadius: BorderRadius.sm },
    activeItem: { backgroundColor: colors.primary500 + '20' },
    dropdownItemText: { color: colors.text, fontSize: FontSize.sm },
    modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.md, marginTop: Spacing.lg },
    cancelBtn: { paddingVertical: Spacing.md, paddingHorizontal: Spacing.xl, borderRadius: BorderRadius.md, backgroundColor: colors.surface700 },
    cancelBtnText: { color: colors.white, fontWeight: '700', fontSize: FontSize.md },
    saveBtn: { paddingVertical: Spacing.md, paddingHorizontal: Spacing.xxl, borderRadius: BorderRadius.md, backgroundColor: colors.primary500, minWidth: 100, alignItems: 'center' },
    saveBtnText: { color: colors.white, fontWeight: '700', fontSize: FontSize.md },
  });
