import * as SQLite from 'expo-sqlite';

// Use global storage to prevent multiple initialization and pointer invalidation issues during Fast Refresh / HMR
let db: any = (global as any).sqliteDb || null;

export interface CachedBook {
  book_id: number;
  book_code?: string;
  book_title: string;
  author_name: string;
  book_status: string;
  available_stock: number;
  total_stock: number;
  cover_image_url?: string | null;
  created_at?: string;
  updated_at?: string;
  deleted_at?: string | null;
}

export interface CachedStudent {
  user_id: number;
  student_id_number?: string | null;
  full_name: string;
  class_name?: string | null;
  email_address: string;
  phone_number?: string | null;
  member_qr_uuid?: string | null;
  school_id?: number | null;
  user_role?: string | null;
  sync_status?: string | null;
  updated_at?: string;
  deleted_at?: string | null;
}

export interface CachedCategory {
  category_id: number;
  category_name: string;
  sync_status?: string;
  created_at?: string;
  updated_at?: string;
}

export interface CachedBorrowing {
  borrowing_id: number;
  borrowing_code: string;
  user_id: number;
  book_qr_id: number;
  borrowed_at?: string | null;
  due_date?: string | null;
  returned_at?: string | null;
  late_penalty_amount: number;
  penalty_status?: string | null;
  borrowing_status: string;
  approved_by_user_id?: number | null;
  book_id?: number | null;
  book_title?: string | null;
  borrower_name?: string | null;
  borrower_class?: string | null;
  updated_at?: string;
}

export interface CachedNotification {
  notification_id: number;
  notification_title: string;
  notification_message: string;
  notification_type: string;
  is_read: number; // 0 or 1 in SQLite
  created_at: string;
  updated_at?: string;
  deleted_at?: string | null;
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
  retry_count?: number;
}

