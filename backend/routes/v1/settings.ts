import { Router } from 'express';
import { getSettings, updateSettings, cleanupUnusedFiles } from '../../controllers/settingController';
import { authenticate } from '../../middleware/auth';
import { requireMinRole } from '../../middleware/rbac';
import { UserRole } from '../../config/constants';
import { validate } from '../../middleware/validator';
import Joi from 'joi';

const router = Router();

const settingsSchema = { body: Joi.object({ max_borrow_days: Joi.number().integer().min(1).optional(), max_books_per_student: Joi.number().integer().min(1).optional(), penalty_rate_per_day: Joi.number().min(0).optional(), allow_extensions: Joi.boolean().optional(), max_extensions: Joi.number().integer().min(0).optional() }) };

router.get('/', authenticate, requireMinRole(UserRole.SCHOOL_ADMIN), getSettings);
router.get('/:school_id', authenticate, requireMinRole(UserRole.SCHOOL_ADMIN), getSettings);

router.put('/', authenticate, requireMinRole(UserRole.SCHOOL_ADMIN), validate(settingsSchema), updateSettings);
router.put('/:school_id', authenticate, requireMinRole(UserRole.SCHOOL_ADMIN), validate(settingsSchema), updateSettings);

router.post('/cleanup', authenticate, requireMinRole(UserRole.SCHOOL_ADMIN), cleanupUnusedFiles);

export default router;
