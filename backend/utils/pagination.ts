import { Request } from 'express';
import { PAGINATION_DEFAULTS } from '../config/constants';

interface PaginationParams {
  page: number;
  limit: number;
  offset: number;
  sortBy: string;
  sortOrder: 'ASC' | 'DESC';
}

interface PaginationResult {
  current_page: number;
  per_page: number;
  total_items: number;
  total_pages: number;
  has_next_page: boolean;
  has_prev_page: boolean;
}

/**
 * Extract pagination, sorting parameters from request query.
 */
const parsePaginationParams = (
  req: Request,
  defaultSortBy: string = 'created_at',
  allowedSortFields: string[] = []
): PaginationParams => {
  const page = Math.max(1, parseInt(req.query.page as string, 10) || PAGINATION_DEFAULTS.PAGE);
  const limit = Math.min(
    PAGINATION_DEFAULTS.MAX_LIMIT,
    Math.max(1, parseInt(req.query.limit as string, 10) || PAGINATION_DEFAULTS.LIMIT)
  );
  const offset = (page - 1) * limit;

  let sortBy = (req.query.sort_by as string) || defaultSortBy;
  if (allowedSortFields.length > 0 && !allowedSortFields.includes(sortBy)) {
    sortBy = defaultSortBy;
  }

  const sortOrderRaw = ((req.query.sort_order as string) || 'DESC').toUpperCase();
  const sortOrder: 'ASC' | 'DESC' = sortOrderRaw === 'ASC' ? 'ASC' : 'DESC';

  return { page, limit, offset, sortBy, sortOrder };
};

/**
 * Build pagination result metadata from total count and params.
 */
const buildPaginationResult = (
  totalItems: number,
  params: PaginationParams
): PaginationResult => {
  const totalPages = Math.ceil(totalItems / params.limit);

  return {
    current_page: params.page,
    per_page: params.limit,
    total_items: totalItems,
    total_pages: totalPages,
    has_next_page: params.page < totalPages,
    has_prev_page: params.page > 1,
  };
};

/**
 * Parse filter parameters from request query.
 * Returns a clean object with only allowed filter keys that have values.
 */
const parseFilterParams = (
  req: Request,
  allowedFilters: string[]
): Record<string, string> => {
  const filters: Record<string, string> = {};

  for (const key of allowedFilters) {
    const value = req.query[key];
    if (value && typeof value === 'string' && value.trim() !== '') {
      filters[key] = value.trim();
    }
  }

  return filters;
};

/**
 * Parse search query parameter.
 */
const parseSearchQuery = (req: Request): string | null => {
  const search = req.query.search || req.query.q;
  if (search && typeof search === 'string' && search.trim() !== '') {
    return search.trim();
  }
  return null;
};

export {
  parsePaginationParams,
  buildPaginationResult,
  parseFilterParams,
  parseSearchQuery,
};

export type { PaginationParams, PaginationResult };