/**
 * Handle database errors. If a native pointer/connection error is detected,
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
    return;
  }
  try {
    db = SQLite.openDatabaseSync('perpustakaan_digital.db');

    const CURRENT_SCHEMA_VERSION = 3;
    const userVersionRow = db.getFirstSync('PRAGMA user_version;') as any;
    const userVersion = userVersionRow ? userVersionRow.user_version : 0;
    if (userVersion < CURRENT_SCHEMA_VERSION) {
      console.log(`[SQLite] Schema version mismatch (local=${userVersion}, current=${CURRENT_SCHEMA_VERSION}). Rebuilding cache tables.`);
      db.execSync('DROP TABLE IF EXISTS books;');
      db.execSync('DROP TABLE IF EXISTS students;');
      db.execSync('DROP TABLE IF EXISTS borrowings;');
      db.execSync('DROP TABLE IF EXISTS notifications;');
      db.execSync('DROP TABLE IF EXISTS book_qrs;');
      db.execSync('DROP TABLE IF EXISTS categories;');
      db.execSync(`PRAGMA user_version = ${CURRENT_SCHEMA_VERSION};`);
    }

    const addColumnIfNeeded = (tableName: string, columnName: string, columnType: string) => {
      try {
        const info = db.getAllSync(`PRAGMA table_info(${tableName});`);
        const hasColumn = info.some((col: any) => col.name === columnName);
        if (!hasColumn) {
          db.execSync(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnType};`);
          console.log(`[SQLite] Added column ${columnName} to table ${tableName}`);
        }
      } catch (err) {
        // Table may not exist yet, which is fine as CREATE TABLE will construct it with all columns.
      }
    };

    // Perform self-healing schema migrations for existing tables
    addColumnIfNeeded('books', 'book_code', 'TEXT');
    addColumnIfNeeded('books', 'cover_image_url', 'TEXT');
    addColumnIfNeeded('books', 'updated_at', 'TEXT');
    addColumnIfNeeded('books', 'deleted_at', 'TEXT');
    addColumnIfNeeded('books', 'publisher_name', 'TEXT');
    addColumnIfNeeded('books', 'publication_year', 'INTEGER');
    addColumnIfNeeded('books', 'rack_location', 'TEXT');
    addColumnIfNeeded('books', 'category_id', 'INTEGER');
    addColumnIfNeeded('books', 'isbn_code', 'TEXT');
    addColumnIfNeeded('books', 'book_description', 'TEXT');
    addColumnIfNeeded('books', 'school_id', 'INTEGER');
    addColumnIfNeeded('books', 'sync_status', "TEXT DEFAULT 'synced'");
    addColumnIfNeeded('students', 'member_qr_uuid', 'TEXT');
    addColumnIfNeeded('students', 'user_role', 'TEXT');
    addColumnIfNeeded('students', 'sync_status', "TEXT DEFAULT 'synced'");
    addColumnIfNeeded('students', 'updated_at', 'TEXT');
    addColumnIfNeeded('students', 'deleted_at', 'TEXT');
    addColumnIfNeeded('borrowings', 'updated_at', 'TEXT');
    addColumnIfNeeded('notifications', 'updated_at', 'TEXT');
    addColumnIfNeeded('notifications', 'deleted_at', 'TEXT');
    addColumnIfNeeded('offline_scans', 'retry_count', 'INTEGER DEFAULT 0');
    addColumnIfNeeded('categories', 'sync_status', "TEXT DEFAULT 'synced'");
    
    // 1. Create books cache table with updated_at/deleted_at support
    db.execSync(`
      CREATE TABLE IF NOT EXISTS books (
        book_id INTEGER PRIMARY KEY,
        book_code TEXT,
        book_title TEXT NOT NULL,
        author_name TEXT,
        book_status TEXT,
        available_stock INTEGER,
        total_stock INTEGER,
        cover_image_url TEXT,
        publisher_name TEXT,
        publication_year INTEGER,
        rack_location TEXT,
        category_id INTEGER,
        isbn_code TEXT,
        book_description TEXT,
        school_id INTEGER,
        sync_status TEXT DEFAULT 'synced',
        created_at TEXT,
        updated_at TEXT,
        deleted_at TEXT
      );
    `);
    db.execSync('CREATE INDEX IF NOT EXISTS idx_books_title ON books(book_title);');
    db.execSync('CREATE INDEX IF NOT EXISTS idx_books_updated_at ON books(updated_at);');

    // 2. Create students cache table
    db.execSync(`
      CREATE TABLE IF NOT EXISTS students (
        user_id INTEGER PRIMARY KEY,
        student_id_number TEXT,
        full_name TEXT NOT NULL,
        class_name TEXT,
        email_address TEXT,
        phone_number TEXT,
        member_qr_uuid TEXT,
        school_id INTEGER,
        user_role TEXT DEFAULT 'student_member',
        sync_status TEXT DEFAULT 'synced',
        updated_at TEXT,
        deleted_at TEXT
      );
    `);

    // Create categories cache table
    db.execSync(`
      CREATE TABLE IF NOT EXISTS categories (
        category_id INTEGER PRIMARY KEY,
        category_name TEXT NOT NULL,
        sync_status TEXT DEFAULT 'synced',
        created_at TEXT,
        updated_at TEXT
      );
    `);
    db.execSync('CREATE INDEX IF NOT EXISTS idx_students_name ON students(full_name);');
    db.execSync('CREATE INDEX IF NOT EXISTS idx_students_nis ON students(student_id_number);');
    db.execSync('CREATE INDEX IF NOT EXISTS idx_students_qr ON students(member_qr_uuid);');

    // 3. Create borrowings cache table
    db.execSync(`
      CREATE TABLE IF NOT EXISTS borrowings (
        borrowing_id INTEGER PRIMARY KEY,
        borrowing_code TEXT NOT NULL,
        user_id INTEGER,
        book_qr_id INTEGER,
        borrowed_at TEXT,
        due_date TEXT,
        returned_at TEXT,
        late_penalty_amount REAL,
        penalty_status TEXT,
        borrowing_status TEXT,
        approved_by_user_id INTEGER,
        book_id INTEGER,
        book_title TEXT,
        borrower_name TEXT,
        borrower_class TEXT,
        updated_at TEXT
      );
    `);
    db.execSync('CREATE INDEX IF NOT EXISTS idx_borrowings_code ON borrowings(borrowing_code);');
    db.execSync('CREATE INDEX IF NOT EXISTS idx_borrowings_user ON borrowings(user_id);');

    // 4. Create notifications cache table
    db.execSync(`
      CREATE TABLE IF NOT EXISTS notifications (
        notification_id INTEGER PRIMARY KEY,
        notification_title TEXT NOT NULL,
        notification_message TEXT,
        notification_type TEXT,
        is_read INTEGER DEFAULT 0,
        created_at TEXT,
        updated_at TEXT,
        deleted_at TEXT
      );
    `);
    db.execSync('CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(is_read);');

    // 5. Create offline scan queue table
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
        error_message TEXT,
        retry_count INTEGER DEFAULT 0
      );
    `);
    db.execSync('CREATE INDEX IF NOT EXISTS idx_scans_status ON offline_scans(sync_status);');

    // 6. Create local book QR codes table
    db.execSync(`
      CREATE TABLE IF NOT EXISTS book_qrs (
        book_qr_id INTEGER PRIMARY KEY AUTOINCREMENT,
        book_id INTEGER,
        qr_uuid TEXT UNIQUE,
        qr_serial_number TEXT UNIQUE,
        qr_image_url TEXT,
        qr_status TEXT DEFAULT 'active',
        sync_status TEXT DEFAULT 'pending'
      );
    `);
    db.execSync('CREATE INDEX IF NOT EXISTS idx_book_qrs_book ON book_qrs(book_id);');
    db.execSync('CREATE INDEX IF NOT EXISTS idx_book_qrs_serial ON book_qrs(qr_serial_number);');

    (global as any).sqliteDb = db;
    console.log('[SQLite] All caching tables initialized successfully');
  } catch (error) {
    db = null;
    (global as any).sqliteDb = null;
    console.error('[SQLite] Failed to initialize database:', error);
  }
};

/**
 * Check and ensure database connection is healthy.
 */
