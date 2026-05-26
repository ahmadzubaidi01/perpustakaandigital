import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import api, { qrAPI, borrowingsAPI, booksAPI, usersAPI, notificationsAPI } from './api';
import { API_BASE_URL } from '../constants/theme';
import { 
  getPendingScans, 
  markScanSynced, 
  markScanFailed, 
  cacheBooks, 
  cacheStudents, 
  cacheBorrowings, 
  cacheNotifications,
  initDatabase,
  OfflineScan 
} from './db';
import { useAuthStore } from '../store/authStore';

let isSyncingQueue = false;
let isSyncingMetadata = false;

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

  const isOnline = await checkOnlineStatus();
  if (!isOnline) {
    console.log('[SyncService] Device is offline. Postponing sync queue.');
    return;
  }

  const pending = getPendingScans();
  if (pending.length === 0) {
    return;
  }

  isSyncingQueue = true;
  console.log(`[SyncService] Starting sync for ${pending.length} pending scans`);

  try {
    for (const scan of pending) {
      if (!scan.id) continue;

      try {
        console.log(`[SyncService] Syncing scan id=${scan.id}, type=${scan.scan_type}`);

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

        // Mark as synced on success
        markScanSynced(scan.id);
        if (onProgressUpdate) onProgressUpdate();

      } catch (error: any) {
        // If it's a network/server failure, stop queue replay to preserve ordering
        const isNetworkError = !error.response;
        const isServerError = error.response?.status >= 500;
        
        if (isNetworkError || isServerError) {
          console.warn('[SyncService] Connection or server error during sync queue. Stopping queue.');
          break;
        }

        // Business/Validation error (e.g. book already borrowed, student limit exceeded)
        // Mark as failed and store the error message from the backend
        const errMsg = error.response?.data?.message || error.message || 'Validation error';
        markScanFailed(scan.id, errMsg);
        if (onProgressUpdate) onProgressUpdate();
      }
    }
  } finally {
    isSyncingQueue = false;
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
  if (!isOnline) {
    return;
  }

  isSyncingMetadata = true;
  console.log('[SyncService] Starting background metadata cache synchronization...');

  try {
    initDatabase();

    // 1. Sync Books Cache
    try {
      const lastSyncBooks = await AsyncStorage.getItem(SYNC_KEYS.BOOKS) || '';
      const params: any = { sync: 'true', limit: 100 };
      if (lastSyncBooks) params.updated_after = lastSyncBooks;
      
      const res = await booksAPI.list(params);
      const data = res.data.data || [];
      
      if (data.length > 0) {
        cacheBooks(data);
        const newestTimestamp = data.reduce((max: string, item: any) => 
          !max || item.updated_at > max ? item.updated_at : max, lastSyncBooks
        );
        await AsyncStorage.setItem(SYNC_KEYS.BOOKS, newestTimestamp);
        console.log(`[SyncService] Books cache updated incrementally: ${data.length} items`);
      }
    } catch (err: any) {
      console.warn('[SyncService] Books sync skipped:', err.message);
    }

    // 2. Sync Students Cache (users in school)
    try {
      const lastSyncStudents = await AsyncStorage.getItem(SYNC_KEYS.STUDENTS) || '';
      const params: any = { sync: 'true', limit: 100 };
      if (lastSyncStudents) params.updated_after = lastSyncStudents;

      const res = await usersAPI.list(params);
      const data = res.data.data || [];

      if (data.length > 0) {
        cacheStudents(data);
        const newestTimestamp = data.reduce((max: string, item: any) => 
          !max || item.updated_at > max ? item.updated_at : max, lastSyncStudents
        );
        await AsyncStorage.setItem(SYNC_KEYS.STUDENTS, newestTimestamp);
        console.log(`[SyncService] Students cache updated incrementally: ${data.length} items`);
      }
    } catch (err: any) {
      console.warn('[SyncService] Students sync skipped:', err.message);
    }

    // 3. Sync Borrowings Cache
    try {
      const lastSyncBorrowings = await AsyncStorage.getItem(SYNC_KEYS.BORROWINGS) || '';
      const params: any = { sync: 'true', limit: 100 };
      if (lastSyncBorrowings) params.updated_after = lastSyncBorrowings;

      const res = await borrowingsAPI.list(params);
      const data = res.data.data || [];

      if (data.length > 0) {
        cacheBorrowings(data);
        const newestTimestamp = data.reduce((max: string, item: any) => 
          !max || item.updated_at > max ? item.updated_at : max, lastSyncBorrowings
        );
        await AsyncStorage.setItem(SYNC_KEYS.BORROWINGS, newestTimestamp);
        console.log(`[SyncService] Borrowings cache updated incrementally: ${data.length} items`);
      }
    } catch (err: any) {
      console.warn('[SyncService] Borrowings sync skipped:', err.message);
    }

    // 4. Sync Notifications Cache
    try {
      const lastSyncNotifications = await AsyncStorage.getItem(SYNC_KEYS.NOTIFICATIONS) || '';
      const params: any = { sync: 'true', limit: 100 };
      if (lastSyncNotifications) params.updated_after = lastSyncNotifications;

      const res = await notificationsAPI.list(params);
      const data = res.data.data || [];

      if (data.length > 0) {
        cacheNotifications(data);
        const newestTimestamp = data.reduce((max: string, item: any) => 
          !max || item.updated_at > max ? item.updated_at : max, lastSyncNotifications
        );
        await AsyncStorage.setItem(SYNC_KEYS.NOTIFICATIONS, newestTimestamp);
        console.log(`[SyncService] Notifications cache updated incrementally: ${data.length} items`);
      }
    } catch (err: any) {
      console.warn('[SyncService] Notifications sync skipped:', err.message);
    }

  } finally {
    isSyncingMetadata = false;
    console.log('[SyncService] Background metadata caching sync finished');
  }
};

/**
 * Start periodic background synchronization every 30 seconds.
 */
export const startAutoSync = (onProgressUpdate?: () => void): (() => void) => {
  const interval = setInterval(async () => {
    try {
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
