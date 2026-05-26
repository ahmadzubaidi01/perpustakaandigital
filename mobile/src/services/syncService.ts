import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import * as FileSystem from 'expo-file-system/legacy';
import api, { qrAPI, borrowingsAPI, booksAPI, usersAPI, notificationsAPI } from './api';
import { API_BASE_URL } from '../constants/theme';
import { resolveImageUrl } from '../utils/imageUtils';
import { 
  getPendingScans, 
  markScanSynced, 
  markScanFailed, 
  cacheBooks, 
  cacheStudents, 
  cacheBorrowings, 
  cacheNotifications,
  initDatabase,
  OfflineScan,
  incrementScanRetry,
  getAllScans
} from './db';
import { useAuthStore } from '../store/authStore';
import { useSyncDiagnosticsStore } from '../store/syncDiagnosticsStore';

let isSyncingQueue = false;
let isSyncingMetadata = false;
let syncCooldownUntil = 0;
let backoffDelay = 5000; // start with 5 seconds

// Keys for storing sync timestamps in AsyncStorage
const SYNC_KEYS = {
  BOOKS: 'sync_last_time_books',
  STUDENTS: 'sync_last_time_students',
  BORROWINGS: 'sync_last_time_borrowings',
  NOTIFICATIONS: 'sync_last_time_notifications',
};

/**
 * Check if the device is online by pinging the backend API.
 */
export const checkOnlineStatus = async (): Promise<boolean> => {
  try {
    const netState = await NetInfo.fetch();
    if (!netState.isConnected) {
      return false;
    }

    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 3000);
    
    // Ping online API health endpoint directly using native fetch to bypass circuit breakers/Axios
    const res = await fetch(`${API_BASE_URL}/health`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
      signal: controller.signal,
    });
    clearTimeout(id);
    return res.status === 200;
  } catch (error) {
    return false;
  }
};

/**
 * Synchronize all pending offline scans (borrowings/returns queue) to the backend.
 * Ensures transactions are sequentially replayed exactly in transaction order.
 */
export const syncOfflineScans = async (onProgressUpdate?: () => void): Promise<void> => {
  if (isSyncingQueue) return;
  if (Date.now() < syncCooldownUntil) {
    console.log('[SyncService] In retry backoff cooldown. Bypassing sync queue replay.');
    return;
  }

  const isOnline = await checkOnlineStatus();
  
  // Set offline recovery diagnostics state
  useSyncDiagnosticsStore.getState().setOfflineSyncRecovery(!isOnline);

  if (!isOnline) {
    console.log('[SyncService] Device is offline. Postponing sync queue.');
    return;
  }

  // Update diagnostics queue health
  const pending = getPendingScans();
  const failed = getAllScans().filter((s: any) => s.sync_status === 'failed').length;
  useSyncDiagnosticsStore.getState().updateQueueHealth(pending.length, failed);

  if (pending.length === 0) {
    return;
  }

  isSyncingQueue = true;
  useSyncDiagnosticsStore.getState().recordSyncStart(true);
  console.log(`[SyncService] Starting sync for ${pending.length} pending scans`);

  try {
    for (const scan of pending) {
      if (!scan.id) continue;

      try {
        console.log(`[SyncService] Syncing scan id=${scan.id}, type=${scan.scan_type}`);
        const startTime = Date.now();

        switch (scan.scan_type) {
          case 'verification':
          case 'inventory':
          case 'audit':
            await qrAPI.scan({
              qr_payload: scan.qr_payload,
              scan_type: scan.scan_type,
              latitude: scan.latitude || undefined,
              longitude: scan.longitude || undefined,
            });
            break;

          case 'borrowing':
            if (!scan.student_id) {
              throw new Error('ID Siswa diperlukan untuk peminjaman');
            }
            await borrowingsAPI.quickBorrow({
              student_id: scan.student_id,
              qr_payload: scan.qr_payload,
            });
            break;

          case 'returning':
            await borrowingsAPI.quickReturn({
              qr_payload: scan.qr_payload,
            });
            break;

          default:
            throw new Error(`Tipe scan tidak didukung: ${scan.scan_type}`);
        }

        // Record queue latency in diagnostics
        const duration = Date.now() - startTime;
        useSyncDiagnosticsStore.getState().recordQueueLatency(duration);

        // Mark as synced on success
        markScanSynced(scan.id);
        
        // Update diagnostics queue health
        const newPending = getPendingScans().length;
        const newFailed = getAllScans().filter((s: any) => s.sync_status === 'failed').length;
        useSyncDiagnosticsStore.getState().updateQueueHealth(newPending, newFailed);

        if (onProgressUpdate) onProgressUpdate();

        // Successful replay: reset backoff cooldown
        backoffDelay = 5000;

      } catch (error: any) {
        // If it's a network/server failure, stop queue replay to preserve ordering and trigger backoff cooldown
        const isNetworkError = !error.response;
        const isServerError = error.response?.status >= 500;
        
        if (isNetworkError || isServerError) {
          console.warn('[SyncService] Connection or server error during sync queue. Stopping queue.');
          
          // Increment diagnostics retry count and log failure
          useSyncDiagnosticsStore.getState().incrementSyncRetries();
          useSyncDiagnosticsStore.getState().logSyncFailure(scan.scan_type || 'queue', error.message || 'Connection timeout');
          
          // Apply exponential backoff cooldown
          backoffDelay = Math.min(backoffDelay * 2, 120000); // Max 120s cooldown
          syncCooldownUntil = Date.now() + backoffDelay;
          console.log(`[SyncService] Active backoff cooldown triggered. Cooldown duration: ${backoffDelay / 1000}s`);
          break;
        }

        // Business/Validation error (e.g. book already borrowed, student limit exceeded, invalid QR)
        // Mark as failed and store the error message from the backend after 5 failed attempts (Dead-letter logic)
        const errMsg = error.response?.data?.message || error.message || 'Validation error';
        const retries = incrementScanRetry(scan.id);

        if (retries >= 5) {
          console.warn(`[SyncService] Dead-letter isolation triggered for scan id=${scan.id}. Exceeded max 5 attempts. Error: ${errMsg}`);
          markScanFailed(scan.id, errMsg);
          useSyncDiagnosticsStore.getState().logSyncFailure(scan.scan_type, `Permanently isolated: ${errMsg}`);
        } else {
          console.log(`[SyncService] Validation error during sync (Attempt ${retries}/5): ${errMsg}. Leaving pending to try again.`);
        }

        // Update diagnostics queue health
        const newPending = getPendingScans().length;
        const newFailed = getAllScans().filter((s: any) => s.sync_status === 'failed').length;
        useSyncDiagnosticsStore.getState().updateQueueHealth(newPending, newFailed);

        if (onProgressUpdate) onProgressUpdate();
      }
    }

    // If we completed everything successfully without breaking out
    const remainingPending = getPendingScans().length;
    if (remainingPending === 0) {
      useSyncDiagnosticsStore.getState().recordSyncSuccess();
    }
  } finally {
    isSyncingQueue = false;
    useSyncDiagnosticsStore.getState().recordSyncStart(false);
    console.log('[SyncService] Sync queue finished');
  }
};

