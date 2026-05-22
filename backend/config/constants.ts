/**
 * Application-wide constants and enum definitions.
 * All enums match the database ENUM column definitions exactly.
 */

// =============================================
// ROLE HIERARCHY
// =============================================
export enum UserRole {
  SUPER_ADMIN = 'super_admin',
  REGENCY_ADMIN = 'regency_admin',
  DISTRICT_ADMIN = 'district_admin',
  SCHOOL_ADMIN = 'school_admin',
  STUDENT_MEMBER = 'student_member',
}

/**
 * Role hierarchy level — lower number = higher authority.
 */
export const ROLE_HIERARCHY: Record<UserRole, number> = {
  [UserRole.SUPER_ADMIN]: 0,
  [UserRole.REGENCY_ADMIN]: 1,
  [UserRole.DISTRICT_ADMIN]: 2,
  [UserRole.SCHOOL_ADMIN]: 3,
  [UserRole.STUDENT_MEMBER]: 4,
};

// =============================================
// ACCOUNT STATUS
// =============================================
export enum AccountStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended',
}

// =============================================
// SCHOOL STATUS
// =============================================
export enum SchoolStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended',
}

// =============================================
// BOOK STATUS
// =============================================
export enum BookStatus {
  AVAILABLE = 'available',
  BORROWED = 'borrowed',
  RESERVED = 'reserved',
  DAMAGED = 'damaged',
  LOST = 'lost',
  MAINTENANCE = 'maintenance',
}

// =============================================
// QR STATUS
// =============================================
export enum QrStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  DAMAGED = 'damaged',
  LOST = 'lost',
  BORROWED = 'borrowed',
  MAINTENANCE = 'maintenance',
}

// =============================================
// BORROWING STATUS
// =============================================
export enum BorrowingStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  BORROWED = 'borrowed',
  RESERVED = 'reserved',
  RETURNED = 'returned',
  LATE = 'late',
  CANCELLED = 'cancelled',
}

// =============================================
// PENALTY STATUS
// =============================================
export enum PenaltyStatus {
  UNPAID = 'unpaid',
  PAID = 'paid',
  WAIVED = 'waived',
}

// =============================================
// SCAN TYPE
// =============================================
export enum ScanType {
  BORROWING = 'borrowing',
  RETURNING = 'returning',
  VERIFICATION = 'verification',
  INVENTORY = 'inventory',
  AUDIT = 'audit',
}

// =============================================
// NOTIFICATION TYPE
// =============================================
export enum NotificationType {
  DUE_REMINDER = 'due_reminder',
  LATE_WARNING = 'late_warning',
  AVAILABILITY_NOTICE = 'availability_notice',
  ACCOUNT_VERIFICATION = 'account_verification',
  SCHOOL_ANNOUNCEMENT = 'school_announcement',
  SYSTEM_ALERT = 'system_alert',
  BOOK_LOST = 'book_lost',
  BOOK_DAMAGED = 'book_damaged',
  STOCK_ANOMALY = 'stock_anomaly',
  BORROWING_EVENT = 'borrowing_event',
  RETURN_EVENT = 'return_event',
  ADMIN_MESSAGE = 'admin_message',
  QR_ISSUE = 'qr_issue',
  INVENTORY_MISMATCH = 'inventory_mismatch',
}

// =============================================
// SESSION STATUS
// =============================================
export enum SessionStatus {
  ACTIVE = 'active',
  EXPIRED = 'expired',
  REVOKED = 'revoked',
  TERMINATED = 'terminated',
}

// =============================================
// BORROWING SETTINGS DEFAULTS
// =============================================
export const BORROWING_DEFAULTS = {
  MAX_BORROW_DAYS: 14,
  MAX_BOOKS_PER_STUDENT: 3,
  PENALTY_RATE_PER_DAY: 1000.00,
  ALLOW_EXTENSIONS: true,
  MAX_EXTENSIONS: 1,
} as const;

// =============================================
// PAGINATION DEFAULTS
// =============================================
export const PAGINATION_DEFAULTS = {
  PAGE: 1,
  LIMIT: 20,
  MAX_LIMIT: 100,
} as const;

// =============================================
// RATING CONSTRAINTS
// =============================================
export const RATING_CONSTRAINTS = {
  MIN_SCORE: 1,
  MAX_SCORE: 5,
} as const;

// =============================================
// AUDIT ACTION TYPES
// =============================================
export enum AuditActionType {
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  SOFT_DELETE = 'SOFT_DELETE',
  RESTORE = 'RESTORE',
  LOGIN = 'LOGIN',
  LOGOUT = 'LOGOUT',
  BORROW = 'BORROW',
  RETURN = 'RETURN',
  EXTEND = 'EXTEND',
  RESERVE = 'RESERVE',
  APPROVE = 'APPROVE',
  REJECT = 'REJECT',
  CANCEL = 'CANCEL',
  GENERATE_QR = 'GENERATE_QR',
  SCAN_QR = 'SCAN_QR',
  PASSWORD_RESET = 'PASSWORD_RESET',
  STATUS_CHANGE = 'STATUS_CHANGE',
  MARK_LOST = 'MARK_LOST',
  MARK_DAMAGED = 'MARK_DAMAGED',
  MARK_INACTIVE = 'MARK_INACTIVE',
  RESTORE_BOOK = 'RESTORE_BOOK',
  INVENTORY_AUDIT = 'INVENTORY_AUDIT',
  CHAT_MESSAGE = 'CHAT_MESSAGE',
  STOCK_INITIAL = 'STOCK_INITIAL',
  QUICK_BORROW = 'QUICK_BORROW',
  QUICK_RETURN = 'QUICK_RETURN',
}

// =============================================
// TABLE NAMES (for audit references)
// =============================================
export const TABLE_NAMES = {
  REGENCIES: 'regencies',
  DISTRICTS: 'districts',
  SCHOOLS: 'schools',
  USERS: 'users',
  BOOKS: 'books',
  BOOK_CATEGORIES: 'book_categories',
  BOOK_QR: 'book_qr',
  BORROWINGS: 'borrowings',
  BORROWING_SETTINGS: 'borrowing_settings',
  BOOK_REVIEWS: 'book_reviews',
  FAVORITE_BOOKS: 'favorite_books',
  NOTIFICATIONS: 'notifications',
  AUDIT_LOGS: 'audit_logs',
  USER_SESSIONS: 'user_sessions',
  QR_SCAN_LOGS: 'qr_scan_logs',
  PASSWORD_RESETS: 'password_resets',
  REFRESH_TOKENS: 'refresh_tokens',
  CHAT_CONVERSATIONS: 'chat_conversations',
  CHAT_MESSAGES: 'chat_messages',
} as const;

// =============================================
// INVENTORY SCAN MODES
// =============================================
export enum InventoryMode {
  AUTO_SAVE = 'auto_save',
  INITIAL_CHECK = 'initial_check',
  UPDATE_EXISTING = 'update_existing',
  VERIFY_OWNERSHIP = 'verify_ownership',
  AUDIT_MODE = 'audit_mode',
}