const ensureDatabase = (): boolean => {
  if (!db) {
    initDatabase();
  }
  return db !== null;
};

// ==========================================
// BOOKS CACHE OPERATIONS (INCREMENTAL UPSERT)
// ==========================================
export const cacheBooks = (books: CachedBook[]): void => {
  if (!ensureDatabase()) return;
  try {
    for (const book of books) {
      if (book.deleted_at) {
        // Soft delete or hard delete in local DB
        db.runSync('DELETE FROM books WHERE book_id = ?;', book.book_id);
        continue;
      }
      db.runSync(
        `INSERT OR REPLACE INTO books (
          book_id, book_code, book_title, author_name, book_status, 
          available_stock, total_stock, cover_image_url, publisher_name,
          publication_year, rack_location, category_id, isbn_code,
          book_description, school_id, sync_status, created_at, updated_at, deleted_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced', ?, ?, NULL);`,
        book.book_id,
        book.book_code || '',
        book.book_title,
        book.author_name || '',
        book.book_status || 'available',
        book.available_stock || 0,
        book.total_stock || 0,
        book.cover_image_url || null,
        (book as any).publisher_name || '',
        (book as any).publication_year || null,
        (book as any).rack_location || '',
        (book as any).category_id || null,
        (book as any).isbn_code || '',
        (book as any).book_description || '',
        (book as any).school_id || null,
        book.created_at || new Date().toISOString(),
        book.updated_at || new Date().toISOString()
      );
    }
  } catch (error) {
    handleDatabaseError(error, 'cacheBooks');
  }
};

