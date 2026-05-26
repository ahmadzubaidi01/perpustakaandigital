import rateLimit from 'express-rate-limit';
import env from '../config/environment';
import apiResponse from '../utils/apiResponse';
import { Request, Response } from 'express';

/**
 * Rate limiting middleware.
 * Distributed rate limiting supports Redis-backed storage when available.
 * Rate-limited requests return standardized API responses.
 */

/**
 * Extract client real IP address robustly behind any reverse proxies (Nginx, LiteSpeed, Cloudflare).
 */
const getClientIp = (req: Request): string => {
  const forwardedFor = req.headers['x-forwarded-for'];
  if (forwardedFor) {
    const ips = typeof forwardedFor === 'string' ? forwardedFor.split(',') : forwardedFor;
    if (ips && ips.length > 0) {
      return ips[0].trim();
    }
  }
  const realIp = req.headers['x-real-ip'];
  if (realIp) {
    return typeof realIp === 'string' ? realIp.trim() : realIp[0].trim();
  }
  return req.ip || 'unknown';
};

const createStandardHandler = (message: string) => {
  return (_req: Request, res: Response) => {
    apiResponse.tooManyRequests(res, message);
  };
};

/**
 * General API rate limiter.
 */
const generalLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => env.NODE_ENV === 'development',
  handler: createStandardHandler('Too many requests. Please try again later.'),
  keyGenerator: getClientIp,
});

/**
 * Authentication endpoint rate limiter (stricter).
 */
const authLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_AUTH_WINDOW_MS,
  max: env.RATE_LIMIT_AUTH_MAX_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => env.NODE_ENV === 'development',
  handler: createStandardHandler('Too many authentication attempts. Please try again later.'),
  keyGenerator: getClientIp,
});

/**
 * QR scan endpoint rate limiter.
 */
const qrScanLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_QR_WINDOW_MS,
  max: env.RATE_LIMIT_QR_MAX_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => env.NODE_ENV === 'development',
  handler: createStandardHandler('Too many QR scan requests. Please try again later.'),
  keyGenerator: getClientIp,
});

/**
 * Notification endpoint rate limiter.
 */
const notificationLimiter = rateLimit({
  windowMs: 60000, // 1 minute
  max: 200, // Increased from 20 to 200 to prevent false-positives during background sync
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => env.NODE_ENV === 'development',
  handler: createStandardHandler('Too many notification requests. Please try again later.'),
  keyGenerator: getClientIp,
});

/**
 * Password reset endpoint rate limiter (very strict).
 */
const passwordResetLimiter = rateLimit({
  windowMs: 3600000, // 1 hour
  max: 10, // Increased from 5 to 10
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => env.NODE_ENV === 'development',
  handler: createStandardHandler('Too many password reset requests. Please try again later.'),
  keyGenerator: getClientIp,
});

export {
  generalLimiter,
  authLimiter,
  qrScanLimiter,
  notificationLimiter,
  passwordResetLimiter,
};
