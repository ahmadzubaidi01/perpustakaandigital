import api, { qrAPI, borrowingsAPI } from './api';
import { getPendingScans, markScanSynced, markScanFailed, OfflineScan } from './db';

let isSyncing = false;

/**
 * Check if the device is online by pinging the backend API.
 */
export const checkOnlineStatus = async (): Promise<boolean> => {
  try {
    // Quick ping to check connectivity
    await api.get('/v1/auth/me', { timeout: 3000 });
    return true;
  } catch (error: any) {
    // If it's a 401 Unauthorized, we are online but just unauthenticated.
    if (error.response?.status === 401) {
      return true;
    }
    return false;
  }
};

/**
 * Synchronize all pending offline scans to the backend server.
 */
export const syncOfflineScans = async (onProgressUpdate?: () => void): Promise<void> => {
  if (isSyncing) return;

  const isOnline = await checkOnlineStatus();
  if (!isOnline) {
    console.log('[SyncService] Device is offline. Postponing sync.');
    return;
  }

  const pending = getPendingScans();
  if (pending.length === 0) {
    return;
  }

  isSyncing = true;
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
        // If it's a network error/timeout, we stop the sync queue to prevent dropping connection midway.
        const isNetworkError = !error.response;
        if (isNetworkError) {
          console.warn('[SyncService] Network error encountered during sync. Stopping queue.');
          break;
        }

        // If it's an API validation/business error, mark it as failed with error msg from server
        const errMsg = error.response?.data?.message || error.message || 'Error tidak diketahui';
        markScanFailed(scan.id, errMsg);
        if (onProgressUpdate) onProgressUpdate();
      }
    }
  } finally {
    isSyncing = false;
    console.log('[SyncService] Sync process finished');
  }
};

/**
 * Start periodic syncing every 30 seconds if online.
 */
export const startAutoSync = (onProgressUpdate?: () => void): (() => void) => {
  const interval = setInterval(async () => {
    try {
      await syncOfflineScans(onProgressUpdate);
    } catch (err) {
      console.error('[SyncService] Auto-sync error:', err);
    }
  }, 30000);

  // Return clean-up function
  return () => clearInterval(interval);
};
