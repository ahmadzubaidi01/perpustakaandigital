import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Spacing, FontSize, BorderRadius } from '../../constants/theme';
import { authAPI } from '../../services/api';
import { useTheme } from '../../context/ThemeContext';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function RegisterScreen({ navigation }: any) {
  const { colors } = useTheme();
  const styles = getStyles(colors);

  const [form, setForm] = useState({ full_name: '', email_address: '', password: '', confirm_password: '', student_id_number: '', class_name: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const update = (key: string, value: string) => setForm((p) => ({ ...p, [key]: value }));

  const handleRegister = async () => {
    if (!form.full_name.trim()) { Alert.alert('Error', 'Nama lengkap wajib diisi'); return; }
    if (!form.email_address.trim()) { Alert.alert('Error', 'Email wajib diisi'); return; }
    if (form.password.length < 8) { Alert.alert('Error', 'Password minimal 8 karakter'); return; }
    if (form.password !== form.confirm_password) { Alert.alert('Error', 'Password tidak cocok'); return; }

    setLoading(true);
    try {
      await authAPI.register({ full_name: form.full_name, email_address: form.email_address, password: form.password, student_id_number: form.student_id_number || null, class_name: form.class_name || null });
      Alert.alert('Berhasil', 'Akun berhasil dibuat! Silakan login.', [{ text: 'OK', onPress: () => navigation.goBack() }]);
    } catch (err: any) { Alert.alert('Gagal', err.response?.data?.message || 'Registrasi gagal'); }
    finally { setLoading(false); }
  };

  const Field = ({ label, keyName, placeholder, secure = false, keyboard = 'default' as any }: any) => (
    <View style={styles.inputGroup}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputContainer}>
        <TextInput style={styles.input} placeholder={placeholder} placeholderTextColor={colors.surface400} value={(form as any)[keyName]} onChangeText={(v) => update(keyName, v)} secureTextEntry={secure && !showPassword} keyboardType={keyboard} autoCapitalize={keyboard === 'email-address' ? 'none' : 'words'} />
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.logoContainer}>
            <View style={styles.logoBox}><Ionicons name="person-add" size={32} color={colors.white} /></View>
            <Text style={styles.title}>Daftar Akun</Text>
            <Text style={styles.subtitle}>Buat akun untuk meminjam buku</Text>
          </View>

          <View style={styles.form}>
            <Field label="NAMA LENGKAP" keyName="full_name" placeholder="Masukkan nama lengkap" />
            <Field label="EMAIL" keyName="email_address" placeholder="nama@email.com" keyboard="email-address" />
            <Field label="NIS / NISN (Opsional)" keyName="student_id_number" placeholder="Nomor induk siswa" />
            <Field label="KELAS (Opsional)" keyName="class_name" placeholder="Contoh: XII IPA 1" />
            <Field label="PASSWORD" keyName="password" placeholder="Minimal 8 karakter" secure />
            <Field label="KONFIRMASI PASSWORD" keyName="confirm_password" placeholder="Ulangi password" secure />

            <TouchableOpacity style={styles.button} onPress={handleRegister} disabled={loading} activeOpacity={0.8}>
              {loading ? <ActivityIndicator color={colors.white} /> : <Text style={styles.buttonText}>Daftar</Text>}
            </TouchableOpacity>

            <View style={styles.linkRow}>
              <Text style={styles.linkText}>Sudah punya akun? </Text>
              <TouchableOpacity onPress={() => navigation.goBack()}><Text style={styles.link}>Masuk</Text></TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const getStyles = (colors: any) =>
  StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: colors.surface900 },
    container: { flex: 1, backgroundColor: colors.surface900 },
    scroll: { flexGrow: 1, paddingHorizontal: Spacing.xxl, paddingVertical: Spacing.xxxl },
    logoContainer: { alignItems: 'center', marginBottom: Spacing.xxl },
    logoBox: { width: 64, height: 64, borderRadius: BorderRadius.xl, backgroundColor: colors.primary500, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.lg },
    title: { fontSize: FontSize.xxl, fontWeight: '800', color: colors.text },
    subtitle: { fontSize: FontSize.md, color: colors.textMuted, marginTop: Spacing.xs },
    form: { backgroundColor: colors.surface800, borderRadius: BorderRadius.xl, padding: Spacing.xxl, borderWidth: 1, borderColor: colors.surface600 },
    inputGroup: { marginBottom: Spacing.lg },
    label: { fontSize: FontSize.xs, fontWeight: '700', color: colors.textMuted, letterSpacing: 0.5, marginBottom: Spacing.sm },
    inputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface700, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: colors.surface600, paddingHorizontal: Spacing.md },
    input: { flex: 1, height: 48, fontSize: FontSize.md, color: colors.text },
    button: { backgroundColor: colors.primary500, borderRadius: BorderRadius.md, height: 52, alignItems: 'center', justifyContent: 'center', marginTop: Spacing.lg },
    buttonText: { fontSize: FontSize.lg, fontWeight: '700', color: colors.white },
    linkRow: { flexDirection: 'row', justifyContent: 'center', marginTop: Spacing.xl },
    linkText: { fontSize: FontSize.md, color: colors.textMuted },
    link: { fontSize: FontSize.md, fontWeight: '700', color: colors.primary400 },
  });
