import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { Op } from 'sequelize';
import { User, RefreshToken, UserSession, PasswordReset } from '../models';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken, JwtPayload } from '../middleware/auth';
import { AccountStatus, UserRole, SessionStatus, AuditActionType, TABLE_NAMES } from '../config/constants';
import env from '../config/environment';
import apiResponse from '../utils/apiResponse';
import { asyncHandler } from '../middleware/errorHandler';
import { createAuditLog, buildAuditFromRequest } from '../services/auditService';
import { generateMemberQr } from '../services/qrService';
import { generateSecureToken, hashToken, validatePasswordComplexity, generateUUID } from '../utils/helpers';
import { sendEmailNotification } from '../services/notificationService';

const register = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { full_name, email_address, password, phone_number, student_id_number, class_name, school_id } = req.body;
  const passwordCheck = validatePasswordComplexity(password);
  if (!passwordCheck.valid) { apiResponse.unprocessable(res, 'Password does not meet requirements', passwordCheck.errors); return; }
  const existing = await User.scope('withDeleted').findOne({ where: { [Op.or]: [{ email_address }, ...(student_id_number ? [{ student_id_number }] : [])] } });
  if (existing) { apiResponse.conflict(res, 'Account with this email or student ID already exists'); return; }
  const password_hash = await bcrypt.hash(password, env.BCRYPT_SALT_ROUNDS);
  const member_qr_uuid = generateUUID();
  const user = await User.create({ full_name, email_address, password_hash, phone_number: phone_number || null, student_id_number: student_id_number || null, class_name: class_name || null, member_qr_uuid, user_role: UserRole.STUDENT_MEMBER, account_status: AccountStatus.ACTIVE, school_id: school_id || null, district_id: null, regency_id: null });
  await generateMemberQr(member_qr_uuid, user.user_id, full_name);
  await createAuditLog(buildAuditFromRequest(req, AuditActionType.CREATE, TABLE_NAMES.USERS, user.user_id, null, { full_name, email_address, user_role: UserRole.STUDENT_MEMBER }));
  apiResponse.created(res, 'Registration successful', { user_id: user.user_id, full_name: user.full_name, email_address: user.email_address, user_role: user.user_role, member_qr_uuid: user.member_qr_uuid });
});

const login = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { email_address, password } = req.body;
  const user = await User.scope('withPassword').findOne({ where: { email_address }, attributes: ['user_id', 'full_name', 'email_address', 'password_hash', 'user_role', 'account_status', 'school_id', 'district_id', 'regency_id'] });
  if (!user) { apiResponse.unauthorized(res, 'Invalid email or password'); return; }
  if (user.account_status !== AccountStatus.ACTIVE) { apiResponse.forbidden(res, `Account is ${user.account_status}`); return; }
  const isValid = await bcrypt.compare(password, user.password_hash);
  if (!isValid) { apiResponse.unauthorized(res, 'Invalid email or password'); return; }
  // Check concurrent session limits
  const activeSessions = await UserSession.count({ where: { user_id: user.user_id, session_status: SessionStatus.ACTIVE, expired_at: { [Op.gt]: new Date() } } });
  if (activeSessions >= env.MAX_CONCURRENT_SESSIONS) {
    const oldest = await UserSession.findOne({ where: { user_id: user.user_id, session_status: SessionStatus.ACTIVE }, order: [['login_at', 'ASC']] });
    if (oldest) await oldest.update({ session_status: SessionStatus.TERMINATED });
  }
  const payload: JwtPayload = { user_id: user.user_id, user_role: user.user_role, email_address: user.email_address, school_id: user.school_id, district_id: user.district_id, regency_id: user.regency_id };
  const accessToken = generateAccessToken(payload);
  const refreshToken = generateRefreshToken(payload);
  const tokenHash = hashToken(refreshToken);
  const now = new Date();
  await RefreshToken.create({ user_id: user.user_id, token_hash: tokenHash, device_name: req.deviceInfo?.device_name || null, device_type: req.deviceInfo?.device_type || null, ip_address: req.deviceInfo?.ip_address || null, issued_at: now, expired_at: new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000) });
  await UserSession.create({ user_id: user.user_id, device_name: req.deviceInfo?.device_name || null, device_type: req.deviceInfo?.device_type || null, device_os: req.deviceInfo?.device_os || null, browser_name: req.deviceInfo?.browser_name || null, browser_version: req.deviceInfo?.browser_version || null, ip_address: req.deviceInfo?.ip_address || null, login_at: now, expired_at: new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000), session_status: SessionStatus.ACTIVE });
  await user.update({ last_login_at: now });
  await createAuditLog(buildAuditFromRequest(req, AuditActionType.LOGIN, TABLE_NAMES.USERS, user.user_id));
  apiResponse.success(res, 'Login successful', { user: { user_id: user.user_id, full_name: user.full_name, email_address: user.email_address, user_role: user.user_role, school_id: user.school_id, district_id: user.district_id, regency_id: user.regency_id }, tokens: { access_token: accessToken, refresh_token: refreshToken, token_type: 'Bearer', expires_in: env.JWT_ACCESS_EXPIRY } });
});

