import { Router } from 'express';
import { getSuperAdminDashboard, getRegencyAdminDashboard, getDistrictAdminDashboard, getSchoolAdminDashboard } from '../../controllers/dashboardController';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/rbac';
import { UserRole } from '../../config/constants';

const router = Router();

router.get('/super-admin', authenticate, requireRole(UserRole.SUPER_ADMIN), getSuperAdminDashboard);
router.get('/regency-admin', authenticate, requireRole(UserRole.REGENCY_ADMIN), getRegencyAdminDashboard);
router.get('/district-admin', authenticate, requireRole(UserRole.DISTRICT_ADMIN), getDistrictAdminDashboard);
router.get('/school-admin', authenticate, requireRole(UserRole.SCHOOL_ADMIN), getSchoolAdminDashboard);

export default router;
