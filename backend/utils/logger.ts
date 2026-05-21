import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';
import env from '../config/environment';

const logDir = path.resolve(__dirname, '..', env.LOG_DIR);

/**
 * Custom format that redacts sensitive credentials from logs.
 */
const redactSensitive = winston.format((info) => {
  const sensitiveKeys = [
    'password', 'password_hash', 'token', 'secret',
    'authorization', 'cookie', 'jwt', 'refresh_token',
    'reset_token', 'api_key', 'private_key',
  ];

  const redact = (obj: Record<string, unknown>): Record<string, unknown> => {
    const redacted: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      const lowerKey = key.toLowerCase();
      if (sensitiveKeys.some((sk) => lowerKey.includes(sk))) {
        redacted[key] = '[REDACTED]';
      } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        redacted[key] = redact(value as Record<string, unknown>);
      } else {
        redacted[key] = value;
      }
    }
    return redacted;
  };

  if (info.meta && typeof info.meta === 'object') {
    info.meta = redact(info.meta as Record<string, unknown>);
  }

  return info;
});

const logger = winston.createLogger({
  level: env.LOG_LEVEL,
  exitOnError: false, // Prevents winston from forcefully crashing/exiting the process on uncaught exceptions
  format: winston.format.combine(
    redactSensitive(),
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: env.APP_NAME },
  transports: [
    // Error log file
    new DailyRotateFile({
      filename: path.join(logDir, 'error-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      level: 'error',
      maxSize: env.LOG_MAX_SIZE,
      maxFiles: env.LOG_MAX_FILES,
      zippedArchive: true,
    }),
    // Combined log file
    new DailyRotateFile({
      filename: path.join(logDir, 'combined-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: env.LOG_MAX_SIZE,
      maxFiles: env.LOG_MAX_FILES,
      zippedArchive: true,
    }),
    // Audit-specific log file
    new DailyRotateFile({
      filename: path.join(logDir, 'audit-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      level: 'info',
      maxSize: env.LOG_MAX_SIZE,
      maxFiles: '365d', // Keep audit logs for a year
      zippedArchive: true,
    }),
  ],
  exceptionHandlers: [
    new DailyRotateFile({
      filename: path.join(logDir, 'exceptions-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxFiles: env.LOG_MAX_FILES,
    }),
  ],
  rejectionHandlers: [
    new DailyRotateFile({
      filename: path.join(logDir, 'rejections-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxFiles: env.LOG_MAX_FILES,
    }),
  ],
});

// Console output in development
if (env.NODE_ENV !== 'production') {
  logger.add(
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message, service, ...meta }) => {
          const metaStr = Object.keys(meta).length > 0
            ? `\n${JSON.stringify(meta, null, 2)}`
            : '';
          return `[${timestamp}] [${service}] ${level}: ${message}${metaStr}`;
        })
      ),
    })
  );
}

export default logger;
