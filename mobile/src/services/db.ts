import * as SQLite from 'expo-sqlite';

// Use global storage to prevent multiple initialization and pointer invalidation issues during Fast Refresh / HMR
let db: any = (global as any).sqliteDb || null;

export interface CachedBook {
  book_id: number;
  book_title: string;
  author_name: string;
  book_status: string;
  available_stock: number;
  total_stock: number;
  cover_image_url?: string | null;
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
 * Handle database errors. If a JNI pointer/connection error is detected,
 * resets the connection singleton so that it will self-heal and re-initialize on the next query.
 */
const handleDatabaseError = (error: any, operationName: string) => {
  console.error(`[SQLite] Error in ${operationName}:`, error);
  const errorStr = String(error);
  if (
    errorStr.includes('NullPointerException') || 
    errorStr.includes('NativeDatabase') || 
    errorStr.includes('prepareSync') || 
    errorStr.includes('closed') ||
    errorStr.includes('rejected')
  ) {
    console.warn('[SQLite] Native database reference is corrupted or closed. Resetting db connection instance.');
    db = null;
    (global as any).sqliteDb = null;
  }
};

/**
 * Initialize SQLite database and tables.
 */
export const initDatabase = (): void => {
  if (db) {
    console.log('[SQLite] Database already initialized');
    return;
  }
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
        cover_image_url TEXT,
        created_at TEXT
      );
    `);

    // Self-healing migration for existing databases
    try {
      db.execSync('ALTER TABLE books ADD COLUMN cover_image_url TEXT;');
      console.log('[SQLite] Migration successful: added cover_image_url column to books table');
    } catch (e) {
      // Column already exists, ignore
    }

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

    (global as any).sqliteDb = db;
    console.log('[SQLite] Database initialized successfully');
  } catch (error) {
    db = null;
    (global as any).sqliteDb = null;
    console.error('[SQLite] Failed to initialize database:', error);
  }
};

/**
 * Check and ensure database connection is healthy before executing any queries.
 */
const ensureDatabase = (): boolean => {
  if (!db) {
    initDatabase();
  }
  return db !== null;
};

/**
 * Cache books from online list into offline SQLite.
 */
export const cacheBooks = (books: CachedBook[]): void => {
  if (!ensureDatabase()) return;
  try {
    // Truncate existing books
    db.execSync('DELETE FROM books;');

    // Insert new books
    for (const book of books) {
      db.runSync(
        `INSERT INTO books (book_id, book_title, author_name, book_status, available_stock, total_stock, cover_image_url, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
        book.book_id,
        book.book_title,
        book.author_name || '',
        book.book_status || 'available',
        book.available_stock || 0,
        book.total_stock || 0,
        book.cover_image_url || null,
        book.created_at || new Date().toISOString()
      );
    }
    console.log(`[SQLite] Cached ${books.length} books successfully`);
  } catch (error) {
    handleDatabaseError(error, 'cacheBooks');
  }
};

/**
 * Retrieve books from local SQLite cache.
 */
export const getCachedBooks = (searchQuery?: string): CachedBook[] => {
  if (!ensureDatabase()) return [];
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
    handleDatabaseError(error, 'getCachedBooks');
    return [];
  }
};

/**
 * Queue a scanned transaction offline when connection is unavailable.
 */
export const queueOfflineScan = (scan: Omit<OfflineScan, 'timestamp' | 'sync_status'>): void => {
  if (!ensureDatabase()) return;
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
    handleDatabaseError(error, 'queueOfflineScan');
    throw error;
  }
};

/**
 * Get all pending offline scans for syncing.
 */
export const getPendingScans = (): OfflineScan[] => {
  if (!ensureDatabase()) return [];
  try {
    return db.getAllSync("SELECT * FROM offline_scans WHERE sync_status = 'pending' ORDER BY id ASC;") as OfflineScan[];
  } catch (error) {
    handleDatabaseError(error, 'getPendingScans');
    return [];
  }
};

/**
 * Get all queued scans (for queue manager UI).
 */
export const getAllScans = (): OfflineScan[] => {
  if (!ensureDatabase()) return [];
  try {
    return db.getAllSync('SELECT * FROM offline_scans ORDER BY id DESC;') as OfflineScan[];
  } catch (error) {
    handleDatabaseError(error, 'getAllScans');
    return [];
  }
};

/**
 * Mark a queued scan as successfully synchronized.
 */
export const markScanSynced = (id: number): void => {
  if (!ensureDatabase()) return;
  try {
    db.runSync("UPDATE offline_scans SET sync_status = 'synced', error_message = NULL WHERE id = ?;", id);
    console.log(`[SQLite] Scan id=${id} marked as synced`);
  } catch (error) {
    handleDatabaseError(error, 'markScanSynced');
  }
};

/**
 * Mark a queued scan as failed with validation error.
 */
export const markScanFailed = (id: number, errorMessage: string): void => {
  if (!ensureDatabase()) return;
  try {
    db.runSync("UPDATE offline_scans SET sync_status = 'failed', error_message = ? WHERE id = ?;", errorMessage, id);
    console.log(`[SQLite] Scan id=${id} marked as failed:`, errorMessage);
  } catch (error) {
    handleDatabaseError(error, 'markScanFailed');
  }
};

/**
 * Clear synced items from scans queue.
 */
export const clearSyncedScans = (): void => {
  if (!ensureDatabase()) return;
  try {
    db.runSync("DELETE FROM offline_scans WHERE sync_status = 'synced';");
    console.log('[SQLite] Cleared all synced scans from queue');
  } catch (error) {
    handleDatabaseError(error, 'clearSyncedScans');
  }
};
