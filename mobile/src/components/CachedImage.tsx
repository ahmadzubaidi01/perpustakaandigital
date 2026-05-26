import React, { useState, useEffect, useCallback } from 'react';
import { Image, ImageProps, View, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import { useAuthStore } from '../store/authStore';
import { Colors } from '../constants/theme';

interface CachedImageProps extends Omit<ImageProps, 'source'> {
  remoteUri: string;
  /** Fallback icon name (Ionicons) when image fails to load */
  fallbackIcon?: keyof typeof Ionicons.glyphMap;
  fallbackIconSize?: number;
  fallbackIconColor?: string;
  /** Whether to cache this image to local storage (auto for school_admin, manual override) */
  enableCache?: boolean;
}

const BOOK_COVERS_DIR = `${FileSystem.documentDirectory}book_covers/`;

export const CachedImage: React.FC<CachedImageProps> = ({
  remoteUri,
  style,
  fallbackIcon = 'book',
  fallbackIconSize = 32,
  fallbackIconColor = Colors.surface400,
  enableCache,
  ...props
}) => {
  const [sourceUri, setSourceUri] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const user = useAuthStore((state) => state.user);
  // Cache images if explicitly enabled, or if user is school_admin
  const shouldCache = enableCache ?? user?.user_role === 'school_admin';

  useEffect(() => {
    let isMounted = true;

    const loadImage = async () => {
      try {
        if (!remoteUri) {
          if (isMounted) {
            setSourceUri(null);
            setIsLoading(false);
            setHasError(true);
          }
          return;
        }

        // Reset states
        if (isMounted) {
          setIsLoading(true);
          setHasError(false);
        }

        // If remoteUri is already a local file path, use it directly
        if (remoteUri.startsWith('file://')) {
          if (isMounted) {
            setSourceUri(remoteUri);
            setIsLoading(false);
          }
          return;
        }

        // Extract filename for cache key
        const urlWithoutQuery = remoteUri.split('?')[0];
        const parts = urlWithoutQuery.split('/');
        const filename = parts[parts.length - 1];

        if (!filename) {
          // No valid filename — use remote URI directly
          if (isMounted) {
            setSourceUri(remoteUri);
            setIsLoading(false);
          }
          return;
        }

        const localUri = `${BOOK_COVERS_DIR}${filename}`;

        // First check local cache
        try {
          const fileInfo = await FileSystem.getInfoAsync(localUri);
          if (fileInfo.exists && fileInfo.size && fileInfo.size > 0) {
            // File exists in local cache with valid size
            if (isMounted) {
              setSourceUri(localUri);
              setIsLoading(false);
            }
            return;
          }
        } catch {
          // Cache check failed, continue with remote
        }

        // No cached version — set remote URI immediately for display
        if (isMounted) {
          setSourceUri(remoteUri);
          setIsLoading(false);
        }

        // If caching is enabled, download in background
        if (shouldCache) {
          try {
            const dirInfo = await FileSystem.getInfoAsync(BOOK_COVERS_DIR);
            if (!dirInfo.exists) {
              await FileSystem.makeDirectoryAsync(BOOK_COVERS_DIR, { intermediates: true });
            }

            const downloadResult = await FileSystem.downloadAsync(remoteUri, localUri);
            if (downloadResult.status === 200 && isMounted) {
              // Swap to cached local version
              setSourceUri(localUri);
            }
          } catch {
            // Download failed, remote URI is already shown — silently ignore
          }
        }
      } catch (error) {
        // General fallback
        if (isMounted) {
          setSourceUri(remoteUri || null);
          setIsLoading(false);
        }
      }
    };

    loadImage();

    return () => {
      isMounted = false;
    };
  }, [remoteUri, shouldCache]);

  const handleLoadEnd = useCallback(() => {
    setIsLoading(false);
  }, []);

  const handleError = useCallback(() => {
    setIsLoading(false);
    setHasError(true);
  }, []);

  // No source URI at all — show fallback icon
  if (!sourceUri || hasError) {
    return (
      <View style={[localStyles.fallbackContainer, style]}>
        <Ionicons name={fallbackIcon} size={fallbackIconSize} color={fallbackIconColor} />
      </View>
    );
  }

  return (
    <View style={[{ position: 'relative' }, style]}>
      <Image
        source={{ uri: sourceUri }}
        style={[{ width: '100%', height: '100%' }, style]}
        onLoadEnd={handleLoadEnd}
        onError={handleError}
        {...props}
      />
      {isLoading && (
        <View style={localStyles.loaderOverlay}>
          <ActivityIndicator size="small" color={Colors.primary400} />
        </View>
      )}
    </View>
  );
};

const localStyles = StyleSheet.create({
  fallbackContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loaderOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(11, 17, 32, 0.3)',
  },
});
