import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, Platform, ImageBackground } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { Spacing, FontSize, BorderRadius } from '../../constants/theme';

const { width } = Dimensions.get('window');

export default function GetStartedScreen({ navigation }: any) {
  const { colors } = useTheme();
  const styles = getStyles(colors);

  const handleGetStarted = () => {
    navigation.replace('Login');
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Glow Highlight Effect */}
      <View style={styles.glowBg} />

      {/* Main Container */}
      <View style={styles.content}>
        {/* Branding Area */}
        <View style={styles.logoContainer}>
          <View style={styles.logoOuter}>
            <View style={styles.logoInner}>
              <Ionicons name="library" size={64} color={colors.accent400} />
            </View>
          </View>
          <Text style={styles.logoTitle}>Perpustakaan Digital</Text>
          <Text style={styles.logoSubtitle}>SMART PORTAL LIBRARY</Text>
        </View>

        {/* Welcome Area Card */}
        <View style={styles.welcomeCard}>
          <Text style={styles.welcomeHeading}>Selamat Datang</Text>
          <Text style={styles.welcomeText}>
            Portal Pintar Perpustakaan Sekolah Anda. Temukan ribuan buku digital, kelola peminjaman fisik secara instan, dan hubungi pustakawan kapan saja.
          </Text>
        </View>

        {/* CTA Actions */}
        <View style={styles.actionsContainer}>
          <TouchableOpacity style={styles.primaryBtn} onPress={handleGetStarted} activeOpacity={0.85}>
            <Text style={styles.primaryBtnText}>Mulai Sekarang</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.white} />
          </TouchableOpacity>

          <Text style={styles.infoLabel}>
            Aplikasi dikelola mandiri oleh unit kearsipan sekolah
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const getStyles = (colors: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.surface900,
      justifyContent: 'center',
    },
    glowBg: {
      position: 'absolute',
      top: -150,
      alignSelf: 'center',
      width: width * 1.5,
      height: width * 1.5,
      borderRadius: (width * 1.5) / 2,
      backgroundColor: colors.primary500 + '12',
    },
    content: {
      flex: 1,
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.xl * 1.5,
      paddingVertical: Spacing.xl * 2,
    },
    logoContainer: {
      alignItems: 'center',
      marginTop: Spacing.xxl,
    },
    logoOuter: {
      width: 140,
      height: 140,
      borderRadius: 70,
      backgroundColor: colors.surface800,
      borderWidth: 2,
      borderColor: colors.accent500 + '30',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: Spacing.lg,
      shadowColor: colors.accent500,
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.15,
      shadowRadius: 15,
      elevation: 5,
    },
    logoInner: {
      width: 116,
      height: 116,
      borderRadius: 58,
      backgroundColor: colors.surface900,
      justifyContent: 'center',
      alignItems: 'center',
    },
    logoTitle: {
      fontSize: FontSize.xl + 4,
      fontWeight: '900',
      color: colors.text,
      letterSpacing: -0.5,
    },
    logoSubtitle: {
      fontSize: 10,
      fontWeight: '800',
      color: colors.accent500,
      letterSpacing: 3,
      marginTop: 2,
    },
    welcomeCard: {
      backgroundColor: colors.surface800 + '80',
      borderWidth: 1,
      borderColor: colors.surface600 + '40',
      padding: Spacing.xl,
      borderRadius: BorderRadius.xl,
      alignItems: 'center',
      gap: Spacing.sm,
    },
    welcomeHeading: {
      fontSize: FontSize.lg,
      fontWeight: '800',
      color: colors.text,
    },
    welcomeText: {
      fontSize: FontSize.sm + 1,
      color: colors.textMuted,
      textAlign: 'center',
      lineHeight: 22,
    },
    actionsContainer: {
      width: '100%',
      gap: Spacing.md,
      alignItems: 'center',
    },
    primaryBtn: {
      flexDirection: 'row',
      width: '100%',
      height: 52,
      backgroundColor: colors.primary500,
      borderRadius: BorderRadius.lg,
      justifyContent: 'center',
      alignItems: 'center',
      gap: Spacing.sm,
      shadowColor: colors.primary500,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.4,
      shadowRadius: 12,
      elevation: 6,
    },
    primaryBtnText: {
      color: colors.white,
      fontWeight: '900',
      fontSize: FontSize.md,
    },
    infoLabel: {
      fontSize: 10,
      color: colors.textMuted,
      textAlign: 'center',
      opacity: 0.8,
    },
  });
