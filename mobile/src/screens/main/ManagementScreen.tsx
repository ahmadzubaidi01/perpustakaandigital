import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { Spacing, FontSize, BorderRadius } from '../../constants/theme';
import { useAuthStore } from '../../store/authStore';
import { useNotificationStore } from '../../store/notificationStore';

export default function ManagementScreen({ navigation }: any) {
  const { colors } = useTheme();
  const { user } = useAuthStore();
  const { chatUnreadCount, fetchUnreadCount } = useNotificationStore();
  const [refreshing, setRefreshing] = useState(false);
  const styles = getStyles(colors);

  useEffect(() => {
    fetchUnreadCount();
    const unsubscribe = navigation.addListener('focus', () => {
      fetchUnreadCount();
    });
    return unsubscribe;
  }, [navigation]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await fetchUnreadCount();
    } catch (err) {
      console.warn('[ManagementScreen] Failed to refresh:', err);
    } finally {
      setRefreshing(false);
    }
  };

  const menuItems = [
    {
      title: 'Manajemen User',
      icon: 'people-outline',
      color: colors.primary400,
      target: 'UserManagement',
      roles: ['super_admin', 'regency_admin', 'district_admin', 'school_admin'],
    },
    {
      title: 'Manajemen Sekolah',
      icon: 'business-outline',
      color: colors.accent500,
      target: 'SchoolManagement',
      roles: ['super_admin', 'regency_admin', 'district_admin'],
    },
    {
      title: 'Manajemen Wilayah',
      icon: 'map-outline',
      color: colors.success500,
      target: 'RegionManagement',
      roles: ['super_admin', 'regency_admin'],
    },
    {
      title: 'Manajemen Kategori',
      icon: 'grid-outline',
      color: colors.info500,
      target: 'CategoryManagement',
      roles: ['super_admin', 'regency_admin', 'district_admin', 'school_admin'],
    },
    {
      title: 'Buat QR Code',
      icon: 'qr-code-outline',
      color: colors.accent400,
      target: 'QrGenerator',
      roles: ['super_admin', 'regency_admin', 'district_admin', 'school_admin'],
    },
    {
      title: 'Chat Admin',
      icon: 'chatbubbles-outline',
      color: colors.success500,
      target: 'Chat',
      roles: ['super_admin', 'regency_admin', 'district_admin', 'school_admin'],
    },
    {
      title: 'Pengaturan Sistem',
      icon: 'settings-outline',
      color: colors.surface400,
      target: 'Settings',
      roles: ['super_admin', 'regency_admin', 'district_admin', 'school_admin'],
    },
  ];

  // Filter based on user role
  const userRole = user?.user_role || 'student_member';
  const visibleItems = menuItems.filter((item) => item.roles.includes(userRole));

  return (
    <View style={styles.container}>
      <ScrollView 
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh} 
            tintColor={colors.primary400} 
            colors={[colors.primary500]}
          />
        }
      >
        <Text style={styles.subtitle}>Kelola resource, konfigurasi, dan layanan perpustakaan digital.</Text>
        
        <View style={styles.grid}>
          {visibleItems.map((item, idx) => (
            <TouchableOpacity
              key={idx}
              style={styles.card}
              activeOpacity={0.8}
              onPress={() => navigation.navigate(item.target)}
            >
              <View style={[styles.iconContainer, { backgroundColor: item.color + '15' }]}>
                <Ionicons name={item.icon as any} size={28} color={item.color} />
                {item.target === 'Chat' && chatUnreadCount > 0 && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{chatUnreadCount}</Text>
                  </View>
                )}
              </View>
              <Text style={styles.cardTitle}>{item.title}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const getStyles = (colors: any) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.surface900 },
    scroll: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.lg },
    subtitle: { fontSize: FontSize.sm, color: colors.textMuted, marginBottom: Spacing.xl },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
    card: { width: '47%', backgroundColor: colors.surface800, borderRadius: BorderRadius.xl, padding: Spacing.lg, borderWidth: 1, borderColor: colors.surface600, alignItems: 'center', justifyContent: 'center', gap: Spacing.md },
    iconContainer: { width: 56, height: 56, borderRadius: BorderRadius.lg, alignItems: 'center', justifyContent: 'center', position: 'relative' },
    cardTitle: { fontSize: FontSize.sm, fontWeight: '700', color: colors.text, textAlign: 'center' },
    badge: {
      position: 'absolute',
      top: -4,
      right: -4,
      backgroundColor: colors.danger500,
      borderRadius: BorderRadius.full,
      minWidth: 18,
      height: 18,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 4,
      borderWidth: 1.5,
      borderColor: colors.surface800,
    },
    badgeText: {
      color: colors.white,
      fontSize: 10,
      fontWeight: '800',
    },
  });