/**
 * Incremental metadata caching for School Admin role.
 * Queries API for records updated since last sync, utilizing db indexes on updated_at.
 */
export const syncMetadataAndCache = async (): Promise<void> => {
  if (isSyncingMetadata) return;

  const user = useAuthStore.getState().user;
  // STRICT RULE: Offline caching & background sync only applies to School Admin accounts
  if (user?.user_role !== 'school_admin') {
    return;
  }

  const isOnline = await checkOnlineStatus();
  useSyncDiagnosticsStore.getState().setOfflineSyncRecovery(!isOnline);
  
  if (!isOnline) {
    return;
  }

  isSyncingMetadata = true;
  useSyncDiagnosticsStore.getState().recordSyncStart(true);
  console.log('[SyncService] Starting background metadata cache synchronization...');

  try {
    initDatabase();

    // 1. Sync Books Cache
    try {
      let lastSyncBooks = await AsyncStorage.getItem(SYNC_KEYS.BOOKS) || '';
      let page = 1;
      let hasMore = true;
      let newestTimestamp = lastSyncBooks;

      while (hasMore) {
        const params: any = { sync: 'true', limit: 100, page };
        if (lastSyncBooks) params.updated_after = lastSyncBooks;
        
        const res = await booksAPI.list(params);
        const data = res.data.data || [];
        
        if (data.length > 0) {
          cacheBooks(data);

          // Pre-cache cover images to phone storage for school admin
          try {
            const BOOK_COVERS_DIR = `${FileSystem.documentDirectory}book_covers/`;
            const dirInfo = await FileSystem.getInfoAsync(BOOK_COVERS_DIR);
            if (!dirInfo.exists) {
              await FileSystem.makeDirectoryAsync(BOOK_COVERS_DIR, { intermediates: true });
            }

            for (const book of data) {
              if (book.cover_image_url) {
                const remoteUrl = resolveImageUrl(book.cover_image_url);
                if (!remoteUrl) continue;

                const parts = book.cover_image_url.split('/');
                const filename = parts[parts.length - 1];
                const localUri = BOOK_COVERS_DIR + filename;

                const fileInfo = await FileSystem.getInfoAsync(localUri);
                if (!fileInfo.exists) {
                  FileSystem.downloadAsync(remoteUrl, localUri).catch(() => {});
                }
              }
            }
          } catch (imgErr) {
            console.warn('[SyncService] Failed pre-caching cover images:', imgErr);
          }

          newestTimestamp = data.reduce((max: string, item: any) => 
            !max || item.updated_at > max ? item.updated_at : max, newestTimestamp
          );
          
          if (data.length < 100) {
            hasMore = false;
          } else {
            page++;
          }
        } else {
          hasMore = false;
        }
      }
      
      if (newestTimestamp !== lastSyncBooks) {
        await AsyncStorage.setItem(SYNC_KEYS.BOOKS, newestTimestamp);
        console.log(`[SyncService] Books cache updated incrementally up to: ${newestTimestamp}`);
      }
    } catch (err: any) {
      console.warn('[SyncService] Books sync skipped:', err.message);
    }

    // 2. Sync Students Cache (users in school)
    try {
      let lastSyncStudents = await AsyncStorage.getItem(SYNC_KEYS.STUDENTS) || '';
      let page = 1;
      let hasMore = true;
      let newestTimestamp = lastSyncStudents;

      while (hasMore) {
        const params: any = { sync: 'true', limit: 100, page };
        if (lastSyncStudents) params.updated_after = lastSyncStudents;

        const res = await usersAPI.list(params);
        const data = res.data.data || [];

        if (data.length > 0) {
          cacheStudents(data);
          newestTimestamp = data.reduce((max: string, item: any) => 
            !max || item.updated_at > max ? item.updated_at : max, newestTimestamp
          );
          
          if (data.length < 100) {
            hasMore = false;
          } else {
            page++;
          }
        } else {
          hasMore = false;
        }
      }
      
      if (newestTimestamp !== lastSyncStudents) {
        await AsyncStorage.setItem(SYNC_KEYS.STUDENTS, newestTimestamp);
        console.log(`[SyncService] Students cache updated incrementally up to: ${newestTimestamp}`);
      }
    } catch (err: any) {
      console.warn('[SyncService] Students sync skipped:', err.message);
    }

    // 3. Sync Borrowings Cache
    try {
      let lastSyncBorrowings = await AsyncStorage.getItem(SYNC_KEYS.BORROWINGS) || '';
      let page = 1;
      let hasMore = true;
      let newestTimestamp = lastSyncBorrowings;

      while (hasMore) {
        const params: any = { sync: 'true', limit: 100, page };
        if (lastSyncBorrowings) params.updated_after = lastSyncBorrowings;

        const res = await borrowingsAPI.list(params);
        const data = res.data.data || [];

        if (data.length > 0) {
          cacheBorrowings(data);
          newestTimestamp = data.reduce((max: string, item: any) => 
            !max || item.updated_at > max ? item.updated_at : max, newestTimestamp
          );
          
          if (data.length < 100) {
            hasMore = false;
          } else {
            page++;
          }
        } else {
          hasMore = false;
        }
      }
      
      if (newestTimestamp !== lastSyncBorrowings) {
        await AsyncStorage.setItem(SYNC_KEYS.BORROWINGS, newestTimestamp);
        console.log(`[SyncService] Borrowings cache updated incrementally up to: ${newestTimestamp}`);
      }
    } catch (err: any) {
      console.warn('[SyncService] Borrowings sync skipped:', err.message);
    }

    // 4. Sync Notifications Cache
    try {
      let lastSyncNotifications = await AsyncStorage.getItem(SYNC_KEYS.NOTIFICATIONS) || '';
      let page = 1;
      let hasMore = true;
      let newestTimestamp = lastSyncNotifications;

      while (hasMore) {
        const params: any = { sync: 'true', limit: 100, page };
        if (lastSyncNotifications) params.updated_after = lastSyncNotifications;

        const res = await notificationsAPI.list(params);
        const data = res.data.data || [];

        if (data.length > 0) {
          cacheNotifications(data);
          newestTimestamp = data.reduce((max: string, item: any) => 
            !max || item.updated_at > max ? item.updated_at : max, newestTimestamp
          );
          
          if (data.length < 100) {
            hasMore = false;
          } else {
            page++;
          }
        } else {
          hasMore = false;
        }
      }
      
      if (newestTimestamp !== lastSyncNotifications) {
        await AsyncStorage.setItem(SYNC_KEYS.NOTIFICATIONS, newestTimestamp);
        console.log(`[SyncService] Notifications cache updated incrementally up to: ${newestTimestamp}`);
      }
    } catch (err: any) {
      console.warn('[SyncService] Notifications sync skipped:', err.message);
    }

  } finally {
    isSyncingMetadata = false;
    useSyncDiagnosticsStore.getState().recordSyncStart(false);
    useSyncDiagnosticsStore.getState().recordSyncSuccess();
    console.log('[SyncService] Background metadata caching sync finished');
  }
};

/**
 * Start periodic background synchronization every 30 seconds.
 */
export const startAutoSync = (onProgressUpdate?: () => void): (() => void) => {
  const interval = setInterval(async () => {
    try {
      // STRICT RULE: Background sync and queue replay only runs for School Admin
      const user = useAuthStore.getState().user;
      if (user?.user_role !== 'school_admin') {
        return;
      }

      // Replay pending offline actions first to maintain strict event sequence order
      await syncOfflineScans(onProgressUpdate);
      
      // Then pull the latest backend caches
      await syncMetadataAndCache();
    } catch (err) {
      console.error('[SyncService] Auto-sync loop error:', err);
    }
  }, 30000);

  // Return clean-up function
  return () => clearInterval(interval);
};
