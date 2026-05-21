import rateLimit from 'express-rate-limit';
import env from '../config/environment';
import apiResponse from '../utils/apiResponse';
import { Request, Response } from 'express';

/**
 * Rate limiting middleware.
 * Distributed rate limiting supports Redis-backed storage when available.
 * Rate-limited requests return standardized API responses.
 */

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
  keyGenerator: (req: Request) => {
    return req.ip || req.headers['x-forwarded-for'] as string || 'unknown';
  },
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
  keyGenerator: (req: Request) => {
    return req.ip || req.headers['x-forwarded-for'] as string || 'unknown';
  },
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
  keyGenerator: (req: Request) => {
    return req.ip || req.headers['x-forwarded-for'] as string || 'unknown';
  },
});

/**
 * Notification endpoint rate limiter.
 */
const notificationLimiter = rateLimit({
  windowMs: 60000, // 1 minute
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => env.NODE_ENV === 'development',
  handler: createStandardHandler('Too many notification requests. Please try again later.'),
  keyGenerator: (req: Request) => {
    return req.ip || req.headers['x-forwarded-for'] as string || 'unknown';
  },
});

/**
 * Password reset endpoint rate limiter (very strict).
 */
const passwordResetLimiter = rateLimit({
  windowMs: 3600000, // 1 hour
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => env.NODE_ENV === 'development',
  handler: createStandardHandler('Too many password reset requests. Please try again later.'),
  keyGenerator: (req: Request) => {
    return req.ip || req.headers['x-forwarded-for'] as string || 'unknown';
  },
});

export {
  generalLimiter,
  authLimiter,
  qrScanLimiter,
  notificationLimiter,
  passwordResetLimiter,
};
