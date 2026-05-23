import { Router } from 'express';
import { createBorrowing, approveBorrowing, returnBorrowing, extendBorrowing, listBorrowings, getBorrowing, quickBorrow, quickReturn, searchStudent, deleteBorrowing, bulkDeleteBorrowings } from '../../controllers/borrowingController';
import { authenticate } from '../../middleware/auth';
import { requireMinRole, requireRole } from '../../middleware/rbac';
import { UserRole } from '../../config/constants';
import { validate } from '../../middleware/validator';
import Joi from 'joi';

const router = Router();

const borrowSchema = { body: Joi.object({ book_qr_id: Joi.number().integer().positive().required(), latitude: Joi.number().min(-90).max(90).allow(null).optional(), longitude: Joi.number().min(-180).max(180).allow(null).optional() }) };
const quickBorrowSchema = { body: Joi.object({ student_id: Joi.number().integer().positive().required(), qr_payload: Joi.string().required() }) };
const quickReturnSchema = { body: Joi.object({ qr_payload: Joi.string().required() }) };

router.get('/', authenticate, listBorrowings);
router.get('/search-student', authenticate, requireMinRole(UserRole.SCHOOL_ADMIN), searchStudent);
router.get('/:borrowing_id', authenticate, getBorrowing);
router.post('/', authenticate, validate(borrowSchema), createBorrowing);
router.post('/quick-borrow', authenticate, requireMinRole(UserRole.SCHOOL_ADMIN), validate(quickBorrowSchema), quickBorrow);
router.post('/quick-return', authenticate, requireMinRole(UserRole.SCHOOL_ADMIN), validate(quickReturnSchema), quickReturn);
router.patch('/:borrowing_id/approve', authenticate, requireMinRole(UserRole.SCHOOL_ADMIN), approveBorrowing);
router.patch('/:borrowing_id/return', authenticate, requireMinRole(UserRole.SCHOOL_ADMIN), returnBorrowing);
router.patch('/:borrowing_id/extend', authenticate, extendBorrowing);
router.delete('/:borrowing_id', authenticate, requireMinRole(UserRole.DISTRICT_ADMIN), deleteBorrowing);
router.delete('/', authenticate, requireRole(UserRole.SUPER_ADMIN), bulkDeleteBorrowings);

export default router;
