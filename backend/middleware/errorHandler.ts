import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';
import apiResponse from '../utils/apiResponse';
import env from '../config/environment';
import { logStream } from '../services/logStream';

/**
 * Custom application error class.
 */
class AppError extends Error {
  public statusCode: number;
  public isOperational: boolean;
  public details: unknown;

  constructor(message: string, statusCode: number = 500, details: unknown = null) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Centralized error handling middleware.
 * MUST be the last middleware registered.
 */
const errorHandler = (err: any, req: Request, res: Response, _next: NextFunction): void => {
  // Default error properties
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';
  let errorDetails: unknown = null;

  // Log the error
  if (statusCode >= 500) {
    logger.error('Server Error', {
      message: err.message,
      stack: err.stack,
      method: req.method,
      url: req.originalUrl,
      ip: req.ip,
      user_id: req.user?.user_id || null,
    });
  } else {
    logger.warn('Client Error', {
      message: err.message,
      statusCode,
      method: req.method,
      url: req.originalUrl,
    });
  }

  logStream.emitLog({
    type: statusCode >= 500 ? 'ERROR' : 'WARNING',
    message: err.message || message,
    stack: err.stack,
    method: req.method,
    endpoint: req.originalUrl,
    statusCode,
    ip: req.ip,
    userId: req.user?.user_id || null,
  });

  // Handle specific error types

  // Sequelize Validation Error
  if (err.name === 'SequelizeValidationError') {
    statusCode = 422;
    message = 'Validation failed';
    errorDetails = err.errors?.map((e: any) => ({
      field: e.path,
      message: e.message,
      value: e.value,
    }));
  }

  // Sequelize Unique Constraint Error
  if (err.name === 'SequelizeUniqueConstraintError') {
    statusCode = 409;
    message = 'Duplicate entry found';
    errorDetails = err.errors?.map((e: any) => ({
      field: e.path,
      message: `${e.path} already exists`,
    }));
  }

  // Sequelize Foreign Key Constraint Error
  if (err.name === 'SequelizeForeignKeyConstraintError') {
    statusCode = 409;
    message = 'Referenced resource not found or cannot be deleted';
  }

  // Sequelize Database Error
  if (err.name === 'SequelizeDatabaseError') {
    statusCode = 500;
    message = 'Database error occurred';
  }

  // JWT Errors
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid token';
  }

  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token has expired';
  }

  // Multer Errors (file upload)
  if (err.code === 'LIMIT_FILE_SIZE') {
    statusCode = 413;
    message = 'File size exceeds the allowed limit';
  }

  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    statusCode = 400;
    message = 'Unexpected file field';
  }

  // Joi Validation Error
  if (err.isJoi) {
    statusCode = 422;
    message = 'Validation failed';
    errorDetails = err.details?.map((d: any) => ({
      field: d.path?.join('.'),
      message: d.message,
    }));
  }

  // Operational error (AppError)
  if (err instanceof AppError) {
    errorDetails = err.details;
  }

  // Don't expose internal error details in production
  if (env.NODE_ENV === 'production' && statusCode >= 500) {
    message = 'Internal server error';
    errorDetails = null;
  }

  apiResponse.error(res, message, statusCode, errorDetails);
};

/**
 * Handle 404 — Route not found.
 */
const notFoundHandler = (req: Request, res: Response): void => {
  apiResponse.notFound(res, `Route ${req.method} ${req.originalUrl} not found`);
};

/**
 * Async wrapper to catch errors in async route handlers.
 */
const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    fn(req, res, next).catch(next);
  };
};

export {
  AppError,
  errorHandler,
  notFoundHandler,
  asyncHandler,
};
