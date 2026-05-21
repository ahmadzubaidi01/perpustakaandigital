import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Spacing, FontSize, BorderRadius } from '../../constants/theme';
import { authAPI } from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import { useTheme } from '../../context/ThemeContext';

export default function LoginScreen({ navigation }: any) {
  const { login } = useAuthStore();
  const { colors } = useTheme();
  const styles = getStyles(colors);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email.trim()) { Alert.alert('Error', 'Email wajib diisi'); return; }
    if (!password) { Alert.alert('Error', 'Password wajib diisi'); return; }

    setLoading(true);
    try {
      const res = await authAPI.login({ email_address: email.trim(), password });
      const { user, tokens } = res.data.data;
      await login(user, tokens.access_token, tokens.refresh_token);
    } catch (err: any) {
      Alert.alert('Login Gagal', err.response?.data?.message || 'Periksa email dan password Anda');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* Logo */}
        <View style={styles.logoContainer}>
          <View style={styles.logoBox}>
            <Ionicons name="book" size={36} color={colors.white} />
          </View>
          <Text style={styles.title}>Perpustakaan Digital</Text>
          <Text style={styles.subtitle}>Masuk ke akun Anda</Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          {/* Email */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>EMAIL</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="mail-outline" size={20} color={colors.surface400} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="nama@email.com"
                placeholderTextColor={colors.surface400}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          </View>

          {/* Password */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>PASSWORD</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="lock-closed-outline" size={20} color={colors.surface400} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="Masukkan password"
                placeholderTextColor={colors.surface400}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeButton}>
                <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.surface400} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Login Button */}
          <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={loading} activeOpacity={0.8}>
            {loading ? <ActivityIndicator color={colors.white} /> : <Text style={styles.buttonText}>Masuk</Text>}
          </TouchableOpacity>

          {/* Register Link */}
          <View style={styles.linkRow}>
            <Text style={styles.linkText}>Belum punya akun? </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Register')}>
              <Text style={styles.link}>Daftar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const getStyles = (colors: any) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.surface900 },
    scroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: Spacing.xxl, paddingVertical: Spacing.xxxl },
    logoContainer: { alignItems: 'center', marginBottom: Spacing.xxxl },
    logoBox: { width: 72, height: 72, borderRadius: BorderRadius.xl, backgroundColor: colors.primary500, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.lg },
    title: { fontSize: FontSize.xxl, fontWeight: '800', color: colors.text },
    subtitle: { fontSize: FontSize.md, color: colors.textMuted, marginTop: Spacing.xs },
    form: { backgroundColor: colors.surface800, borderRadius: BorderRadius.xl, padding: Spacing.xxl, borderWidth: 1, borderColor: colors.surface600 },
    inputGroup: { marginBottom: Spacing.xl },
    label: { fontSize: FontSize.xs, fontWeight: '700', color: colors.textMuted, letterSpacing: 0.5, marginBottom: Spacing.sm },
    inputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface700, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: colors.surface600, paddingHorizontal: Spacing.md },
    inputIcon: { marginRight: Spacing.sm },
    input: { flex: 1, height: 48, fontSize: FontSize.md, color: colors.text },
    eyeButton: { padding: Spacing.sm },
    button: { backgroundColor: colors.primary500, borderRadius: BorderRadius.md, height: 52, alignItems: 'center', justifyContent: 'center', marginTop: Spacing.lg },
    buttonText: { fontSize: FontSize.lg, fontWeight: '700', color: colors.white },
    linkRow: { flexDirection: 'row', justifyContent: 'center', marginTop: Spacing.xl },
    linkText: { fontSize: FontSize.md, color: colors.textMuted },
    link: { fontSize: FontSize.md, fontWeight: '700', color: colors.primary400 },
  });
