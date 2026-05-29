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
import { runFullSynchronization } from './src/services/syncService';

function AppContent() {
  const { isLoading, hydrate, setUser, setLoading, logout } = useAuthStore();

  useEffect(() => {
    // Initialize SQLite database
    initDatabase();
    
    // Perform full background sync
    runFullSynchronization();

    const init = async () => {
      // 1. Hydrate the session from SecureStore immediately for instant load
      await hydrate();

      try {
        const token = await SecureStore.getItemAsync('access_token');
        if (!token) {
          setLoading(false);
          return;
        }

        // 2. Perform background profile verification
        const res = await authAPI.getProfile();
        setUser(res.data.data);
      } catch (err: any) {
        console.error('[App] Verification error:', err.message, err.response?.status, err.response?.data);
        // Only log out if the backend explicitly returns a 401 Unauthorized status.
        // For network errors/timeouts, we keep using our local cached session!
        if (err.response?.status === 401) {
          console.warn('[App] Session is invalid, forcing logout');
          await logout();
        } else {
          console.log('[App] Network/Server unreachable during boot. Bypassing online validation, using offline cache.');
        }
      } finally {
        setLoading(false);
      }
    };
    init();

    return () => {
      // Any necessary cleanup
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
import { NetworkProvider } from './src/context/NetworkContext';

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
        <NetworkProvider>
          <AppWithTheme />
        </NetworkProvider>
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
