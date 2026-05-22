import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../store/authStore';
import { authAPI } from '../../services/api';
import { useTheme } from '../../context/ThemeContext';
import { Spacing, FontSize, BorderRadius } from '../../constants/theme';
import * as SecureStore from 'expo-secure-store';

const roleLabels: Record<string, string> = {
  super_admin: 'Super Admin',
  regency_admin: 'Admin Kabupaten',
  district_admin: 'Admin Kecamatan',
  school_admin: 'Admin Sekolah',
  student_member: 'Anggota',
};

export default function ProfileScreen({ navigation }: any) {
  const { user, logout } = useAuthStore();
  const { colors, isDark } = useTheme();
  const styles = getStyles(colors, isDark);

  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    // Simple placeholder refresh for user profile
    setRefreshing(false);
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
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary400} />}
    >
      {/* Avatar */}
      <View style={styles.avatarSection}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{user?.full_name?.charAt(0)?.toUpperCase()}</Text>
        </View>
        <Text style={styles.name}>{user?.full_name}</Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{roleLabels[user?.user_role || '']}</Text>
        </View>
      </View>

      {/* Info Card */}
      <View style={styles.card}>
        <Info icon="mail-outline" label="Email" value={user?.email_address || ''} />
        <Info icon="school-outline" label="Sekolah" value={user?.school?.school_name || '-'} />
        <Info icon="card-outline" label="NISN" value={user?.student_id_number || '-'} />
        <Info icon="people-outline" label="Kelas" value={user?.class_name || '-'} />
      </View>

      {/* Logout */}
      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.8}>
        <Ionicons name="log-out-outline" size={20} color={colors.danger500} />
        <Text style={styles.logoutText}>Keluar dari Akun</Text>
      </TouchableOpacity>
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
    logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, backgroundColor: colors.danger500 + '15', borderRadius: BorderRadius.lg, padding: Spacing.lg, marginTop: Spacing.xl, borderWidth: 1, borderColor: colors.danger500 + '30' },
    logoutText: { fontSize: FontSize.md, fontWeight: '700', color: colors.danger500 },
  });
