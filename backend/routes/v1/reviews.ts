import { Router } from 'express';
import { listReviews, createReview, updateReview, deleteReview, listFavorites, addFavorite, removeFavorite } from '../../controllers/reviewController';
import { authenticate } from '../../middleware/auth';
import { validate } from '../../middleware/validator';
import Joi from 'joi';

const router = Router();

const reviewSchema = { body: Joi.object({ book_id: Joi.number().integer().positive().required(), rating_score: Joi.number().integer().min(1).max(5).required(), review_text: Joi.string().allow(null, '').optional() }) };

// Reviews
router.get('/', authenticate, listReviews);
router.post('/', authenticate, validate(reviewSchema), createReview);
router.put('/:review_id', authenticate, updateReview);
router.delete('/:review_id', authenticate, deleteReview);

// Favorites
router.get('/favorites', authenticate, listFavorites);
router.post('/favorites', authenticate, addFavorite);
router.delete('/favorites/:favorite_id', authenticate, removeFavorite);

export default router;
