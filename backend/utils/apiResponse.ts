import { Response } from 'express';

/**
 * Standardized API response structure.
 * All API responses MUST include: success status, message, data payload, error payload, metadata.
 */

interface ApiResponsePayload {
  success: boolean;
  message: string;
  data: unknown;
  error: unknown;
  metadata: Record<string, unknown> | null;
}

interface PaginationMeta {
  current_page: number;
  per_page: number;
  total_items: number;
  total_pages: number;
  has_next_page: boolean;
  has_prev_page: boolean;
}

const sendResponse = (
  res: Response,
  statusCode: number,
  payload: ApiResponsePayload
): Response => {
  return res.status(statusCode).json(payload);
};

/**
 * Success response.
 */
const success = (
  res: Response,
  message: string = 'Success',
  data: unknown = null,
  metadata: Record<string, unknown> | null = null,
  statusCode: number = 200
): Response => {
  return sendResponse(res, statusCode, {
    success: true,
    message,
    data,
    error: null,
    metadata,
  });
};

/**
 * Created response (201).
 */
const created = (
  res: Response,
  message: string = 'Resource created successfully',
  data: unknown = null,
  metadata: Record<string, unknown> | null = null
): Response => {
  return sendResponse(res, 201, {
    success: true,
    message,
    data,
    error: null,
    metadata,
  });
};

/**
 * Paginated list response.
 */
const paginated = (
  res: Response,
  message: string = 'Success',
  data: unknown = [],
  pagination: PaginationMeta,
  additionalMeta: Record<string, unknown> = {}
): Response => {
  return sendResponse(res, 200, {
    success: true,
    message,
    data,
    error: null,
    metadata: {
      pagination,
      ...additionalMeta,
    },
  });
};

/**
 * Error response.
 */
const error = (
  res: Response,
  message: string = 'An error occurred',
  statusCode: number = 500,
  errorDetails: unknown = null,
  metadata: Record<string, unknown> | null = null
): Response => {
  return sendResponse(res, statusCode, {
    success: false,
    message,
    data: null,
    error: errorDetails,
    metadata,
  });
};

/**
 * Bad request (400).
 */
const badRequest = (
  res: Response,
  message: string = 'Bad request',
  errorDetails: unknown = null
): Response => {
  return error(res, message, 400, errorDetails);
};

/**
 * Unauthorized (401).
 */
const unauthorized = (
  res: Response,
  message: string = 'Unauthorized',
  errorDetails: unknown = null
): Response => {
  return error(res, message, 401, errorDetails);
};

/**
 * Forbidden (403).
 */
const forbidden = (
  res: Response,
  message: string = 'Forbidden',
  errorDetails: unknown = null
): Response => {
  return error(res, message, 403, errorDetails);
};

/**
 * Not found (404).
 */
const notFound = (
  res: Response,
  message: string = 'Resource not found',
  errorDetails: unknown = null
): Response => {
  return error(res, message, 404, errorDetails);
};

/**
 * Conflict (409).
 */
const conflict = (
  res: Response,
  message: string = 'Conflict',
  errorDetails: unknown = null
): Response => {
  return error(res, message, 409, errorDetails);
};

/**
 * Unprocessable entity (422).
 */
const unprocessable = (
  res: Response,
  message: string = 'Validation failed',
  errorDetails: unknown = null
): Response => {
  return error(res, message, 422, errorDetails);
};

/**
 * Too many requests (429).
 */
const tooManyRequests = (
  res: Response,
  message: string = 'Too many requests. Please try again later.',
  errorDetails: unknown = null
): Response => {
  return error(res, message, 429, errorDetails);
};

/**
 * Internal server error (500).
 */
const internalError = (
  res: Response,
  message: string = 'Internal server error',
  errorDetails: unknown = null
): Response => {
  return error(res, message, 500, errorDetails);
};

export default {
  success,
  created,
  paginated,
  error,
  badRequest,
  unauthorized,
  forbidden,
  notFound,
  conflict,
  unprocessable,
  tooManyRequests,
  internalError,
};

export type { ApiResponsePayload, PaginationMeta };
