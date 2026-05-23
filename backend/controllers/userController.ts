import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { Op } from 'sequelize';
import { User, School } from '../models';
import { UserRole, AccountStatus, AuditActionType, TABLE_NAMES, ROLE_HIERARCHY } from '../config/constants';
import apiResponse from '../utils/apiResponse';
import { asyncHandler } from '../middleware/errorHandler';
import { parsePaginationParams, buildPaginationResult, parseFilterParams, parseSearchQuery } from '../utils/pagination';
import { buildRegionalFilter, isWithinScope } from '../middleware/rbac';
import { createAuditLog, buildAuditFromRequest } from '../services/auditService';
import { generateUUID, validatePasswordComplexity } from '../utils/helpers';
import { generateMemberQr } from '../services/qrService';
import { deleteCache, deleteCachePattern } from '../config/redis';
import env from '../config/environment';

const listUsers = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  console.log('[DEBUG] listUsers API CALLED!', {
    user: req.user ? { user_id: req.user.user_id, role: req.user.user_role, regency_id: req.user.regency_id, district_id: req.user.district_id, school_id: req.user.school_id } : null,
    query: req.query
  });
  const pagination = parsePaginationParams(req, 'created_at', ['created_at', 'full_name', 'email_address', 'user_role', 'account_status']);
  const filters = parseFilterParams(req, ['user_role', 'account_status', 'school_id', 'district_id', 'regency_id']);
  const search = parseSearchQuery(req);
  const where: any = { ...filters };

  // Exclude the current logged-in user from the user listing
  where.user_id = { [Op.ne]: req.user!.user_id };

  // Regional scope: build smarter filter that covers both direct assignment and school-based membership
  const userRole = req.user!.user_role as UserRole;
  if (userRole === UserRole.REGENCY_ADMIN && req.user!.regency_id) {
    // Find users who are directly assigned to this regency OR belong to a school in this regency
    const schoolIds = (await School.findAll({ where: { regency_id: req.user!.regency_id }, attributes: ['school_id'], raw: true })).map((s: any) => s.school_id);
    where[Op.or] = [
      { regency_id: req.user!.regency_id },
      ...(schoolIds.length > 0 ? [{ school_id: { [Op.in]: schoolIds } }] : []),
    ];
  } else if (userRole === UserRole.DISTRICT_ADMIN && req.user!.district_id) {
    const schoolIds = (await School.findAll({ where: { district_id: req.user!.district_id }, attributes: ['school_id'], raw: true })).map((s: any) => s.school_id);
    where[Op.or] = [
      { district_id: req.user!.district_id },
      ...(schoolIds.length > 0 ? [{ school_id: { [Op.in]: schoolIds } }] : []),
    ];
  } else if (userRole === UserRole.SCHOOL_ADMIN && req.user!.school_id) {
    where.school_id = req.user!.school_id;
  }
  // super_admin: no filter (sees all)

  if (search) {
    // Wrap existing Op.or to combine with search
    const searchCondition = [
      { full_name: { [Op.like]: `%${search}%` } },
      { email_address: { [Op.like]: `%${search}%` } },
      { student_id_number: { [Op.like]: `%${search}%` } },
    ];
    if (where[Op.or]) {
      // Already have a regional OR condition — wrap it with AND to combine
      const regionCondition = where[Op.or];
      delete where[Op.or];
      where[Op.and] = [
        { [Op.or]: regionCondition },
        { [Op.or]: searchCondition },
      ];
    } else {
      where[Op.or] = searchCondition;
    }
  }

  const { count, rows } = await User.findAndCountAll({
    where,
    include: [
      { association: 'school', attributes: ['school_id', 'school_name'], required: false },
      { association: 'district', attributes: ['district_id', 'district_name'], required: false },
      { association: 'regency', attributes: ['regency_id', 'regency_name'], required: false },
    ],
    order: [[pagination.sortBy, pagination.sortOrder]],
    limit: pagination.limit,
    offset: pagination.offset,
  });

  apiResponse.paginated(res, 'Users retrieved', rows, buildPaginationResult(count, pagination));
});

