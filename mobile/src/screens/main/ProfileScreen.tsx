import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView, RefreshControl, TextInput, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../store/authStore';
import { authAPI, usersAPI } from '../../services/api';
import { useTheme } from '../../context/ThemeContext';
import { Spacing, FontSize, BorderRadius } from '../../constants/theme';
import * as SecureStore from 'expo-secure-store';

export default function ProfileScreen({ navigation }: any) {
  const { user, setUser, logout } = useAuthStore();
  const { colors, isDark } = useTheme();
  const styles = getStyles(colors, isDark);

  const [refreshing, setRefreshing] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState<'profile' | 'password'>('profile');
  const [saving, setSaving] = useState(false);

  // Forms states
  const [fullName, setFullName] = useState(user?.full_name || '');
  const [phoneNumber, setPhoneNumber] = useState(user?.phone_number || '');
  const [className, setClassName] = useState(user?.class_name || '');

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Sync state with user when screen mounts or user changes
  useEffect(() => {
    if (user) {
      setFullName(user.full_name || '');
      setPhoneNumber(user.phone_number || '');
      setClassName(user.class_name || '');
    }
  }, [user, isEditing]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const res = await authAPI.getProfile();
      if (res.data.data) {
        setUser(res.data.data);
      }
    } catch (err) {
      console.warn('Gagal memuat profil terbaru.');
    } finally {
      setRefreshing(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('Keluar', 'Yakin ingin keluar dari akun?', [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Keluar',
        style: 'destructive',
        onPress: async () => {
          try {
            const rt = await SecureStore.getItemAsync('refresh_token');
            await authAPI.logout(rt || undefined);
          } catch {}
          await logout();
        },
      },
    ]);
  };

  const handleSaveProfile = async () => {
    if (!fullName.trim()) {
      Alert.alert('Validasi Gagal', 'Nama lengkap tidak boleh kosong.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        full_name: fullName.trim(),
        phone_number: phoneNumber.trim() || null,
        class_name: user?.user_role === 'student_member' ? className.trim() || null : undefined,
      };

      const res = await usersAPI.updateProfile(payload);
      if (res.data.data) {
        setUser({ ...user!, ...res.data.data });
        Alert.alert('Sukses', 'Profil Anda berhasil diperbarui!');
        setIsEditing(false);
      }
    } catch (err: any) {
      Alert.alert('Gagal', err.response?.data?.message || 'Gagal memperbarui profil.');
    } finally {
      setSaving(false);
    }
  };

  const handleSavePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      Alert.alert('Validasi Gagal', 'Harap isi semua kolom kata sandi.');
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert('Validasi Gagal', 'Konfirmasi kata sandi baru tidak cocok.');
      return;
    }

    if (newPassword.length < 8) {
      Alert.alert('Validasi Gagal', 'Sandi baru minimal harus 8 karakter.');
      return;
    }

    setSaving(true);
    try {
      await usersAPI.changePassword({
        current_password: currentPassword,
        new_password: newPassword,
      });

      Alert.alert('Sukses', 'Kata sandi Anda berhasil diperbarui!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setIsEditing(false);
    } catch (err: any) {
      Alert.alert('Gagal', err.response?.data?.message || 'Gagal memperbarui kata sandi.');
    } finally {
      setSaving(false);
    }
  };

  const getDynamicRoleLabel = (u: any): string => {
    if (!u) return '';
    if (u.user_role === 'school_admin' && u.school?.school_name) {
      return `Admin ${u.school.school_name}`;
    }
    if (u.user_role === 'regency_admin' && u.regency?.regency_name) {
      return `Admin ${u.regency.regency_name}`;
    }
    if (u.user_role === 'district_admin' && u.district?.district_name) {
      return `Admin Kecamatan ${u.district.district_name}`;
    }
    const roleLabelsMap: Record<string, string> = {
      super_admin: 'Super Admin',
      regency_admin: 'Admin Kabupaten',
      district_admin: 'Admin Kecamatan',
      school_admin: 'Admin Sekolah',
      student_member: 'Anggota Siswa',
    };
    return roleLabelsMap[u.user_role] || u.user_role || '';
  };

  const Info = ({ icon, label, value }: { icon: string; label: string; value: string }) => (
    <View style={styles.infoRow}>
      <Ionicons name={icon as any} size={20} color={colors.surface400} />
      <View style={{ flex: 1 }}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value || '-'}</Text>
      </View>
    </View>
  );

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        !isEditing ? (
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary400} />
        ) : undefined
      }
      keyboardShouldPersistTaps="handled"
    >
      {/* Avatar & Header */}
      <View style={styles.avatarSection}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{user?.full_name?.charAt(0)?.toUpperCase()}</Text>
        </View>
        <Text style={styles.name}>{user?.full_name}</Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{getDynamicRoleLabel(user)}</Text>
        </View>
      </View>

      {!isEditing ? (
        // VIEW MODE
        <View style={{ gap: Spacing.lg }}>
          <View style={styles.card}>
            <Info icon="mail-outline" label="Email" value={user?.email_address || ''} />
            <Info icon="school-outline" label="Sekolah" value={user?.school?.school_name || '-'} />
            <Info icon="card-outline" label="NISN" value={user?.student_id_number || '-'} />
            <Info icon="people-outline" label="Kelas" value={user?.class_name || '-'} />
            {user?.phone_number && <Info icon="call-outline" label="Telepon" value={user?.phone_number} />}
          </View>

          {/* Action buttons */}
          <TouchableOpacity style={styles.editBtn} onPress={() => setIsEditing(true)} activeOpacity={0.8}>
            <Ionicons name="create-outline" size={20} color={colors.white} />
            <Text style={styles.editBtnText}>Edit Profil & Password</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.8}>
            <Ionicons name="log-out-outline" size={20} color={colors.danger500} />
            <Text style={styles.logoutText}>Keluar dari Akun</Text>
          </TouchableOpacity>
        </View>
      ) : (
        // EDIT MODE
        <View style={{ gap: Spacing.lg }}>
          {/* Custom Edit Tab bar */}
          <View style={styles.tabContainer}>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'profile' && styles.activeTab]}
              onPress={() => setActiveTab('profile')}
            >
              <Text style={[styles.tabText, activeTab === 'profile' && styles.activeTabText]}>Ubah Profil</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tab, activeTab === 'password' && styles.activeTab]}
              onPress={() => setActiveTab('password')}
            >
              <Text style={[styles.tabText, activeTab === 'password' && styles.activeTabText]}>Kata Sandi</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.card}>
            {activeTab === 'profile' ? (
              // EDIT PROFILE FORM
              <View style={{ gap: Spacing.md }}>
                <View>
                  <Text style={styles.fieldLabel}>Nama Lengkap</Text>
                  <TextInput
                    style={styles.textInput}
                    value={fullName}
                    onChangeText={setFullName}
                    placeholder="Nama Lengkap"
                    placeholderTextColor={colors.textMuted}
                    editable={!saving}
                  />
                </View>

                <View>
                  <Text style={styles.fieldLabel}>Email (Terkunci)</Text>
                  <TextInput
                    style={[styles.textInput, styles.disabledInput]}
                    value={user?.email_address || ''}
                    editable={false}
                  />
                </View>

                <View>
                  <Text style={styles.fieldLabel}>Nomor Telepon</Text>
                  <TextInput
                    style={styles.textInput}
                    value={phoneNumber}
                    onChangeText={setPhoneNumber}
                    placeholder="Contoh: 08123456789"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="phone-pad"
                    editable={!saving}
                  />
                </View>

                {user?.user_role === 'student_member' && (
                  <View>
                    <Text style={styles.fieldLabel}>Kelas</Text>
                    <TextInput
                      style={styles.textInput}
                      value={className}
                      onChangeText={setClassName}
                      placeholder="Contoh: XII IPA 1"
                      placeholderTextColor={colors.textMuted}
                      editable={!saving}
                    />
                  </View>
                )}
              </View>
            ) : (
              // EDIT PASSWORD FORM
              <View style={{ gap: Spacing.md }}>
                <View>
                  <Text style={styles.fieldLabel}>Kata Sandi Saat Ini</Text>
                  <TextInput
                    style={styles.textInput}
                    value={currentPassword}
                    onChangeText={setCurrentPassword}
                    placeholder="Kata Sandi Saat Ini"
                    placeholderTextColor={colors.textMuted}
                    secureTextEntry
                    editable={!saving}
                  />
                </View>

                <View>
                  <Text style={styles.fieldLabel}>Kata Sandi Baru</Text>
                  <TextInput
                    style={styles.textInput}
                    value={newPassword}
                    onChangeText={setNewPassword}
                    placeholder="Minimal 8 karakter"
                    placeholderTextColor={colors.textMuted}
                    secureTextEntry
                    editable={!saving}
                  />
                </View>

                <View>
                  <Text style={styles.fieldLabel}>Konfirmasi Kata Sandi Baru</Text>
                  <TextInput
                    style={styles.textInput}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    placeholder="Konfirmasi kata sandi"
                    placeholderTextColor={colors.textMuted}
                    secureTextEntry
                    editable={!saving}
                  />
                </View>
              </View>
            )}
          </View>

          {/* Form Action buttons */}
          <View style={styles.formActions}>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => {
                setIsEditing(false);
                setCurrentPassword('');
                setNewPassword('');
                setConfirmPassword('');
              }}
              disabled={saving}
            >
              <Text style={styles.cancelBtnText}>Batal</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.saveBtn}
              onPress={activeTab === 'profile' ? handleSaveProfile : handleSavePassword}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color={colors.white} size="small" />
              ) : (
                <>
                  <Ionicons name="save-outline" size={18} color={colors.white} />
                  <Text style={styles.saveBtnText}>Simpan</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const getStyles = (colors: any, isDark: boolean) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.surface900 },
    content: { padding: Spacing.lg },
    avatarSection: { alignItems: 'center', paddingVertical: Spacing.md },
    avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: colors.primary500, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.md },
    avatarText: { fontSize: FontSize.title, fontWeight: '800', color: colors.white },
    name: { fontSize: FontSize.xl, fontWeight: '800', color: colors.text },
    badge: { backgroundColor: colors.primary500 + '20', paddingHorizontal: Spacing.md, paddingVertical: 4, borderRadius: BorderRadius.full, marginTop: Spacing.sm },
    badgeText: { fontSize: FontSize.sm, fontWeight: '700', color: colors.primary400 },
    
    card: { backgroundColor: colors.surface800, borderRadius: BorderRadius.xl, padding: Spacing.lg, borderWidth: 1, borderColor: colors.surface600, gap: Spacing.lg },
    infoRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
    infoLabel: { fontSize: FontSize.xs, fontWeight: '700', color: colors.textMuted, letterSpacing: 0.5 },
    infoValue: { fontSize: FontSize.md, fontWeight: '600', color: colors.text, marginTop: 2 },
    
    editBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, backgroundColor: colors.primary500, borderRadius: BorderRadius.lg, padding: Spacing.lg, marginTop: Spacing.md },
    editBtnText: { fontSize: FontSize.md, fontWeight: '700', color: colors.white },
    
    logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, backgroundColor: colors.danger500 + '15', borderRadius: BorderRadius.lg, padding: Spacing.lg, borderWidth: 1, borderColor: colors.danger500 + '30' },
    logoutText: { fontSize: FontSize.md, fontWeight: '700', color: colors.danger500 },

    // Edit view styles
    tabContainer: { flexDirection: 'row', backgroundColor: colors.surface800, borderRadius: BorderRadius.lg, padding: 4, borderWidth: 1, borderColor: colors.surface600 },
    tab: { flex: 1, paddingVertical: Spacing.md, alignItems: 'center', borderRadius: BorderRadius.md },
    activeTab: { backgroundColor: colors.surface900 },
    tabText: { fontSize: FontSize.sm, fontWeight: '700', color: colors.textMuted },
    activeTabText: { color: colors.text },

    fieldLabel: { fontSize: FontSize.xs, fontWeight: '700', color: colors.text, marginBottom: Spacing.xs, letterSpacing: 0.5 },
    textInput: { height: 48, backgroundColor: colors.surface900, borderRadius: BorderRadius.md, paddingHorizontal: Spacing.md, color: colors.text, borderWidth: 1, borderColor: colors.surface600, fontSize: FontSize.md },
    disabledInput: { opacity: 0.6, backgroundColor: colors.surface800 },

    formActions: { flexDirection: 'row', gap: Spacing.md },
    cancelBtn: { flex: 1, height: 48, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: colors.surface600, alignItems: 'center', justifyContent: 'center' },
    cancelBtnText: { fontSize: FontSize.md, fontWeight: '700', color: colors.textMuted },
    saveBtn: { flex: 1, height: 48, borderRadius: BorderRadius.md, backgroundColor: colors.primary500, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm },
    saveBtnText: { fontSize: FontSize.md, fontWeight: '700', color: colors.white }
  });
