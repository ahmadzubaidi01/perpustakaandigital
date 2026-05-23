import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import env from '../config/environment';
import { User } from '../models';
import apiResponse from '../utils/apiResponse';
import logger from '../utils/logger';
import { AccountStatus } from '../config/constants';

interface JwtPayload {
  user_id: number;
  user_role: string;
  email_address: string;
  school_id: number | null;
  district_id: number | null;
  regency_id: number | null;
}

// Extend Express Request to include authenticated user
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
      deviceInfo?: {
        device_name: string | null;
        device_type: string | null;
        device_os: string | null;
        browser_name: string | null;
        browser_version: string | null;
        ip_address: string | null;
      };
    }
  }
}

/**
 * JWT Authentication middleware.
 * Verifies the access token from the Authorization header.
 */
const authenticate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    let token = '';
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else if (req.query.token && typeof req.query.token === 'string') {
      token = req.query.token;
    }

    if (!token) {
      apiResponse.unauthorized(res, 'Access token is required');
      return;
    }

    const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET) as JwtPayload;

    // Verify user still exists and is active
    const user = await User.scope('withPassword').findByPk(decoded.user_id, {
      attributes: ['user_id', 'user_role', 'email_address', 'account_status', 'school_id', 'district_id', 'regency_id'],
    });

    if (!user) {
      apiResponse.unauthorized(res, 'User not found');
      return;
    }

    if (user.account_status !== AccountStatus.ACTIVE) {
      apiResponse.forbidden(res, `Account is ${user.account_status}`);
      return;
    }

    req.user = {
      user_id: user.user_id,
      user_role: user.user_role,
      email_address: user.email_address,
      school_id: user.school_id,
      district_id: user.district_id,
      regency_id: user.regency_id,
    };

    next();
  } catch (error: any) {
    if (error.name === 'TokenExpiredError') {
      apiResponse.unauthorized(res, 'Access token has expired');
      return;
    }
    if (error.name === 'JsonWebTokenError') {
      apiResponse.unauthorized(res, 'Invalid access token');
      return;
    }
    logger.error('Authentication error', { error: error.message });
    apiResponse.internalError(res, 'Authentication failed');
  }
};

/**
 * Optional authentication — attaches user if token exists, but doesn't block.
 */
const optionalAuth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      next();
      return;
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      next();
      return;
    }

    const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET) as JwtPayload;
    req.user = decoded;
    next();
  } catch {
    // Silently proceed without user context
    next();
  }
};

/**
 * Generate access token.
 */
const generateAccessToken = (payload: JwtPayload): string => {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRY as any,
  });
};

/**
 * Generate refresh token.
 */
const generateRefreshToken = (payload: JwtPayload): string => {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRY as any,
  });
};

/**
 * Verify refresh token.
 */
const verifyRefreshToken = (token: string): JwtPayload => {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as JwtPayload;
};

export {
  authenticate,
  optionalAuth,
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  JwtPayload,
};