const getUser = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const user = await User.findByPk(req.params.user_id as string, {
    include: [
      { association: 'school', attributes: ['school_id', 'school_name'], required: false },
      { association: 'district', attributes: ['district_id', 'district_name'], required: false },
      { association: 'regency', attributes: ['regency_id', 'regency_name'], required: false },
    ],
  });
  if (!user) { apiResponse.notFound(res, 'User not found'); return; }
  if (!isWithinScope(req.user, user)) { apiResponse.forbidden(res, 'Cannot access user outside your region'); return; }
  apiResponse.success(res, 'User retrieved', user);
});

const createUser = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { full_name, email_address, password, phone_number, student_id_number, class_name, user_role, school_id, district_id, regency_id } = req.body;

  const pwCheck = validatePasswordComplexity(password);
  if (!pwCheck.valid) { apiResponse.unprocessable(res, 'Password does not meet requirements', pwCheck.errors); return; }

  const existing = await User.scope('withDeleted').findOne({ where: { [Op.or]: [{ email_address }, ...(student_id_number ? [{ student_id_number }] : [])] } });
  if (existing) { apiResponse.conflict(res, 'Account with this email or student ID already exists'); return; }

  // Validate scope: creator can only assign regions within their own scope
  const targetScope = { school_id: school_id || null, district_id: district_id || null, regency_id: regency_id || null };
  if (!isWithinScope(req.user, targetScope)) { apiResponse.forbidden(res, 'Cannot create user outside your region scope'); return; }

  const password_hash = await bcrypt.hash(password, env.BCRYPT_SALT_ROUNDS);
  const member_qr_uuid = generateUUID();
  const profilePhotoUrl = req.file ? `/uploads/${req.file.filename}` : null;

  const user = await User.create({
    full_name, email_address, password_hash,
    phone_number: phone_number || null,
    student_id_number: student_id_number || null,
    class_name: class_name || null,
    member_qr_uuid,
    user_role: user_role || UserRole.STUDENT_MEMBER,
    account_status: AccountStatus.ACTIVE,
    profile_photo_url: profilePhotoUrl,
    school_id: school_id || null,
    district_id: district_id || null,
    regency_id: regency_id || null,
  });

  if (user_role === UserRole.STUDENT_MEMBER || !user_role) {
    await generateMemberQr(member_qr_uuid, user.user_id, full_name);
  }

  await createAuditLog(buildAuditFromRequest(req, AuditActionType.CREATE, TABLE_NAMES.USERS, user.user_id, null, { full_name, email_address, user_role: user.user_role }));
  apiResponse.created(res, 'User created', user);
});

