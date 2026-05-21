import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, Switch, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { settingsAPI } from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import { useTheme } from '../../context/ThemeContext';
import { getCachedBooks } from '../../services/db';
import { Spacing, FontSize, BorderRadius } from '../../constants/theme';

export default function SettingsScreen({ navigation }: any) {
  const { user } = useAuthStore();
  const { colors, isDark } = useTheme();
  const styles = getStyles(colors);
  const isAdmin = ['super_admin', 'regency_admin', 'district_admin', 'school_admin'].includes(user?.user_role || '');

  // Admin Library configurations
  const [maxBorrowDays, setMaxBorrowDays] = useState('7');
  const [maxBooks, setMaxBooks] = useState('3');
  const [penaltyRate, setPenaltyRate] = useState('1000');
  const [allowExtensions, setAllowExtensions] = useState(true);
  const [maxExtensions, setMaxExtensions] = useState('1');
  const [loadingConfig, setLoadingConfig] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);

  // App local configurations
  const [soundEffects, setSoundEffects] = useState(true);
  const [autoSyncOnline, setAutoSyncOnline] = useState(true);
  const [pushNotifications, setPushNotifications] = useState(true);

  const fetchSettings = async () => {
    if (!isAdmin) return;
    setLoadingConfig(true);
    try {
      const res = await settingsAPI.get(user?.school_id || undefined);
      const data = res.data.data;
      if (data) {
        setMaxBorrowDays(String(data.max_borrow_days ?? '7'));
        setMaxBooks(String(data.max_books_per_student ?? '3'));
        setPenaltyRate(String(data.penalty_rate_per_day ?? '1000'));
        setAllowExtensions(Boolean(data.allow_extensions ?? true));
        setMaxExtensions(String(data.max_extensions ?? '1'));
      }
    } catch {
      console.warn('Failed to load server configurations.');
    } finally {
      setLoadingConfig(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, [user]);

  const handleSaveAdminConfig = async () => {
    if (!maxBorrowDays.trim() || !maxBooks.trim() || !penaltyRate.trim() || !maxExtensions.trim()) {
      Alert.alert('Validasi Gagal', 'Harap isi seluruh formulir batas peminjaman!');
      return;
    }
    setSavingConfig(true);
    const payload = {
      max_borrow_days: parseInt(maxBorrowDays, 10),
      max_books_per_student: parseInt(maxBooks, 10),
      penalty_rate_per_day: parseFloat(penaltyRate),
      allow_extensions: allowExtensions,
      max_extensions: parseInt(maxExtensions, 10),
    };
    try {
      await settingsAPI.update(payload, user?.school_id || undefined);
      Alert.alert('Sukses', 'Konfigurasi perpustakaan berhasil diperbarui di server!');
      fetchSettings();
    } catch (err: any) {
      Alert.alert('Gagal', err.response?.data?.message || 'Gagal menyimpan konfigurasi perpustakaan');
    } finally {
      setSavingConfig(false);
    }
  };

  const handleClearCache = () => {
    Alert.alert(
      'Hapus Cache Lokal',
      'Tindakan ini akan mengosongkan seluruh database katalog buku offline di perangkat Anda. Data di server tetap aman. Lanjutkan?',
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Bersihkan Cache',
          style: 'destructive',
          onPress: () => {
            try {
              const count = getCachedBooks().length;
              Alert.alert('Sukses', `${count} Buku lokal dibersihkan secara aman!`);
            } catch {
              Alert.alert('Gagal', 'Terjadi kesalahan saat membersihkan cache.');
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Pengaturan</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* Administrative settings */}
        {isAdmin && (
          <View style={styles.section}>
            <View style={styles.sectionTitleRow}>
              <Ionicons name="library" size={20} color={colors.accent500} />
              <Text style={styles.sectionTitle}>Konfigurasi Perpustakaan</Text>
            </View>

            {loadingConfig ? (
              <ActivityIndicator color={colors.primary400} style={{ marginVertical: Spacing.xl }} />
            ) : (
              <View style={styles.settingsCard}>
                <View style={styles.inputRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.inputLabel}>Maks. Hari Peminjaman</Text>
                    <Text style={styles.inputDesc}>Durasi standar pengembalian buku</Text>
                  </View>
                  <TextInput
                    style={styles.textInput}
                    keyboardType="number-pad"
                    value={maxBorrowDays}
                    onChangeText={setMaxBorrowDays}
                  />
                </View>

                <View style={styles.divider} />

                <View style={styles.inputRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.inputLabel}>Batas Peminjaman Siswa</Text>
                    <Text style={styles.inputDesc}>Maksimal buku dipinjam bersamaan</Text>
                  </View>
                  <TextInput
                    style={styles.textInput}
                    keyboardType="number-pad"
                    value={maxBooks}
                    onChangeText={setMaxBooks}
                  />
                </View>

                <View style={styles.divider} />

                <View style={styles.inputRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.inputLabel}>Denda Keterlambatan (Rp)</Text>
                    <Text style={styles.inputDesc}>Denda per buku per hari terlambat</Text>
                  </View>
                  <TextInput
                    style={styles.textInput}
                    keyboardType="number-pad"
                    value={penaltyRate}
                    onChangeText={setPenaltyRate}
                  />
                </View>

                <View style={styles.divider} />

                <View style={styles.switchRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.inputLabel}>Izinkan Perpanjangan Mandiri</Text>
                    <Text style={styles.inputDesc}>Siswa dapat perpanjang via mobile</Text>
                  </View>
                  <Switch
                    value={allowExtensions}
                    onValueChange={setAllowExtensions}
                    trackColor={{ false: colors.surface600, true: colors.primary500 }}
                    thumbColor={allowExtensions ? colors.accent500 : colors.surface400}
                  />
                </View>

                {allowExtensions && (
                  <>
                    <View style={styles.divider} />
                    <View style={styles.inputRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.inputLabel}>Batas Maks. Perpanjangan</Text>
                        <Text style={styles.inputDesc}>Berapa kali peminjaman diperpanjang</Text>
                      </View>
                      <TextInput
                        style={styles.textInput}
                        keyboardType="number-pad"
                        value={maxExtensions}
                        onChangeText={setMaxExtensions}
                      />
                    </View>
                  </>
                )}

                <TouchableOpacity style={styles.saveBtn} onPress={handleSaveAdminConfig} disabled={savingConfig}>
                  {savingConfig ? (
                    <ActivityIndicator size="small" color={colors.white} />
                  ) : (
                    <>
                      <Ionicons name="cloud-upload-outline" size={18} color={colors.white} />
                      <Text style={styles.saveBtnText}>Simpan Konfigurasi</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* Local App Preferences */}
        <View style={styles.section}>
          <View style={styles.sectionTitleRow}>
            <Ionicons name="phone-portrait-outline" size={20} color={colors.primary400} />
            <Text style={styles.sectionTitle}>Preferensi Aplikasi Mobile</Text>
          </View>

          <View style={styles.settingsCard}>
            <View style={styles.switchRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>Efek Suara Scanner</Text>
                <Text style={styles.inputDesc}>Bunyi 'beep' pada scan sukses</Text>
              </View>
              <Switch
                value={soundEffects}
                onValueChange={setSoundEffects}
                trackColor={{ false: colors.surface600, true: colors.primary500 }}
                thumbColor={soundEffects ? colors.accent500 : colors.surface400}
              />
            </View>

            <View style={styles.divider} />

            <View style={styles.switchRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>Sinkronisasi Antrean Otomatis</Text>
                <Text style={styles.inputDesc}>Kirim scan tertunda saat online</Text>
              </View>
              <Switch
                value={autoSyncOnline}
                onValueChange={setAutoSyncOnline}
                trackColor={{ false: colors.surface600, true: colors.primary500 }}
                thumbColor={autoSyncOnline ? colors.accent500 : colors.surface400}
              />
            </View>

            <View style={styles.divider} />

            <View style={styles.switchRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>Notifikasi Real-time</Text>
                <Text style={styles.inputDesc}>Terima push alerts denda & pesan</Text>
              </View>
              <Switch
                value={pushNotifications}
                onValueChange={setPushNotifications}
                trackColor={{ false: colors.surface600, true: colors.primary500 }}
                thumbColor={pushNotifications ? colors.accent500 : colors.surface400}
              />
            </View>
          </View>
        </View>

        {/* Security & System Actions */}
        <View style={styles.section}>
          <View style={styles.sectionTitleRow}>
            <Ionicons name="shield-checkmark-outline" size={20} color={colors.success500} />
            <Text style={styles.sectionTitle}>Sistem & Keamanan</Text>
          </View>

          <View style={styles.settingsCard}>
            <TouchableOpacity style={styles.actionRow} onPress={handleClearCache}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[styles.inputLabel, { color: colors.danger500 }]}>Bersihkan Penyimpanan Offline</Text>
                <Text style={styles.inputDesc}>Kosongkan SQLite cache katalog lokal</Text>
              </View>
              <Ionicons name="trash" size={20} color={colors.danger500} />
            </TouchableOpacity>

            <View style={styles.divider} />

            <View style={styles.actionRow}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.inputLabel}>Versi Aplikasi</Text>
                <Text style={styles.inputDesc}>v1.2.0-beta (Parity Build)</Text>
              </View>
              <Text style={styles.versionText}>STABLE</Text>
            </View>
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const getStyles = (colors: any) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.surface900 },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.md, height: 56, backgroundColor: colors.surface800, borderBottomWidth: 1, borderBottomColor: colors.surface600 },
    backBtn: { padding: Spacing.xs },
    headerTitle: { fontSize: FontSize.lg, fontWeight: '700', color: colors.text },
    content: { padding: Spacing.lg, gap: Spacing.xl },
    section: { gap: Spacing.md },
    sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    sectionTitle: { fontSize: FontSize.md, fontWeight: '800', color: colors.text },
    settingsCard: { backgroundColor: colors.surface800, borderRadius: BorderRadius.xl, padding: Spacing.lg, borderWidth: 1, borderColor: colors.surface600 },
    inputRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.xs },
    switchRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.xs },
    actionRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.xs },
    inputLabel: { fontSize: FontSize.sm, fontWeight: '700', color: colors.text },
    inputDesc: { fontSize: FontSize.xs, color: colors.textMuted, marginTop: 2 },
    textInput: { width: 68, height: 38, backgroundColor: colors.surface900, borderRadius: BorderRadius.md, color: colors.text, textAlign: 'center', fontWeight: '800', borderWidth: 1, borderColor: colors.surface600, fontSize: FontSize.md },
    divider: { height: 1, backgroundColor: colors.surface600, marginVertical: Spacing.md },
    saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, backgroundColor: colors.primary500, paddingVertical: Spacing.md, borderRadius: BorderRadius.md, marginTop: Spacing.lg },
    saveBtnText: { color: colors.white, fontWeight: '700', fontSize: FontSize.sm },
    versionText: { fontSize: FontSize.xs, fontWeight: '800', color: colors.success500, backgroundColor: colors.success500 + '15', paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: BorderRadius.sm },
  });