const refreshAccessToken = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { refresh_token } = req.body;
  if (!refresh_token) { apiResponse.badRequest(res, 'Refresh token is required'); return; }
  let decoded: JwtPayload;
  try { decoded = verifyRefreshToken(refresh_token); } catch { apiResponse.unauthorized(res, 'Invalid or expired refresh token'); return; }
  const tokenHash = hashToken(refresh_token);
  const storedToken = await RefreshToken.findOne({ where: { user_id: decoded.user_id, token_hash: tokenHash, revoked_at: null, expired_at: { [Op.gt]: new Date() } } });
  if (!storedToken) { apiResponse.unauthorized(res, 'Refresh token has been revoked or expired'); return; }
  const user = await User.findByPk(decoded.user_id, { attributes: ['user_id', 'user_role', 'email_address', 'account_status', 'school_id', 'district_id', 'regency_id'] });
  if (!user || user.account_status !== AccountStatus.ACTIVE) { apiResponse.unauthorized(res, 'User account is not active'); return; }
  await storedToken.update({ revoked_at: new Date() });
  const payload: JwtPayload = { user_id: user.user_id, user_role: user.user_role, email_address: user.email_address, school_id: user.school_id, district_id: user.district_id, regency_id: user.regency_id };
  const newAccessToken = generateAccessToken(payload);
  const newRefreshToken = generateRefreshToken(payload);
  const newTokenHash = hashToken(newRefreshToken);
  const now = new Date();
  await RefreshToken.create({ user_id: user.user_id, token_hash: newTokenHash, device_name: req.deviceInfo?.device_name || null, device_type: req.deviceInfo?.device_type || null, ip_address: req.deviceInfo?.ip_address || null, issued_at: now, expired_at: new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000) });
  apiResponse.success(res, 'Token refreshed', { tokens: { access_token: newAccessToken, refresh_token: newRefreshToken, token_type: 'Bearer', expires_in: env.JWT_ACCESS_EXPIRY } });
});

const logout = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { refresh_token } = req.body;
  if (refresh_token) { const th = hashToken(refresh_token); await RefreshToken.update({ revoked_at: new Date() }, { where: { token_hash: th, user_id: req.user!.user_id } }); }
  if (req.deviceInfo?.ip_address) { await UserSession.update({ session_status: SessionStatus.TERMINATED }, { where: { user_id: req.user!.user_id, ip_address: req.deviceInfo.ip_address, session_status: SessionStatus.ACTIVE } }); }
  await createAuditLog(buildAuditFromRequest(req, AuditActionType.LOGOUT, TABLE_NAMES.USERS, req.user!.user_id));
  apiResponse.success(res, 'Logged out successfully');
});

const forgotPassword = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { email_address } = req.body;
  const msg = 'If an account with that email exists, a password reset link has been sent.';
  const user = await User.findOne({ where: { email_address } });
  if (!user) { apiResponse.success(res, msg); return; }
  const resetToken = generateSecureToken(32);
  const resetTokenHash = hashToken(resetToken);
  const expiredAt = new Date(Date.now() + env.RESET_TOKEN_EXPIRY_MINUTES * 60 * 1000);
  await PasswordReset.destroy({ where: { email_address } });
  await PasswordReset.create({ email_address, reset_token_hash: resetTokenHash, expired_at: expiredAt });
  const resetUrl = `${env.FRONTEND_URL}/reset-password?token=${resetToken}`;
  await sendEmailNotification(email_address, 'Password Reset Request', `<h2>Password Reset</h2><p>Click <a href="${resetUrl}">here</a> to reset your password. Expires in ${env.RESET_TOKEN_EXPIRY_MINUTES} minutes.</p>`);
  await createAuditLog(buildAuditFromRequest(req, AuditActionType.PASSWORD_RESET, TABLE_NAMES.USERS, user.user_id));
  apiResponse.success(res, msg);
});

const resetPassword = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { token, new_password } = req.body;
  const pwCheck = validatePasswordComplexity(new_password);
  if (!pwCheck.valid) { apiResponse.unprocessable(res, 'Password does not meet requirements', pwCheck.errors); return; }
  const th = hashToken(token);
  const record = await PasswordReset.findOne({ where: { reset_token_hash: th, expired_at: { [Op.gt]: new Date() } } });
  if (!record) { apiResponse.badRequest(res, 'Invalid or expired reset token'); return; }
  const user = await User.scope('withPassword').findOne({ where: { email_address: record.email_address } });
  if (!user) { apiResponse.notFound(res, 'User not found'); return; }
  const ph = await bcrypt.hash(new_password, env.BCRYPT_SALT_ROUNDS);
  await user.update({ password_hash: ph });
  await record.destroy();
  await RefreshToken.update({ revoked_at: new Date() }, { where: { user_id: user.user_id, revoked_at: null } });
  await UserSession.update({ session_status: SessionStatus.TERMINATED }, { where: { user_id: user.user_id, session_status: SessionStatus.ACTIVE } });
  apiResponse.success(res, 'Password reset successfully. Please login with your new password.');
});

const getProfile = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const user = await User.findByPk(req.user!.user_id, {
    include: [
      { association: 'school', attributes: ['school_id', 'school_name'], required: false },
      { association: 'district', attributes: ['district_id', 'district_name'], required: false },
      { association: 'regency', attributes: ['regency_id', 'regency_name'], required: false },
    ],
  });
  if (!user) { apiResponse.notFound(res, 'User not found'); return; }
  apiResponse.success(res, 'Profile retrieved', user);
});

export { register, login, refreshAccessToken, logout, forgotPassword, resetPassword, getProfile };
