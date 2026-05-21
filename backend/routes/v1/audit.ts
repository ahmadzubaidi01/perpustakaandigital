import { Router } from 'express';
import { listAuditLogs, getAuditLog } from '../../controllers/auditController';
import { authenticate } from '../../middleware/auth';
import { requireMinRole } from '../../middleware/rbac';
import { UserRole } from '../../config/constants';

const router = Router();

router.get('/', authenticate, requireMinRole(UserRole.SCHOOL_ADMIN), listAuditLogs);
router.get('/:log_id', authenticate, requireMinRole(UserRole.SCHOOL_ADMIN), getAuditLog);

export default router;
