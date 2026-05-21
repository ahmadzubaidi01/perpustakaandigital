import { Router } from 'express';
import { listBookQrs, getBookQr, generateQrCodes, scanQr, updateQrStatus, getQrDownloadData, getScanLogs, deleteQrCode } from '../../controllers/qrController';
import { authenticate } from '../../middleware/auth';
import { requireMinRole } from '../../middleware/rbac';
import { UserRole } from '../../config/constants';
import { qrScanLimiter } from '../../middleware/rateLimiter';
import { validate } from '../../middleware/validator';
import Joi from 'joi';

const router = Router();

const scanSchema = { body: Joi.object({ qr_payload: Joi.string().required(), scan_type: Joi.string().valid('borrowing', 'returning', 'verification', 'inventory', 'audit').optional(), latitude: Joi.number().min(-90).max(90).allow(null).optional(), longitude: Joi.number().min(-180).max(180).allow(null).optional() }) };
const generateSchema = { body: Joi.object({ book_id: Joi.number().integer().positive().required(), quantity: Joi.number().integer().min(1).max(100).required() }) };

router.get('/', authenticate, listBookQrs);
router.get('/scan-logs', authenticate, requireMinRole(UserRole.SCHOOL_ADMIN), getScanLogs);
router.get('/:book_qr_id', authenticate, getBookQr);
router.get('/:book_qr_id/download', authenticate, getQrDownloadData);
router.post('/generate', authenticate, requireMinRole(UserRole.SCHOOL_ADMIN), validate(generateSchema), generateQrCodes);
router.post('/scan', authenticate, qrScanLimiter, validate(scanSchema), scanQr);
router.patch('/:book_qr_id/status', authenticate, requireMinRole(UserRole.SCHOOL_ADMIN), updateQrStatus);
router.delete('/:book_qr_id', authenticate, requireMinRole(UserRole.SCHOOL_ADMIN), deleteQrCode);

export default router;

