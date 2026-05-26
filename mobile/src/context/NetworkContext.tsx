import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Platform } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from './ThemeContext';
import { checkOnlineStatus, syncOfflineScans, syncMetadataAndCache } from '../services/syncService';
import { Spacing } from '../constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface NetworkContextType {
  isConnected: boolean;
  isInternetReachable: boolean;
  isOnline: boolean;
}

const NetworkContext = createContext<NetworkContextType>({
  isConnected: true,
  isInternetReachable: true,
  isOnline: true,
});

export const NetworkProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [isConnected, setIsConnected] = useState<boolean>(true);
  const [isInternetReachable, setIsInternetReachable] = useState<boolean>(true);
  const [showStatus, setShowStatus] = useState<boolean>(false);
  const [bannerType, setBannerType] = useState<'offline' | 'online'>('online');
  
  // Animation value
  const translateY = useRef(new Animated.Value(-100)).current;
  const prevOnline = useRef<boolean>(true);

  useEffect(() => {
    // Listen for connection status changes from NetInfo
    const unsubscribe = NetInfo.addEventListener(async (state) => {
      const connected = !!state.isConnected;
      setIsConnected(connected);

      let online = false;
      if (connected) {
        // Quick active ping to verify internet reachability
        online = await checkOnlineStatus();
      }

      setIsInternetReachable(online);
      setIsOnline(online);

      // Handle showing / hiding the banner with animated transition
      if (!online) {
        setBannerType('offline');
        setShowStatus(true);
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          tension: 40,
          friction: 8,
        }).start();

        prevOnline.current = false;
      } else if (online && !prevOnline.current) {
        // Just returned online from offline!
        setBannerType('online');
        console.log('[NetworkContext] Device returned online. Instantly triggering background synchronization...');
        
        // Instantly trigger background queue sync and cache refresh
        syncOfflineScans().catch(err => console.warn('[NetworkContext] Immediate offline sync failed:', err));
        syncMetadataAndCache().catch(err => console.warn('[NetworkContext] Immediate metadata cache failed:', err));

        // Animate success banner and then hide it after 3 seconds
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          tension: 40,
          friction: 8,
        }).start();

        setTimeout(() => {
          Animated.timing(translateY, {
            toValue: -100,
            duration: 400,
            useNativeDriver: true,
          }).start(() => {
            setShowStatus(false);
          });
        }, 3000);

        prevOnline.current = true;
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  return (
    <NetworkContext.Provider value={{ isConnected, isInternetReachable, isOnline }}>
      <View style={{ flex: 1 }}>
        {children}
        
        {showStatus && (
          <Animated.View 
            style={[
              styles.banner, 
              { 
                transform: [{ translateY }],
                paddingTop: Platform.OS === 'ios' ? insets.top : Spacing.sm + 4,
                backgroundColor: bannerType === 'offline' ? colors.danger600 : colors.success600,
              }
            ]}
          >
            <View style={styles.content}>
              <Ionicons 
                name={bannerType === 'offline' ? 'cloud-offline' : 'cloud-done'} 
                size={16} 
                color={colors.white} 
              />
              <Text style={styles.text}>
                {bannerType === 'offline' 
                  ? 'Koneksi Terputus — Menggunakan Mode Offline' 
                  : 'Kembali Online — Menyinkronkan Data...'}
              </Text>
            </View>
          </Animated.View>
        )}
      </View>
    </NetworkContext.Provider>
  );
};

export const useNetwork = () => useContext(NetworkContext);

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    paddingBottom: Spacing.sm + 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
  },
  text: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
});
