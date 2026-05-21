import { Router } from 'express';
import { listCategories, getCategory, createCategory, updateCategory, deleteCategory } from '../../controllers/categoryController';
import { authenticate } from '../../middleware/auth';
import { requireMinRole } from '../../middleware/rbac';
import { UserRole } from '../../config/constants';
import { validate } from '../../middleware/validator';
import Joi from 'joi';

const router = Router();

const categorySchema = { body: Joi.object({ category_name: Joi.string().min(1).max(255).required() }) };

router.get('/', authenticate, listCategories);
router.get('/:category_id', authenticate, getCategory);
router.post('/', authenticate, requireMinRole(UserRole.SCHOOL_ADMIN), validate(categorySchema), createCategory);
router.put('/:category_id', authenticate, requireMinRole(UserRole.SCHOOL_ADMIN), validate(categorySchema), updateCategory);
router.delete('/:category_id', authenticate, requireMinRole(UserRole.SCHOOL_ADMIN), deleteCategory);

export default router;
