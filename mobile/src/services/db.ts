import * as SQLite from 'expo-sqlite';

let db: any = null;

export interface CachedBook {
  book_id: number;
  book_title: string;
  author_name: string;
  book_status: string;
  available_stock: number;
  total_stock: number;
  created_at?: string;
}

export interface OfflineScan {
  id?: number;
  qr_payload: string;
  scan_type: 'borrowing' | 'returning' | 'verification' | 'inventory' | 'audit';
  student_id?: number | null;
  latitude?: number | null;
  longitude?: number | null;
  timestamp: string;
  sync_status: 'pending' | 'synced' | 'failed';
  error_message?: string | null;
}

/**
 * Initialize SQLite database and tables.
 */
export const initDatabase = (): void => {
  try {
    db = SQLite.openDatabaseSync('perpustakaan_digital.db');
    
    // Create books cache table
    db.execSync(`
      CREATE TABLE IF NOT EXISTS books (
        book_id INTEGER PRIMARY KEY,
        book_title TEXT NOT NULL,
        author_name TEXT,
        book_status TEXT,
        available_stock INTEGER,
        total_stock INTEGER,
        created_at TEXT
      );
    `);

    // Create offline scan queue table
    db.execSync(`
      CREATE TABLE IF NOT EXISTS offline_scans (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        qr_payload TEXT NOT NULL,
        scan_type TEXT NOT NULL,
        student_id INTEGER,
        latitude REAL,
        longitude REAL,
        timestamp TEXT NOT NULL,
        sync_status TEXT DEFAULT 'pending',
        error_message TEXT
      );
    `);

    console.log('[SQLite] Database initialized successfully');
  } catch (error) {
    console.error('[SQLite] Failed to initialize database:', error);
  }
};

/**
 * Cache books from online list into offline SQLite.
 */
export const cacheBooks = (books: CachedBook[]): void => {
  if (!db) return;
  try {
    // Truncate existing books
    db.execSync('DELETE FROM books;');

    // Insert new books
    for (const book of books) {
      db.runSync(
        `INSERT INTO books (book_id, book_title, author_name, book_status, available_stock, total_stock, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?);`,
        book.book_id,
        book.book_title,
        book.author_name || '',
        book.book_status || 'available',
        book.available_stock || 0,
        book.total_stock || 0,
        book.created_at || new Date().toISOString()
      );
    }
    console.log(`[SQLite] Cached ${books.length} books successfully`);
  } catch (error) {
    console.error('[SQLite] Failed to cache books:', error);
  }
};

/**
 * Retrieve books from local SQLite cache.
 */
export const getCachedBooks = (searchQuery?: string): CachedBook[] => {
  if (!db) return [];
  try {
    if (searchQuery) {
      return db.getAllSync(
        'SELECT * FROM books WHERE book_title LIKE ? OR author_name LIKE ? ORDER BY book_id DESC;',
        `%${searchQuery}%`,
        `%${searchQuery}%`
      ) as CachedBook[];
    }
    return db.getAllSync('SELECT * FROM books ORDER BY book_id DESC;') as CachedBook[];
  } catch (error) {
    console.error('[SQLite] Failed to fetch cached books:', error);
    return [];
  }
};

/**
 * Queue a scanned transaction offline when connection is unavailable.
 */
export const queueOfflineScan = (scan: Omit<OfflineScan, 'timestamp' | 'sync_status'>): void => {
  if (!db) return;
  try {
    const timestamp = new Date().toISOString();
    db.runSync(
      `INSERT INTO offline_scans (qr_payload, scan_type, student_id, latitude, longitude, timestamp, sync_status)
       VALUES (?, ?, ?, ?, ?, ?, 'pending');`,
      scan.qr_payload,
      scan.scan_type,
      scan.student_id || null,
      scan.latitude || null,
      scan.longitude || null,
      timestamp
    );
    console.log('[SQLite] Queued offline scan successfully:', scan.qr_payload);
  } catch (error) {
    console.error('[SQLite] Failed to queue offline scan:', error);
    throw error;
  }
};

/**
 * Get all pending offline scans for syncing.
 */
export const getPendingScans = (): OfflineScan[] => {
  if (!db) return [];
  try {
    return db.getAllSync("SELECT * FROM offline_scans WHERE sync_status = 'pending' ORDER BY id ASC;") as OfflineScan[];
  } catch (error) {
    console.error('[SQLite] Failed to fetch pending scans:', error);
    return [];
  }
};

/**
 * Get all queued scans (for queue manager UI).
 */
export const getAllScans = (): OfflineScan[] => {
  if (!db) return [];
  try {
    return db.getAllSync('SELECT * FROM offline_scans ORDER BY id DESC;') as OfflineScan[];
  } catch (error) {
    console.error('[SQLite] Failed to fetch all scans:', error);
    return [];
  }
};

/**
 * Mark a queued scan as successfully synchronized.
 */
export const markScanSynced = (id: number): void => {
  if (!db) return;
  try {
    db.runSync("UPDATE offline_scans SET sync_status = 'synced', error_message = NULL WHERE id = ?;", id);
    console.log(`[SQLite] Scan id=${id} marked as synced`);
  } catch (error) {
    console.error('[SQLite] Failed to mark scan synced:', error);
  }
};

/**
 * Mark a queued scan as failed with validation error.
 */
export const markScanFailed = (id: number, errorMessage: string): void => {
  if (!db) return;
  try {
    db.runSync("UPDATE offline_scans SET sync_status = 'failed', error_message = ? WHERE id = ?;", errorMessage, id);
    console.log(`[SQLite] Scan id=${id} marked as failed:`, errorMessage);
  } catch (error) {
    console.error('[SQLite] Failed to mark scan failed:', error);
  }
};

/**
 * Clear synced items from scans queue.
 */
export const clearSyncedScans = (): void => {
  if (!db) return;
  try {
    db.runSync("DELETE FROM offline_scans WHERE sync_status = 'synced';");
    console.log('[SQLite] Cleared all synced scans from queue');
  } catch (error) {
    console.error('[SQLite] Failed to clear synced scans:', error);
  }
};
