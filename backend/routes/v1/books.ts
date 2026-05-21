import { Router } from 'express';
import { createBook, updateBook, deleteBook, getBook, listBooks } from '../../controllers/bookController';
import { authenticate } from '../../middleware/auth';
import { requireMinRole, enforceRegionalScope } from '../../middleware/rbac';
import { UserRole } from '../../config/constants';
import { uploadSingle } from '../../middleware/upload';
import { validate } from '../../middleware/validator';
import Joi from 'joi';

const router = Router();

const createBookSchema = { body: Joi.object({ book_title: Joi.string().min(1).max(500).required(), author_name: Joi.string().min(1).max(255).required(), publisher_name: Joi.string().allow(null, '').optional(), isbn_code: Joi.string().allow(null, '').optional(), publication_year: Joi.number().integer().min(1).max(9999).allow(null).optional(), category_id: Joi.number().integer().positive().allow(null).optional(), school_id: Joi.number().integer().positive().allow(null).optional(), rack_location: Joi.string().allow(null, '').optional(), total_stock: Joi.number().integer().min(0).required(), book_description: Joi.string().allow(null, '').optional() }) };
const updateBookSchema = { body: Joi.object({ book_title: Joi.string().min(1).max(500).optional(), author_name: Joi.string().min(1).max(255).optional(), publisher_name: Joi.string().allow(null, '').optional(), isbn_code: Joi.string().allow(null, '').optional(), publication_year: Joi.number().integer().min(1).max(9999).allow(null).optional(), category_id: Joi.number().integer().positive().allow(null).optional(), rack_location: Joi.string().allow(null, '').optional(), total_stock: Joi.number().integer().min(0).optional(), book_description: Joi.string().allow(null, '').optional(), book_status: Joi.string().valid('available', 'borrowed', 'reserved', 'damaged', 'lost', 'maintenance').optional() }), params: Joi.object({ book_id: Joi.number().integer().positive().required() }) };

router.get('/', authenticate, listBooks);
router.get('/:book_id', authenticate, getBook);
router.post('/', authenticate, requireMinRole(UserRole.SCHOOL_ADMIN), uploadSingle('cover_image'), validate(createBookSchema), createBook);
router.put('/:book_id', authenticate, requireMinRole(UserRole.SCHOOL_ADMIN), uploadSingle('cover_image'), validate(updateBookSchema), updateBook);
router.delete('/:book_id', authenticate, requireMinRole(UserRole.SCHOOL_ADMIN), deleteBook);

export default router;
