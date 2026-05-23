import { Router } from 'express';
import { listUsers, getUser, createUser, updateUser, deleteUser, updateProfile, changePassword } from '../../controllers/userController';
import { downloadImportTemplate, importUsers } from '../../controllers/importController';
import { authenticate } from '../../middleware/auth';
import { requireMinRole, enforceSelfOrAdmin } from '../../middleware/rbac';
import { UserRole } from '../../config/constants';
import { uploadSingle } from '../../middleware/upload';
import { validate } from '../../middleware/validator';
import multer from 'multer';
import path from 'path';
import Joi from 'joi';

const router = Router();

const uploadCsvOrExcel = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext !== '.csv' && ext !== '.xlsx' && ext !== '.xls') {
      cb(new Error('Hanya diperbolehkan format file .csv, .xlsx, atau .xls') as any, false);
      return;
    }
    cb(null, true);
  }
}).single('file');

const createUserSchema = { body: Joi.object({ full_name: Joi.string().min(1).max(255).required(), email_address: Joi.string().email().required(), password: Joi.string().min(8).required(), phone_number: Joi.string().allow(null, '').optional(), student_id_number: Joi.string().allow(null, '').optional(), class_name: Joi.string().allow(null, '').optional(), user_role: Joi.string().valid('super_admin', 'regency_admin', 'district_admin', 'school_admin', 'student_member').optional(), school_id: Joi.number().integer().positive().allow(null).optional(), district_id: Joi.number().integer().positive().allow(null).optional(), regency_id: Joi.number().integer().positive().allow(null).optional() }) };
const changePasswordSchema = { body: Joi.object({ current_password: Joi.string().required(), new_password: Joi.string().min(8).required() }) };

router.get('/', authenticate, requireMinRole(UserRole.SCHOOL_ADMIN), listUsers);
router.get('/profile', authenticate, updateProfile); // GET for fetching, handled by auth/me
router.put('/profile', authenticate, uploadSingle('profile_photo'), updateProfile);
router.put('/change-password', authenticate, validate(changePasswordSchema), changePassword);

// Import templates and bulk imports (Must be placed before param routes to avoid being captured as :user_id)
router.get('/import-template', authenticate, requireMinRole(UserRole.SCHOOL_ADMIN), downloadImportTemplate);
router.post('/import', authenticate, requireMinRole(UserRole.SCHOOL_ADMIN), uploadCsvOrExcel, importUsers);

router.get('/:user_id', authenticate, enforceSelfOrAdmin, getUser);
router.post('/', authenticate, requireMinRole(UserRole.SCHOOL_ADMIN), uploadSingle('profile_photo'), validate(createUserSchema), createUser);
router.put('/:user_id', authenticate, requireMinRole(UserRole.SCHOOL_ADMIN), uploadSingle('profile_photo'), updateUser);
router.delete('/:user_id', authenticate, requireMinRole(UserRole.SCHOOL_ADMIN), deleteUser);

export default router;
