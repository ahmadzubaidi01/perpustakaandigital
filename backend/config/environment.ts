import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env'), override: true });

const env = {
  // Application
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '5000', 10),
  APP_NAME: process.env.APP_NAME || 'PerpustakaanDigital',
  APP_URL: process.env.APP_URL || 'http://localhost:5000',
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:3000',

  // Database
  DB_HOST: process.env.DB_HOST || 'localhost',
  DB_PORT: parseInt(process.env.DB_PORT || '3306', 10),
  DB_NAME: process.env.DB_NAME || 'perpustakaan_digital',
  DB_USER: process.env.DB_USER || 'root',
  DB_PASSWORD: process.env.DB_PASSWORD || '',
  DB_POOL_MIN: parseInt(process.env.DB_POOL_MIN || '5', 10),
  DB_POOL_MAX: parseInt(process.env.DB_POOL_MAX || '20', 10),
  DB_POOL_ACQUIRE: parseInt(process.env.DB_POOL_ACQUIRE || '30000', 10),
  DB_POOL_IDLE: parseInt(process.env.DB_POOL_IDLE || '10000', 10),
  DB_LOGGING: process.env.DB_LOGGING === 'true',

  // Redis
  REDIS_ENABLED: process.env.REDIS_ENABLED !== 'false',
  REDIS_HOST: process.env.REDIS_HOST || 'localhost',
  REDIS_PORT: parseInt(process.env.REDIS_PORT || '6379', 10),
  REDIS_PASSWORD: process.env.REDIS_PASSWORD || '',
  REDIS_DB: parseInt(process.env.REDIS_DB || '0', 10),
  REDIS_KEY_PREFIX: process.env.REDIS_KEY_PREFIX || 'perpus:',

  // JWT
  JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET || '',
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || '',
  JWT_ACCESS_EXPIRY: process.env.JWT_ACCESS_EXPIRY || '15m',
  JWT_REFRESH_EXPIRY: process.env.JWT_REFRESH_EXPIRY || '7d',

  // Bcrypt
  BCRYPT_SALT_ROUNDS: parseInt(process.env.BCRYPT_SALT_ROUNDS || '12', 10),

  // Email
  SMTP_HOST: process.env.SMTP_HOST || 'smtp.gmail.com',
  SMTP_PORT: parseInt(process.env.SMTP_PORT || '587', 10),
  SMTP_SECURE: process.env.SMTP_SECURE === 'true',
  SMTP_USER: process.env.SMTP_USER || '',
  SMTP_PASSWORD: process.env.SMTP_PASSWORD || '',
  SMTP_FROM_NAME: process.env.SMTP_FROM_NAME || 'Perpustakaan Digital',
  SMTP_FROM_EMAIL: process.env.SMTP_FROM_EMAIL || 'noreply@perpustakaandigital.com',

  // Firebase
  FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID || '',
  FIREBASE_CLIENT_EMAIL: process.env.FIREBASE_CLIENT_EMAIL || '',
  FIREBASE_PRIVATE_KEY: process.env.FIREBASE_PRIVATE_KEY
    ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
    : '',

  // File Upload
  UPLOAD_MAX_FILE_SIZE: parseInt(process.env.UPLOAD_MAX_FILE_SIZE || '5242880', 10),
  UPLOAD_ALLOWED_IMAGE_TYPES: (process.env.UPLOAD_ALLOWED_IMAGE_TYPES || 'image/jpeg,image/png,image/webp').split(','),
  UPLOAD_DIR: process.env.UPLOAD_DIR || 'uploads',

  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
  RATE_LIMIT_MAX_REQUESTS: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
  RATE_LIMIT_AUTH_WINDOW_MS: parseInt(process.env.RATE_LIMIT_AUTH_WINDOW_MS || '900000', 10),
  RATE_LIMIT_AUTH_MAX_REQUESTS: parseInt(process.env.RATE_LIMIT_AUTH_MAX_REQUESTS || '10', 10),
  RATE_LIMIT_QR_WINDOW_MS: parseInt(process.env.RATE_LIMIT_QR_WINDOW_MS || '60000', 10),
  RATE_LIMIT_QR_MAX_REQUESTS: parseInt(process.env.RATE_LIMIT_QR_MAX_REQUESTS || '30', 10),

  // Session
  MAX_CONCURRENT_SESSIONS: parseInt(process.env.MAX_CONCURRENT_SESSIONS || '5', 10),

  // Password Policy
  PASSWORD_MIN_LENGTH: parseInt(process.env.PASSWORD_MIN_LENGTH || '8', 10),
  PASSWORD_REQUIRE_UPPERCASE: process.env.PASSWORD_REQUIRE_UPPERCASE === 'true',
  PASSWORD_REQUIRE_LOWERCASE: process.env.PASSWORD_REQUIRE_LOWERCASE === 'true',
  PASSWORD_REQUIRE_NUMBER: process.env.PASSWORD_REQUIRE_NUMBER === 'true',
  PASSWORD_REQUIRE_SPECIAL: process.env.PASSWORD_REQUIRE_SPECIAL === 'true',

  // Password Reset
  RESET_TOKEN_EXPIRY_MINUTES: parseInt(process.env.RESET_TOKEN_EXPIRY_MINUTES || '30', 10),

  // Borrowing Defaults
  DEFAULT_MAX_BORROW_DAYS: parseInt(process.env.DEFAULT_MAX_BORROW_DAYS || '14', 10),
  DEFAULT_MAX_BOOKS_PER_STUDENT: parseInt(process.env.DEFAULT_MAX_BOOKS_PER_STUDENT || '3', 10),
  DEFAULT_PENALTY_RATE_PER_DAY: parseFloat(process.env.DEFAULT_PENALTY_RATE_PER_DAY || '1000'),
  DEFAULT_ALLOW_EXTENSIONS: process.env.DEFAULT_ALLOW_EXTENSIONS !== 'false',
  DEFAULT_MAX_EXTENSIONS: parseInt(process.env.DEFAULT_MAX_EXTENSIONS || '1', 10),
  RESERVATION_TIMEOUT_HOURS: parseInt(process.env.RESERVATION_TIMEOUT_HOURS || '48', 10),

  // Audit & Retention
  AUDIT_LOG_RETENTION_DAYS: parseInt(process.env.AUDIT_LOG_RETENTION_DAYS || '365', 10),
  QR_SCAN_LOG_RETENTION_DAYS: parseInt(process.env.QR_SCAN_LOG_RETENTION_DAYS || '180', 10),

  // CORS
  CORS_ORIGINS: (process.env.CORS_ORIGINS || 'http://localhost:3000')
  .split(',')
  .map(origin => origin.trim()),

  // Logging
  LOG_LEVEL: process.env.LOG_LEVEL || 'debug',
  LOG_DIR: process.env.LOG_DIR || 'logs',
  LOG_MAX_SIZE: process.env.LOG_MAX_SIZE || '20m',
  LOG_MAX_FILES: process.env.LOG_MAX_FILES || '14d',

  // Google Maps
  GOOGLE_MAPS_API_KEY: process.env.GOOGLE_MAPS_API_KEY || '',
};

// Validate critical environment variables in production
if (env.NODE_ENV === 'production') {
  const requiredVars = [
    'JWT_ACCESS_SECRET',
    'JWT_REFRESH_SECRET',
    'DB_PASSWORD',
  ];

  const missing = requiredVars.filter((key) => !env[key as keyof typeof env]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

export default env;