export const getCachedBooks = (searchQuery?: string): CachedBook[] => {
  if (!ensureDatabase()) return [];
  try {
    if (searchQuery) {
      return db.getAllSync(
        'SELECT * FROM books WHERE book_title LIKE ? OR author_name LIKE ? OR book_code LIKE ? ORDER BY book_id DESC;',
        `%${searchQuery}%`,
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

// ==========================================
// STUDENTS CACHE OPERATIONS
// ==========================================
export const cacheStudents = (students: CachedStudent[]): void => {
  if (!ensureDatabase()) return;
  try {
    for (const student of students) {
      if (student.deleted_at) {
        db.runSync('DELETE FROM students WHERE user_id = ?;', student.user_id);
        continue;
      }
      db.runSync(
        `INSERT OR REPLACE INTO students (
          user_id, student_id_number, full_name, class_name, 
          email_address, phone_number, member_qr_uuid, school_id, user_role, sync_status, updated_at, deleted_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced', ?, NULL);`,
        student.user_id,
        student.student_id_number || null,
        student.full_name,
        student.class_name || null,
        student.email_address,
        student.phone_number || null,
        student.member_qr_uuid || null,
        student.school_id || null,
        student.user_role || 'student_member',
        student.updated_at || new Date().toISOString()
      );
    }
  } catch (error) {
    handleDatabaseError(error, 'cacheStudents');
  }
};

export const getCachedStudents = (searchQuery: string): CachedStudent[] => {
  if (!ensureDatabase()) return [];
  try {
    return db.getAllSync(
      `SELECT * FROM students 
       WHERE full_name LIKE ? OR student_id_number LIKE ? OR member_qr_uuid = ?
       ORDER BY full_name ASC LIMIT 20;`,
      `%${searchQuery}%`,
      `%${searchQuery}%`,
      searchQuery
    ) as CachedStudent[];
  } catch (error) {
    handleDatabaseError(error, 'getCachedStudents');
    return [];
  }
};

// ==========================================
// BORROWINGS CACHE OPERATIONS
// ==========================================
export const cacheBorrowings = (borrowings: CachedBorrowing[]): void => {
  if (!ensureDatabase()) return;
  try {
    for (const borrowing of borrowings) {
      db.runSync(
        `INSERT OR REPLACE INTO borrowings (
          borrowing_id, borrowing_code, user_id, book_qr_id, borrowed_at, 
          due_date, returned_at, late_penalty_amount, penalty_status, borrowing_status, 
          approved_by_user_id, book_id, book_title, borrower_name, borrower_class, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        borrowing.borrowing_id,
        borrowing.borrowing_code,
        borrowing.user_id,
        borrowing.book_qr_id,
        borrowing.borrowed_at || null,
        borrowing.due_date || null,
        borrowing.returned_at || null,
        borrowing.late_penalty_amount || 0,
        borrowing.penalty_status || 'unpaid',
        borrowing.borrowing_status,
        borrowing.approved_by_user_id || null,
        borrowing.book_id || (borrowing as any).book_qr?.book?.book_id || null,
        borrowing.book_title || (borrowing as any).book_qr?.book?.book_title || null,
        borrowing.borrower_name || (borrowing as any).borrower?.full_name || null,
        borrowing.borrower_class || (borrowing as any).borrower?.class_name || null,
        borrowing.updated_at || new Date().toISOString()
      );
    }
  } catch (error) {
    handleDatabaseError(error, 'cacheBorrowings');
  }
};

export const getCachedBorrowings = (searchQuery?: string): CachedBorrowing[] => {
  if (!ensureDatabase()) return [];
  try {
    if (searchQuery) {
      return db.getAllSync(
        `SELECT * FROM borrowings 
         WHERE borrowing_code LIKE ? OR borrower_name LIKE ? OR book_title LIKE ? 
         ORDER BY borrowing_id DESC;`,
        `%${searchQuery}%`,
        `%${searchQuery}%`,
        `%${searchQuery}%`
      ) as CachedBorrowing[];
    }
    return db.getAllSync('SELECT * FROM borrowings ORDER BY borrowing_id DESC;') as CachedBorrowing[];
  } catch (error) {
    handleDatabaseError(error, 'getCachedBorrowings');
    return [];
  }
};

// ==========================================
// NOTIFICATIONS CACHE OPERATIONS
// ==========================================
export const cacheNotifications = (notifications: CachedNotification[]): void => {
  if (!ensureDatabase()) return;
  try {
    for (const notif of notifications) {
      if (notif.deleted_at) {
        db.runSync('DELETE FROM notifications WHERE notification_id = ?;', notif.notification_id);
        continue;
      }
      db.runSync(
        `INSERT OR REPLACE INTO notifications (
          notification_id, notification_title, notification_message, 
          notification_type, is_read, created_at, updated_at, deleted_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, NULL);`,
        notif.notification_id,
        notif.notification_title,
        notif.notification_message || '',
        notif.notification_type,
        notif.is_read ? 1 : 0,
        notif.created_at || new Date().toISOString(),
        notif.updated_at || new Date().toISOString()
      );
    }
  } catch (error) {
    handleDatabaseError(error, 'cacheNotifications');
  }
};

export const getCachedNotifications = (): CachedNotification[] => {
  if (!ensureDatabase()) return [];
  try {
    const raw = db.getAllSync('SELECT * FROM notifications ORDER BY notification_id DESC;') as any[];
    return raw.map(notif => ({
      ...notif,
      is_read: notif.is_read === 1
    }));
  } catch (error) {
    handleDatabaseError(error, 'getCachedNotifications');
    return [];
  }
};

export const markCachedNotificationRead = (id: number): void => {
  if (!ensureDatabase()) return;
  try {
    db.runSync('UPDATE notifications SET is_read = 1 WHERE notification_id = ?;', id);
  } catch (error) {
    handleDatabaseError(error, 'markCachedNotificationRead');
  }
};

// ==========================================
// OFFLINE SYNC QUEUE OPERATIONS
// ==========================================
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

export const getPendingScans = (): OfflineScan[] => {
  if (!ensureDatabase()) return [];
  try {
    return db.getAllSync("SELECT * FROM offline_scans WHERE sync_status = 'pending' ORDER BY id ASC;") as OfflineScan[];
  } catch (error) {
    handleDatabaseError(error, 'getPendingScans');
    return [];
  }
};

export const getAllScans = (): OfflineScan[] => {
  if (!ensureDatabase()) return [];
  try {
    return db.getAllSync('SELECT * FROM offline_scans ORDER BY id DESC;') as OfflineScan[];
  } catch (error) {
    handleDatabaseError(error, 'getAllScans');
    return [];
  }
};

export const markScanSynced = (id: number): void => {
  if (!ensureDatabase()) return;
  try {
    db.runSync("UPDATE offline_scans SET sync_status = 'synced', error_message = NULL WHERE id = ?;", id);
    console.log(`[SQLite] Scan id=${id} marked as synced`);
  } catch (error) {
    handleDatabaseError(error, 'markScanSynced');
  }
};

export const markScanFailed = (id: number, errorMessage: string): void => {
  if (!ensureDatabase()) return;
  try {
    db.runSync("UPDATE offline_scans SET sync_status = 'failed', error_message = ? WHERE id = ?;", errorMessage, id);
    console.log(`[SQLite] Scan id=${id} marked as failed:`, errorMessage);
  } catch (error) {
    handleDatabaseError(error, 'markScanFailed');
  }
};

export const incrementScanRetry = (id: number): number => {
  if (!ensureDatabase()) return 0;
  try {
    db.runSync('UPDATE offline_scans SET retry_count = COALESCE(retry_count, 0) + 1 WHERE id = ?;', id);
    const row = db.getFirstSync('SELECT retry_count FROM offline_scans WHERE id = ?;', id) as any;
    return row ? row.retry_count : 0;
  } catch (error) {
    handleDatabaseError(error, 'incrementScanRetry');
    return 0;
  }
};

export const clearSyncedScans = (): void => {
  if (!ensureDatabase()) return;
  try {
    db.runSync("DELETE FROM offline_scans WHERE sync_status = 'synced';");
    console.log('[SQLite] Cleared all synced scans from queue');
  } catch (error) {
    handleDatabaseError(error, 'clearSyncedScans');
  }
};

export const clearFailedScans = (): void => {
  if (!ensureDatabase()) return;
  try {
    db.runSync("DELETE FROM offline_scans WHERE sync_status = 'failed';");
    console.log('[SQLite] Cleared all failed scans from queue');
  } catch (error) {
    handleDatabaseError(error, 'clearFailedScans');
  }
};

export const getCachedBookById = (bookId: number): any => {
  if (!ensureDatabase()) return null;
  try {
    return db.getFirstSync('SELECT * FROM books WHERE book_id = ?;', bookId);
  } catch (error) {
    handleDatabaseError(error, 'getCachedBookById');
    return null;
  }
};

export const getCachedStudentById = (studentId: number): any => {
  if (!ensureDatabase()) return null;
  try {
    return db.getFirstSync('SELECT * FROM students WHERE user_id = ?;', studentId);
  } catch (error) {
    handleDatabaseError(error, 'getCachedStudentById');
    return null;
  }
};

export const insertOfflineBook = (book: any): void => {
  if (!ensureDatabase()) return;
  try {
    db.runSync(
      `INSERT INTO books (
        book_id, book_code, book_title, author_name, book_status,
        available_stock, total_stock, cover_image_url, publisher_name,
        publication_year, rack_location, category_id, isbn_code,
        book_description, school_id, sync_status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?);`,
      book.book_id,
      book.book_code || '',
      book.book_title,
      book.author_name,
      book.book_status || 'available',
      book.available_stock || 0,
      book.total_stock || 0,
      book.cover_image_url || null,
      book.publisher_name || '',
      book.publication_year || null,
      book.rack_location || '',
      book.category_id || null,
      book.isbn_code || '',
      book.book_description || '',
      book.school_id || null,
      book.created_at || new Date().toISOString(),
      book.updated_at || new Date().toISOString()
    );
    console.log('[SQLite] Offline book inserted successfully, ID:', book.book_id);
  } catch (error) {
    handleDatabaseError(error, 'insertOfflineBook');
    throw error;
  }
};

export const getPendingOfflineBooks = (): any[] => {
  if (!ensureDatabase()) return [];
  try {
    return db.getAllSync("SELECT * FROM books WHERE sync_status = 'pending' ORDER BY book_id ASC;") as any[];
  } catch (error) {
    handleDatabaseError(error, 'getPendingOfflineBooks');
    return [];
  }
};

export const insertLocalBookQr = (qr: any): void => {
  if (!ensureDatabase()) return;
  try {
    db.runSync(
      `INSERT INTO book_qrs (book_id, qr_uuid, qr_serial_number, qr_image_url, qr_status, sync_status)
       VALUES (?, ?, ?, ?, ?, 'pending');`,
      qr.book_id,
      qr.qr_uuid,
      qr.qr_serial_number,
      qr.qr_image_url || null,
      qr.qr_status || 'active'
    );
    console.log('[SQLite] Local book QR inserted successfully serial:', qr.qr_serial_number);
  } catch (error) {
    handleDatabaseError(error, 'insertLocalBookQr');
    throw error;
  }
};

export const getPendingLocalBookQrs = (bookId?: number): any[] => {
  if (!ensureDatabase()) return [];
  try {
    if (bookId !== undefined) {
      return db.getAllSync("SELECT * FROM book_qrs WHERE book_id = ? AND sync_status = 'pending';", bookId) as any[];
    }
    return db.getAllSync("SELECT * FROM book_qrs WHERE sync_status = 'pending';") as any[];
  } catch (error) {
    handleDatabaseError(error, 'getPendingLocalBookQrs');
    return [];
  }
};

export const getLocalBookQrsByBookId = (bookId: number): any[] => {
  if (!ensureDatabase()) return [];
  try {
    return db.getAllSync("SELECT * FROM book_qrs WHERE book_id = ?;", bookId) as any[];
  } catch (error) {
    handleDatabaseError(error, 'getLocalBookQrsByBookId');
    return [];
  }
};

export const updateOfflineBookId = (oldBookId: number, newBookId: number, newBookCode: string): void => {
  if (!ensureDatabase()) return;
  try {
    // 1. Update book_id and book_code in books table
    db.runSync('UPDATE books SET book_id = ?, book_code = ?, sync_status = \'synced\' WHERE book_id = ?;', newBookId, newBookCode, oldBookId);
    
    // 2. Update book_id in book_qrs table
    db.runSync('UPDATE book_qrs SET book_id = ?, sync_status = \'synced\' WHERE book_id = ?;', newBookId, oldBookId);

    // 3. Update book_id in borrowings table
    db.runSync('UPDATE borrowings SET book_id = ? WHERE book_id = ?;', newBookId, oldBookId);

    console.log(`[SQLite] Reconciled book ID: old=${oldBookId} -> new=${newBookId}`);
  } catch (error) {
    handleDatabaseError(error, 'updateOfflineBookId');
    throw error;
  }
};

export const markBookSynced = (bookId: number, bookCode: string): void => {
  if (!ensureDatabase()) return;
  try {
    db.runSync("UPDATE books SET sync_status = 'synced', book_code = ? WHERE book_id = ?;", bookCode, bookId);
  } catch (error) {
    handleDatabaseError(error, 'markBookSynced');
  }
};

export const markBookQrSynced = (bookQrId: number): void => {
  if (!ensureDatabase()) return;
  try {
    db.runSync("UPDATE book_qrs SET sync_status = 'synced' WHERE book_qr_id = ?;", bookQrId);
  } catch (error) {
    handleDatabaseError(error, 'markBookQrSynced');
  }
};

// ==========================================
// CATEGORIES CACHE OPERATIONS
// ==========================================
export const cacheCategories = (categories: CachedCategory[]): void => {
  if (!ensureDatabase()) return;
  try {
    // Preserve categories created offline during background sync
    db.runSync("DELETE FROM categories WHERE sync_status != 'pending';");
    for (const cat of categories) {
      db.runSync(
        `INSERT OR REPLACE INTO categories (category_id, category_name, sync_status, created_at, updated_at)
         VALUES (?, ?, 'synced', ?, ?);`,
        cat.category_id,
        cat.category_name,
        cat.created_at || new Date().toISOString(),
        cat.updated_at || new Date().toISOString()
      );
    }
    console.log(`[SQLite] Cached ${categories.length} global categories.`);
  } catch (error) {
    handleDatabaseError(error, 'cacheCategories');
  }
};

export const getCachedCategories = (): CachedCategory[] => {
  if (!ensureDatabase()) return [];
  try {
    return db.getAllSync('SELECT * FROM categories ORDER BY category_name ASC;') as CachedCategory[];
  } catch (error) {
    handleDatabaseError(error, 'getCachedCategories');
    return [];
  }
};

export const insertOfflineCategory = (category: any): void => {
  if (!ensureDatabase()) return;
  try {
    db.runSync(
      `INSERT INTO categories (category_id, category_name, sync_status, created_at, updated_at)
       VALUES (?, ?, 'pending', ?, ?);`,
      category.category_id,
      category.category_name,
      new Date().toISOString(),
      new Date().toISOString()
    );
    console.log('[SQLite] Offline category inserted successfully, ID:', category.category_id);
  } catch (error) {
    handleDatabaseError(error, 'insertOfflineCategory');
    throw error;
  }
};

export const getPendingOfflineCategories = (): any[] => {
  if (!ensureDatabase()) return [];
  try {
    return db.getAllSync("SELECT * FROM categories WHERE sync_status = 'pending' ORDER BY category_id ASC;") as any[];
  } catch (error) {
    handleDatabaseError(error, 'getPendingOfflineCategories');
    return [];
  }
};

export const updateOfflineCategoryId = (oldId: number, newId: number): void => {
  if (!ensureDatabase()) return;
  try {
    db.runSync("UPDATE categories SET category_id = ?, sync_status = 'synced' WHERE category_id = ?;", newId, oldId);
    db.runSync('UPDATE books SET category_id = ? WHERE category_id = ?;', newId, oldId);
    console.log(`[SQLite] Reconciled category ID: old=${oldId} -> new=${newId}`);
  } catch (error) {
    handleDatabaseError(error, 'updateOfflineCategoryId');
    throw error;
  }
};

// ==========================================
// ADVANCED OFFLINE STUDENTS AND BOOKS CRUD
// ==========================================
export const cacheBookQrs = (qrs: any[]): void => {
  if (!ensureDatabase()) return;
  try {
    for (const qr of qrs) {
      db.runSync(
        `INSERT OR REPLACE INTO book_qrs (
          book_qr_id, book_id, qr_uuid, qr_serial_number, qr_image_url, qr_status, sync_status
        ) VALUES (?, ?, ?, ?, ?, ?, 'synced');`,
        qr.book_qr_id,
        qr.book_id,
        qr.qr_uuid,
        qr.qr_serial_number,
        qr.qr_image_url || null,
        qr.qr_status || 'active'
      );
    }
  } catch (error) {
    handleDatabaseError(error, 'cacheBookQrs');
  }
};

export const queryCachedStudents = (
  searchQuery?: string,
  roleFilter?: string,
  page: number = 1,
  limit: number = 15
): { data: CachedStudent[]; hasNextPage: boolean } => {
  if (!ensureDatabase()) return { data: [], hasNextPage: false };
  try {
    let sql = "SELECT * FROM students WHERE (deleted_at IS NULL OR deleted_at = '')";
    const params: any[] = [];

    if (searchQuery && searchQuery.trim()) {
      sql += ' AND (full_name LIKE ? OR student_id_number LIKE ? OR email_address LIKE ? OR member_qr_uuid = ?)';
      const term = `%${searchQuery.trim()}%`;
      params.push(term, term, term, searchQuery.trim());
    }

    if (roleFilter && roleFilter !== 'all') {
      sql += ' AND user_role = ?';
      params.push(roleFilter);
    }

    sql += ' ORDER BY full_name ASC';

    const allMatching = db.getAllSync(sql, ...params) as CachedStudent[];
    
    sql += ' LIMIT ? OFFSET ?;';
    const offset = (page - 1) * limit;
    params.push(limit, offset);

    const data = db.getAllSync(sql, ...params) as CachedStudent[];
    const hasNextPage = allMatching.length > page * limit;

    return { data, hasNextPage };
  } catch (error) {
    handleDatabaseError(error, 'queryCachedStudents');
    return { data: [], hasNextPage: false };
  }
};

export const insertOfflineStudent = (student: any): void => {
  if (!ensureDatabase()) return;
  try {
    db.runSync(
      `INSERT INTO students (
        user_id, student_id_number, full_name, class_name,
        email_address, phone_number, member_qr_uuid, school_id, user_role, sync_status, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?);`,
      student.user_id,
      student.student_id_number || null,
      student.full_name,
      student.class_name || null,
      student.email_address,
      student.phone_number || null,
      student.member_qr_uuid || null,
      student.school_id || null,
      student.user_role || 'student_member',
      student.updated_at || new Date().toISOString()
    );
    console.log('[SQLite] Offline student inserted successfully, ID:', student.user_id);
  } catch (error) {
    handleDatabaseError(error, 'insertOfflineStudent');
    throw error;
  }
};

export const updateOfflineStudent = (userId: number, student: any): void => {
  if (!ensureDatabase()) return;
  try {
    const existing = getCachedStudentById(userId);
    const newStatus = existing?.sync_status === 'pending' ? 'pending' : 'pending_update';
    
    db.runSync(
      `UPDATE students SET
        student_id_number = ?, full_name = ?, class_name = ?,
        email_address = ?, phone_number = ?, user_role = ?, sync_status = ?, updated_at = ?
       WHERE user_id = ?;`,
      student.student_id_number || null,
      student.full_name,
      student.class_name || null,
      student.email_address,
      student.phone_number || null,
      student.user_role || 'student_member',
      newStatus,
      new Date().toISOString(),
      userId
    );
    console.log('[SQLite] Offline student updated successfully, ID:', userId);
  } catch (error) {
    handleDatabaseError(error, 'updateOfflineStudent');
    throw error;
  }
};

export const getPendingOfflineStudents = (): any[] => {
  if (!ensureDatabase()) return [];
  try {
    return db.getAllSync("SELECT * FROM students WHERE sync_status = 'pending' ORDER BY user_id ASC;") as any[];
  } catch (error) {
    handleDatabaseError(error, 'getPendingOfflineStudents');
    return [];
  }
};

export const getPendingUpdateOfflineStudents = (): any[] => {
  if (!ensureDatabase()) return [];
  try {
    return db.getAllSync("SELECT * FROM students WHERE sync_status = 'pending_update' ORDER BY user_id ASC;") as any[];
  } catch (error) {
    handleDatabaseError(error, 'getPendingUpdateOfflineStudents');
    return [];
  }
};

export const updateOfflineStudentId = (oldUserId: number, newUserId: number): void => {
  if (!ensureDatabase()) return;
  try {
    db.runSync('UPDATE students SET user_id = ?, sync_status = \'synced\' WHERE user_id = ?;', newUserId, oldUserId);
    db.runSync('UPDATE borrowings SET user_id = ? WHERE user_id = ?;', newUserId, oldUserId);
    console.log(`[SQLite] Reconciled student ID: old=${oldUserId} -> new=${newUserId}`);
  } catch (error) {
    handleDatabaseError(error, 'updateOfflineStudentId');
    throw error;
  }
};

export const updateOfflineBook = (bookId: number, book: any): void => {
  if (!ensureDatabase()) return;
  try {
    const existing = getCachedBookById(bookId);
    const newStatus = existing?.sync_status === 'pending' ? 'pending' : 'pending_update';

    db.runSync(
      `UPDATE books SET
        book_title = ?, author_name = ?, book_status = ?,
        available_stock = ?, total_stock = ?, cover_image_url = ?,
        publisher_name = ?, publication_year = ?, rack_location = ?,
        category_id = ?, isbn_code = ?, book_description = ?,
        school_id = ?, sync_status = ?, updated_at = ?
       WHERE book_id = ?;`,
      book.book_title,
      book.author_name,
      book.book_status || 'available',
      book.available_stock || 0,
      book.total_stock || 0,
      book.cover_image_url || null,
      book.publisher_name || '',
      book.publication_year || null,
      book.rack_location || '',
      book.category_id || null,
      book.isbn_code || '',
      book.book_description || '',
      book.school_id || null,
      newStatus,
      new Date().toISOString(),
      bookId
    );
    console.log('[SQLite] Offline book updated successfully, ID:', bookId);
  } catch (error) {
    handleDatabaseError(error, 'updateOfflineBook');
    throw error;
  }
};

export const getPendingUpdateOfflineBooks = (): any[] => {
  if (!ensureDatabase()) return [];
  try {
    return db.getAllSync("SELECT * FROM books WHERE sync_status = 'pending_update' ORDER BY book_id ASC;") as any[];
  } catch (error) {
    handleDatabaseError(error, 'getPendingUpdateOfflineBooks');
    return [];
  }
};
