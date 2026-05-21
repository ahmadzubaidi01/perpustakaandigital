import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import env from '../config/environment';

/**
 * Generate a UUID v4.
 */
export const generateUUID = (): string => {
  return uuidv4();
};

/**
 * Generate a secure random token (hex string).
 */
export const generateSecureToken = (byteLength: number = 32): string => {
  return crypto.randomBytes(byteLength).toString('hex');
};

/**
 * Hash a reset token using SHA-256 (cryptographically secure).
 */
export const hashToken = (token: string): string => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

/**
 * Generate a unique book code.
 * Format: BK-{SCHOOL_ID_SUFFIX}-{TIMESTAMP}-{RANDOM}
 */
export const generateBookCode = (schoolId: number): string => {
  const schoolSuffix = String(schoolId).padStart(4, '0');
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `BK-${schoolSuffix}-${timestamp}-${random}`;
};

/**
 * Generate a unique borrowing code.
 * Format: BR-{YYYYMMDD}-{RANDOM}
 */
export const generateBorrowingCode = (): string => {
  const now = new Date();
  const datePart = now.toISOString().slice(0, 10).replace(/-/g, '');
  const random = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `BR-${datePart}-${random}`;
};

/**
 * Generate a unique QR serial number.
 * Format: QR-{SCHOOL_ID_SUFFIX}-{BOOK_ID_SUFFIX}-{SEQ}-{RANDOM}
 */
export const generateQrSerialNumber = (
  schoolId: number,
  bookId: number,
  copyIndex: number
): string => {
  const schoolSuffix = String(schoolId).padStart(4, '0');
  const bookSuffix = String(bookId).padStart(6, '0');
  const seq = String(copyIndex).padStart(3, '0');
  const random = crypto.randomBytes(2).toString('hex').toUpperCase();
  return `QR-${schoolSuffix}-${bookSuffix}-${seq}-${random}`;
};

/**
 * Generate a URL-safe slug from text.
 */
export const generateSlug = (text: string): string => {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 200);
};

/**
 * Generate a unique slug by appending a random suffix.
 */
export const generateUniqueSlug = (text: string): string => {
  const baseSlug = generateSlug(text);
  const suffix = crypto.randomBytes(3).toString('hex');
  return `${baseSlug}-${suffix}`;
};

/**
 * Generate a secure random filename for uploads.
 */
export const generateSecureFilename = (originalFilename: string): string => {
  const ext = originalFilename.split('.').pop() || '';
  const random = crypto.randomBytes(16).toString('hex');
  const timestamp = Date.now();
  return `${timestamp}-${random}.${ext}`;
};

/**
 * Validate password against complexity policy.
 */
export const validatePasswordComplexity = (password: string): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (password.length < env.PASSWORD_MIN_LENGTH) {
    errors.push(`Password must be at least ${env.PASSWORD_MIN_LENGTH} characters long`);
  }
  if (env.PASSWORD_REQUIRE_UPPERCASE && !/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  if (env.PASSWORD_REQUIRE_LOWERCASE && !/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  if (env.PASSWORD_REQUIRE_NUMBER && !/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  if (env.PASSWORD_REQUIRE_SPECIAL && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }

  return { valid: errors.length === 0, errors };
};

/**
 * Calculate late penalty amount.
 */
export const calculateLatePenalty = (
  dueDate: Date,
  returnDate: Date,
  penaltyRatePerDay: number
): number => {
  const msPerDay = 24 * 60 * 60 * 1000;
  const daysLate = Math.max(0, Math.ceil((returnDate.getTime() - dueDate.getTime()) / msPerDay));
  return parseFloat((daysLate * penaltyRatePerDay).toFixed(2));
};

/**
 * Check if a date is past due.
 */
export const isPastDue = (dueDate: Date): boolean => {
  return new Date() > dueDate;
};

/**
 * Sanitize a string for safe output.
 */
export const sanitizeString = (input: string): string => {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
};
