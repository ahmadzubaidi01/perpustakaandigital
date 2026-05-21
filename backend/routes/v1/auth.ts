import { Router } from 'express';
import { register, login, refreshAccessToken, logout, forgotPassword, resetPassword, getProfile } from '../../controllers/authController';
import { authenticate } from '../../middleware/auth';
import { authLimiter, passwordResetLimiter } from '../../middleware/rateLimiter';
import { validate } from '../../middleware/validator';
import Joi from 'joi';

const router = Router();

const loginSchema = { body: Joi.object({ email_address: Joi.string().email().required(), password: Joi.string().required() }) };
const registerSchema = { body: Joi.object({ full_name: Joi.string().min(1).max(255).required(), email_address: Joi.string().email().required(), password: Joi.string().min(8).required(), phone_number: Joi.string().allow(null, '').optional(), student_id_number: Joi.string().allow(null, '').optional(), class_name: Joi.string().allow(null, '').optional(), school_id: Joi.number().integer().positive().allow(null).optional() }) };
const refreshSchema = { body: Joi.object({ refresh_token: Joi.string().required() }) };
const forgotSchema = { body: Joi.object({ email_address: Joi.string().email().required() }) };
const resetSchema = { body: Joi.object({ token: Joi.string().required(), new_password: Joi.string().min(8).required() }) };

router.post('/register', authLimiter, validate(registerSchema), register);
router.post('/login', authLimiter, validate(loginSchema), login);
router.post('/refresh', validate(refreshSchema), refreshAccessToken);
router.post('/logout', authenticate, logout);
router.post('/forgot-password', passwordResetLimiter, validate(forgotSchema), forgotPassword);
router.post('/reset-password', passwordResetLimiter, validate(resetSchema), resetPassword);
router.get('/me', authenticate, getProfile);

export default router;
