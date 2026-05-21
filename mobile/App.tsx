import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SecureStore from 'expo-secure-store';
import RootNavigator from './src/navigation/RootNavigator';
import SocketNotificationListener from './src/components/SocketNotificationListener';
import { useAuthStore } from './src/store/authStore';
import { authAPI } from './src/services/api';
import { Colors } from './src/constants/theme';
import { initDatabase } from './src/services/db';
import { startAutoSync } from './src/services/syncService';

function AppContent() {
  const { isLoading, setUser, setLoading, logout } = useAuthStore();

  useEffect(() => {
    // Initialize SQLite database
    initDatabase();
    
    // Start background auto-sync (runs every 30 seconds)
    const stopSync = startAutoSync();

    const init = async () => {
      try {
        const token = await SecureStore.getItemAsync('access_token');
        if (!token) { setLoading(false); return; }
        const res = await authAPI.getProfile();
        setUser(res.data.data);
      } catch {
        await logout();
      } finally {
        setLoading(false);
      }
    };
    init();

    return () => {
      stopSync();
    };
  }, []);

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={Colors.primary400} />
      </View>
    );
  }

  return (
    <>
      <RootNavigator />
      <SocketNotificationListener />
    </>
  );
}

import { ThemeProvider, useTheme } from './src/context/ThemeContext';

function AppWithTheme() {
  const { isDark } = useTheme();
  return (
    <>
      <StatusBar style={isDark ? "light" : "dark"} />
      <AppContent />
    </>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <SafeAreaProvider>
        <AppWithTheme />
      </SafeAreaProvider>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    backgroundColor: Colors.surface900,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
