import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import * as FileSystem from 'expo-file-system/legacy';
import { qrAPI, borrowingsAPI, booksAPI, usersAPI, notificationsAPI, categoriesAPI } from './api';
import { API_BASE_URL } from '../constants/theme';
import { resolveImageUrl } from '../utils/imageUtils';
import { 
  getPendingSyncQueue, 
  updateSyncQueueStatus, 
  deleteFromSyncQueue, 
  cacheBooks, 
  cacheStudents, 
  cacheBorrowings, 
  cacheNotifications,
  initDatabase,
  clearSyncedOfflineScans,
  cacheCategories,
  cacheBookQrs,
  updateOfflineBookId,
  updateOfflineStudentId,
  updateOfflineCategoryId,
  SyncQueueItem
} from './db';
import { useAuthStore } from '../store/authStore';
import { useSyncDiagnosticsStore } from '../store/syncDiagnosticsStore';
import { useSyncEngineStore } from '../store/syncEngineStore';

let syncCooldownUntil = 0;
let backoffDelay = 5000;

const SYNC_KEYS = {
  BOOKS: 'sync_last_time_books',
  STUDENTS: 'sync_last_time_students',
  BORROWINGS: 'sync_last_time_borrowings',
  NOTIFICATIONS: 'sync_last_time_notifications',
};

export const checkOnlineStatus = async (): Promise<boolean> => {
  try {
    const netState = await NetInfo.fetch();
    if (!netState.isConnected) return false;

    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 3000);
    
    const res = await fetch(`${API_BASE_URL}/health`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: controller.signal,
    });
    clearTimeout(id);
    return res.status === 200;
  } catch (error) {
    return false;
  }
};

/**
 * Unified Sync Engine: Processes the global sync queue sequentially to guarantee ordering.
 */
export const processSyncQueue = async (onProgressUpdate?: () => void): Promise<void> => {
  const syncStore = useSyncEngineStore.getState();
  if (syncStore.currentState === 'SYNCING') return;

  if (Date.now() < syncCooldownUntil) {
    console.log('[SyncEngine] In retry backoff cooldown. Bypassing sync queue replay.');
    syncStore.setState('WAITING_NETWORK');
    return;
  }

  const isOnline = await checkOnlineStatus();
  useSyncDiagnosticsStore.getState().setOfflineSyncRecovery(!isOnline);

  if (!isOnline) {
    console.log('[SyncEngine] Device is offline. Postponing sync queue.');
    syncStore.setState('OFFLINE');
    return;
  }

  const queue = getPendingSyncQueue();
  syncStore.setPendingItemsCount(queue.length);

  if (queue.length === 0) {
    syncStore.setState('IDLE');
    return;
  }

  syncStore.setState('SYNCING');
  useSyncDiagnosticsStore.getState().recordSyncStart(true);
  console.log(`[SyncEngine] Starting execution for ${queue.length} pending operations`);

  try {
    for (const item of queue) {
      if (!item.id) continue;
      
      syncStore.setCurrentOperationId(item.operation_id);
      console.log(`[SyncEngine] Executing ${item.operation_type} on ${item.entity_name} (OpID: ${item.operation_id})`);

      try {
        const payload = JSON.parse(item.payload);
        const headers: any = { 'X-Operation-ID': item.operation_id };
        if (item.base_updated_at) {
          headers['X-Base-Updated-At'] = item.base_updated_at;
        }

        // --- DISPATCH TO CORRECT API BASED ON ENTITY AND ACTION ---
        let serverResponse: any = null;

        if (item.entity_name === 'books') {
          const formData = new FormData();
          Object.keys(payload).forEach(key => {
            if (key !== 'cover_image_url') {
              formData.append(key, payload[key] !== null ? String(payload[key]) : '');
            }
          });
          if (payload.cover_image_url && payload.cover_image_url.startsWith('file://')) {
            formData.append('cover_image', {
              uri: payload.cover_image_url,
              name: `cover_${Date.now()}.jpg`,
              type: 'image/jpeg',
            } as any);
          }
          
          if (item.operation_type === 'CREATE') {
            const res = await booksAPI.create(formData, headers);
            serverResponse = res.data.data;
            updateOfflineBookId(parseInt(item.entity_id, 10), serverResponse.book_id, serverResponse.book_code);
          } else if (item.operation_type === 'UPDATE') {
            await booksAPI.update(parseInt(item.entity_id, 10), formData, headers);
          } else if (item.operation_type === 'DELETE') {
            await booksAPI.delete(parseInt(item.entity_id, 10), headers);
          }
        } 
        else if (item.entity_name === 'users') {
          if (item.operation_type === 'CREATE') {
            const res = await usersAPI.create(payload, headers);
            serverResponse = res.data.data;
            updateOfflineStudentId(parseInt(item.entity_id, 10), serverResponse.user_id);
          } else if (item.operation_type === 'UPDATE') {
            await usersAPI.update(parseInt(item.entity_id, 10), payload, headers);
          } else if (item.operation_type === 'DELETE') {
            await usersAPI.delete(parseInt(item.entity_id, 10), headers);
          }
        }
        else if (item.entity_name === 'categories') {
          if (item.operation_type === 'CREATE') {
            const res = await categoriesAPI.create(payload, headers);
            serverResponse = res.data.data;
            updateOfflineCategoryId(parseInt(item.entity_id, 10), serverResponse.category_id);
          } else if (item.operation_type === 'UPDATE') {
            await categoriesAPI.update(parseInt(item.entity_id, 10), payload, headers);
          } else if (item.operation_type === 'DELETE') {
            await categoriesAPI.delete(parseInt(item.entity_id, 10), headers);
          }
        }
        else if (item.entity_name === 'qr') {
          if (item.operation_type === 'CREATE') {
            await qrAPI.generate(payload, headers);
          }
        }
        else if (item.entity_name === 'scans') {
          if (payload.scan_type === 'borrowing') {
            await borrowingsAPI.quickBorrow(payload, headers);
          } else if (payload.scan_type === 'returning') {
            await borrowingsAPI.quickReturn(payload, headers);
          } else {
            await qrAPI.scan(payload, headers);
          }
        }

        // Success - remove from queue
        deleteFromSyncQueue(item.id);
        
        // Re-calculate queue length
        const newLength = getPendingSyncQueue().length;
        syncStore.setPendingItemsCount(newLength);
        
        if (onProgressUpdate) onProgressUpdate();
        backoffDelay = 5000; // Reset backoff

      } catch (error: any) {
        const status = error.response?.status;
        const errMsg = error.response?.data?.message || error.message;

        // 409 Conflict Resolution -> Server Wins
        if (status === 409) {
          console.warn(`[SyncEngine] Conflict detected for OpID ${item.operation_id}. Server Wins. Removing local update.`);
          updateSyncQueueStatus(item.id, 'conflict', 'Conflict: Server has newer version');
          useSyncDiagnosticsStore.getState().logSyncFailure(item.entity_name, 'Data conflict. Local changes discarded.');
          // Ideally we would trigger a targeted cache refresh here
          continue; 
        }

        // Connection or 5xx error -> Stop queue and backoff
        if (!error.response || status >= 500) {
          console.warn('[SyncEngine] Connection or server error. Stopping queue.');
          useSyncDiagnosticsStore.getState().incrementSyncRetries();
          
          backoffDelay = Math.min(backoffDelay * 2, 120000);
          syncCooldownUntil = Date.now() + backoffDelay;
          
          syncStore.setState('RETRYING');
          syncStore.setErrorMessage('Network instability. Will retry later.');
          break;
        }

        // Validation Error (4xx)
        if (item.retry_count >= 5) {
          console.warn(`[SyncEngine] Dead-letter: Operation ${item.operation_id} failed 5 times.`);
          updateSyncQueueStatus(item.id, 'failed', errMsg);
        } else {
          updateSyncQueueStatus(item.id, 'pending', errMsg);
        }
      }
    }

    if (getPendingSyncQueue().length === 0) {
      syncStore.setState('SUCCESS');
      syncStore.setLastSyncTime(new Date().toISOString());
      useSyncDiagnosticsStore.getState().recordSyncSuccess();
    }
  } finally {
    if (useSyncEngineStore.getState().currentState === 'SYNCING') {
      useSyncEngineStore.getState().setState('IDLE');
    }
    useSyncDiagnosticsStore.getState().recordSyncStart(false);
    console.log('[SyncEngine] Queue execution finished.');
  }
};

