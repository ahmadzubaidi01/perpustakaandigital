import { Request, Response } from 'express';
import { BookReview, FavoriteBook } from '../models';
import { RATING_CONSTRAINTS, AuditActionType, TABLE_NAMES } from '../config/constants';
import apiResponse from '../utils/apiResponse';
import { asyncHandler } from '../middleware/errorHandler';
import { createAuditLog, buildAuditFromRequest } from '../services/auditService';
import { parsePaginationParams, buildPaginationResult } from '../utils/pagination';

const listReviews = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const pagination = parsePaginationParams(req, 'created_at', ['created_at', 'rating_score']);
  const where: any = {};
  if (req.query.book_id) where.book_id = req.query.book_id;
  if (req.query.user_id) where.user_id = req.query.user_id;

  const { count, rows } = await BookReview.findAndCountAll({
    where,
    include: [{ association: 'user', attributes: ['user_id', 'full_name', 'profile_photo_url'] }, { association: 'book', attributes: ['book_id', 'book_title'] }],
    order: [[pagination.sortBy, pagination.sortOrder]],
    limit: pagination.limit, offset: pagination.offset,
  });
  apiResponse.paginated(res, 'Reviews retrieved', rows, buildPaginationResult(count, pagination));
});

const createReview = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { book_id, rating_score, review_text } = req.body;
  if (rating_score < RATING_CONSTRAINTS.MIN_SCORE || rating_score > RATING_CONSTRAINTS.MAX_SCORE) { apiResponse.badRequest(res, `Rating must be between ${RATING_CONSTRAINTS.MIN_SCORE} and ${RATING_CONSTRAINTS.MAX_SCORE}`); return; }

  const existing = await BookReview.findOne({ where: { book_id, user_id: req.user!.user_id } });
  if (existing) { apiResponse.conflict(res, 'You have already reviewed this book'); return; }

  const review = await BookReview.create({ book_id, user_id: req.user!.user_id, rating_score, review_text: review_text || null });
  await createAuditLog(buildAuditFromRequest(req, AuditActionType.CREATE, TABLE_NAMES.BOOK_REVIEWS, review.review_id));
  apiResponse.created(res, 'Review created', review);
});

const updateReview = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const review = await BookReview.findOne({ where: { review_id: req.params.review_id, user_id: req.user!.user_id } });
  if (!review) { apiResponse.notFound(res, 'Review not found'); return; }
  const { rating_score, review_text } = req.body;
  if (rating_score && (rating_score < RATING_CONSTRAINTS.MIN_SCORE || rating_score > RATING_CONSTRAINTS.MAX_SCORE)) { apiResponse.badRequest(res, `Rating must be between ${RATING_CONSTRAINTS.MIN_SCORE} and ${RATING_CONSTRAINTS.MAX_SCORE}`); return; }
  const updates: any = {};
  if (rating_score) updates.rating_score = rating_score;
  if (review_text !== undefined) updates.review_text = review_text;
  await review.update(updates);
  apiResponse.success(res, 'Review updated', review);
});

const deleteReview = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const review = await BookReview.findOne({ where: { review_id: req.params.review_id, user_id: req.user!.user_id } });
  if (!review) { apiResponse.notFound(res, 'Review not found'); return; }
  await review.destroy();
  apiResponse.success(res, 'Review deleted');
});

// Favorites
const listFavorites = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const favorites = await FavoriteBook.findAll({
    where: { user_id: req.user!.user_id },
    include: [{ association: 'book', include: [{ association: 'category', attributes: ['category_name'] }] }],
    order: [['created_at', 'DESC']],
  });
  apiResponse.success(res, 'Favorites retrieved', favorites);
});

const addFavorite = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { book_id } = req.body;
  const existing = await FavoriteBook.findOne({ where: { user_id: req.user!.user_id, book_id } });
  if (existing) { apiResponse.conflict(res, 'Book already in favorites'); return; }
  const fav = await FavoriteBook.create({ user_id: req.user!.user_id, book_id });
  apiResponse.created(res, 'Added to favorites', fav);
});

const removeFavorite = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const fav = await FavoriteBook.findOne({ where: { favorite_id: req.params.favorite_id, user_id: req.user!.user_id } });
  if (!fav) { apiResponse.notFound(res, 'Favorite not found'); return; }
  await fav.destroy();
  apiResponse.success(res, 'Removed from favorites');
});

export { listReviews, createReview, updateReview, deleteReview, listFavorites, addFavorite, removeFavorite };