const updateUser = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const user = await User.findByPk(req.params.user_id as string);
  if (!user) { apiResponse.notFound(res, 'User not found'); return; }
  if (!isWithinScope(req.user, user)) { apiResponse.forbidden(res, 'Cannot modify user outside your region'); return; }

  // Prevent modifying users of equal or higher authority to protect administrative credentials
  const currentUserRole = req.user!.user_role as UserRole;
  const targetUserRole = user.user_role as UserRole;
  if (ROLE_HIERARCHY[targetUserRole] <= ROLE_HIERARCHY[currentUserRole] && user.user_id !== req.user!.user_id) {
    apiResponse.forbidden(res, 'Cannot modify an administrator of equal or higher authority');
    return;
  }

  const oldValues = user.toJSON();
  const { full_name, phone_number, student_id_number, class_name, account_status, user_role, school_id, district_id, regency_id, password } = req.body;
  const updates: any = {};

  if (full_name) updates.full_name = full_name;
  if (phone_number !== undefined) updates.phone_number = phone_number === '' ? null : phone_number;
  if (student_id_number !== undefined) updates.student_id_number = student_id_number === '' ? null : student_id_number;
  if (class_name !== undefined) updates.class_name = class_name === '' ? null : class_name;
  if (account_status) updates.account_status = account_status;
  if (user_role) updates.user_role = user_role;
  if (school_id !== undefined) updates.school_id = school_id === '' ? null : school_id;
  if (district_id !== undefined) updates.district_id = district_id === '' ? null : district_id;
  if (regency_id !== undefined) updates.regency_id = regency_id === '' ? null : regency_id;
  if (req.file) updates.profile_photo_url = `/uploads/${req.file.filename}`;

  if (password !== undefined && password !== '') {
    if (currentUserRole !== UserRole.SUPER_ADMIN && user.user_id !== req.user!.user_id) {
      apiResponse.forbidden(res, 'Hanya Super Admin yang dapat mengganti kata sandi pengguna lain');
      return;
    }
    const pwCheck = validatePasswordComplexity(password);
    if (!pwCheck.valid) { apiResponse.unprocessable(res, 'Kata sandi tidak memenuhi kriteria', pwCheck.errors); return; }
    updates.password_hash = await bcrypt.hash(password, env.BCRYPT_SALT_ROUNDS);
  }

  await user.update(updates);
  await createAuditLog(buildAuditFromRequest(req, AuditActionType.UPDATE, TABLE_NAMES.USERS, user.user_id, oldValues, updates));
  apiResponse.success(res, 'User updated', user);
});

const deleteUser = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const user = await User.findByPk(req.params.user_id as string);
  if (!user) { apiResponse.notFound(res, 'User not found'); return; }
  if (!isWithinScope(req.user, user)) { apiResponse.forbidden(res, 'Cannot delete user outside your region'); return; }

  // Prevent deleting users of equal or higher authority to protect administrative credentials
  const currentUserRole = req.user!.user_role as UserRole;
  const targetUserRole = user.user_role as UserRole;
  if (ROLE_HIERARCHY[targetUserRole] <= ROLE_HIERARCHY[currentUserRole] && user.user_id !== req.user!.user_id) {
    apiResponse.forbidden(res, 'Cannot delete an administrator of equal or higher authority');
    return;
  }

  await user.destroy();
  await createAuditLog(buildAuditFromRequest(req, AuditActionType.SOFT_DELETE, TABLE_NAMES.USERS, user.user_id));
  apiResponse.success(res, 'User deleted');
});

const updateProfile = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const user = await User.findByPk(req.user!.user_id);
  if (!user) { apiResponse.notFound(res, 'User not found'); return; }

  const { full_name, phone_number, class_name } = req.body;
  const updates: any = {};
  if (full_name) updates.full_name = full_name;
  if (phone_number !== undefined) updates.phone_number = phone_number;
  if (class_name !== undefined) updates.class_name = class_name;
  if (req.file) updates.profile_photo_url = `/uploads/${req.file.filename}`;

  await user.update(updates);
  apiResponse.success(res, 'Profile updated', user);
});

const changePassword = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { current_password, new_password } = req.body;
  const user = await User.scope('withPassword').findByPk(req.user!.user_id);
  if (!user) { apiResponse.notFound(res, 'User not found'); return; }

  const isValid = await bcrypt.compare(current_password, user.password_hash);
  if (!isValid) { apiResponse.badRequest(res, 'Current password is incorrect'); return; }

  const pwCheck = validatePasswordComplexity(new_password);
  if (!pwCheck.valid) { apiResponse.unprocessable(res, 'Password does not meet requirements', pwCheck.errors); return; }

  const password_hash = await bcrypt.hash(new_password, env.BCRYPT_SALT_ROUNDS);
  await user.update({ password_hash });
  apiResponse.success(res, 'Password changed successfully');
});

export { listUsers, getUser, createUser, updateUser, deleteUser, updateProfile, changePassword };
