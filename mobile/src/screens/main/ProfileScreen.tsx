import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, FontSize, BorderRadius } from '../../constants/theme';
import { useAuthStore } from '../../store/authStore';
import { authAPI } from '../../services/api';
import * as SecureStore from 'expo-secure-store';

const roleLabels: Record<string, string> = { super_admin: 'Super Admin', regency_admin: 'Admin Kabupaten', district_admin: 'Admin Kecamatan', school_admin: 'Admin Sekolah', student_member: 'Anggota' };

export default function ProfileScreen() {
  const { user, logout } = useAuthStore();

  const handleLogout = () => {
    Alert.alert('Keluar', 'Yakin ingin keluar dari akun?', [
      { text: 'Batal', style: 'cancel' },
      { text: 'Keluar', style: 'destructive', onPress: async () => {
        try { const rt = await SecureStore.getItemAsync('refresh_token'); await authAPI.logout(rt || undefined); } catch {}
        await logout();
      }},
    ]);
  };

  const Info = ({ icon, label, value }: { icon: string; label: string; value: string }) => (
    <View style={s.infoRow}>
      <Ionicons name={icon as any} size={20} color={Colors.surface400} />
      <View style={{ flex: 1 }}><Text style={s.infoLabel}>{label}</Text><Text style={s.infoValue}>{value || '-'}</Text></View>
    </View>
  );

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      {/* Avatar */}
      <View style={s.avatarSection}>
        <View style={s.avatar}><Text style={s.avatarText}>{user?.full_name?.charAt(0)?.toUpperCase()}</Text></View>
        <Text style={s.name}>{user?.full_name}</Text>
        <View style={s.badge}><Text style={s.badgeText}>{roleLabels[user?.user_role || '']}</Text></View>
      </View>

      {/* Info Card */}
      <View style={s.card}>
        <Info icon="mail-outline" label="Email" value={user?.email_address || ''} />
        <Info icon="school-outline" label="Sekolah" value={user?.school?.school_name || '-'} />
        <Info icon="card-outline" label="NIS" value={user?.student_id_number || '-'} />
        <Info icon="people-outline" label="Kelas" value={user?.class_name || '-'} />
      </View>

      {/* Logout */}
      <TouchableOpacity style={s.logoutBtn} onPress={handleLogout} activeOpacity={0.8}>
        <Ionicons name="log-out-outline" size={20} color={Colors.danger500} />
        <Text style={s.logoutText}>Keluar dari Akun</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surface900 },
  content: { padding: Spacing.lg },
  avatarSection: { alignItems: 'center', paddingVertical: Spacing.xxl },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: Colors.primary500, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.md },
  avatarText: { fontSize: FontSize.title, fontWeight: '800', color: Colors.white },
  name: { fontSize: FontSize.xl, fontWeight: '800', color: Colors.white },
  badge: { backgroundColor: Colors.primary500 + '20', paddingHorizontal: Spacing.md, paddingVertical: 4, borderRadius: BorderRadius.full, marginTop: Spacing.sm },
  badgeText: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.primary400 },
  card: { backgroundColor: Colors.surface800, borderRadius: BorderRadius.xl, padding: Spacing.lg, borderWidth: 1, borderColor: Colors.surface600, gap: Spacing.lg },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  infoLabel: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.surface400, letterSpacing: 0.5 },
  infoValue: { fontSize: FontSize.md, fontWeight: '600', color: Colors.white, marginTop: 2 },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, backgroundColor: Colors.danger500 + '15', borderRadius: BorderRadius.lg, padding: Spacing.lg, marginTop: Spacing.xxl, borderWidth: 1, borderColor: Colors.danger500 + '30' },
  logoutText: { fontSize: FontSize.md, fontWeight: '700', color: Colors.danger500 },
});