/**
 * Metadata caching for School Admin.
 */
export const syncMetadataAndCache = async (): Promise<void> => {
  const user = useAuthStore.getState().user;
  if (user?.user_role !== 'school_admin') return;

  const isOnline = await checkOnlineStatus();
  if (!isOnline) return;

  try {
    initDatabase();
    
    // Books Cache
    try {
      let lastSyncBooks = await AsyncStorage.getItem(SYNC_KEYS.BOOKS) || '';
      const params: any = { sync: 'true', limit: 500 };
      if (lastSyncBooks) params.updated_after = lastSyncBooks;
      const res = await booksAPI.list(params);
      const data = res.data.data || [];
      if (data.length > 0) {
        cacheBooks(data);
        const newest = data.reduce((max: string, item: any) => (!max || item.updated_at > max ? item.updated_at : max), lastSyncBooks);
        await AsyncStorage.setItem(SYNC_KEYS.BOOKS, newest);
      }
    } catch (err) {}

    // Students Cache
    try {
      let lastSyncStudents = await AsyncStorage.getItem(SYNC_KEYS.STUDENTS) || '';
      const params: any = { sync: 'true', limit: 500 };
      if (lastSyncStudents) params.updated_after = lastSyncStudents;
      const res = await usersAPI.list(params);
      const data = res.data.data || [];
      if (data.length > 0) {
        cacheStudents(data);
        const newest = data.reduce((max: string, item: any) => (!max || item.updated_at > max ? item.updated_at : max), lastSyncStudents);
        await AsyncStorage.setItem(SYNC_KEYS.STUDENTS, newest);
      }
    } catch (err) {}

    // Categories Cache
    try {
      const res = await categoriesAPI.list();
      const data = res.data.data || [];
      if (data.length > 0) cacheCategories(data);
    } catch (err) {}

  } finally {
    console.log('[SyncEngine] Metadata sync finished');
  }
};

/**
 * Main trigger for unified sync pipeline.
 */
export const runFullSynchronization = async (onProgressUpdate?: () => void): Promise<void> => {
  const user = useAuthStore.getState().user;
  if (user?.user_role !== 'school_admin') return;

  await processSyncQueue(onProgressUpdate);
  await syncMetadataAndCache();
  
  // Cleanup old scans
  clearSyncedOfflineScans();
};
