import { Router } from 'express';
import { listSchools, getSchool, createSchool, updateSchool, deleteSchool, listRegencies, getRegency, createRegency, updateRegency, deleteRegency, listDistricts, getDistrict, createDistrict, updateDistrict, deleteDistrict } from '../../controllers/schoolController';
import { authenticate } from '../../middleware/auth';
import { requireMinRole, enforceRegionalScope } from '../../middleware/rbac';
import { UserRole } from '../../config/constants';
import { validate } from '../../middleware/validator';
import Joi from 'joi';

const router = Router();

const createSchoolSchema = { body: Joi.object({ school_name: Joi.string().min(1).max(255).required(), school_address: Joi.string().min(1).required(), district_id: Joi.number().integer().positive().required(), regency_id: Joi.number().integer().positive().optional() }) };

// Schools
router.get('/schools', authenticate, enforceRegionalScope, listSchools);
router.get('/schools/:school_id', authenticate, getSchool);
router.post('/schools', authenticate, requireMinRole(UserRole.DISTRICT_ADMIN), validate(createSchoolSchema), createSchool);
router.put('/schools/:school_id', authenticate, requireMinRole(UserRole.DISTRICT_ADMIN), updateSchool);
router.delete('/schools/:school_id', authenticate, requireMinRole(UserRole.REGENCY_ADMIN), deleteSchool);

// Regencies
router.get('/regencies', authenticate, listRegencies);
router.get('/regencies/:regency_id', authenticate, getRegency);
router.post('/regencies', authenticate, requireMinRole(UserRole.SUPER_ADMIN), createRegency);
router.put('/regencies/:regency_id', authenticate, requireMinRole(UserRole.SUPER_ADMIN), updateRegency);
router.delete('/regencies/:regency_id', authenticate, requireMinRole(UserRole.SUPER_ADMIN), deleteRegency);

// Districts
router.get('/districts', authenticate, listDistricts);
router.get('/districts/:district_id', authenticate, getDistrict);
router.post('/districts', authenticate, requireMinRole(UserRole.REGENCY_ADMIN), createDistrict);
router.put('/districts/:district_id', authenticate, requireMinRole(UserRole.REGENCY_ADMIN), updateDistrict);
router.delete('/districts/:district_id', authenticate, requireMinRole(UserRole.REGENCY_ADMIN), deleteDistrict);

export default router;
