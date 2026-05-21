import { Request, Response } from 'express';
import { Op } from 'sequelize';
import { School, District, Regency, BorrowingSetting } from '../models';
import { SchoolStatus, AuditActionType, TABLE_NAMES, UserRole } from '../config/constants';
import apiResponse from '../utils/apiResponse';
import { asyncHandler } from '../middleware/errorHandler';
import { parsePaginationParams, buildPaginationResult, parseFilterParams, parseSearchQuery } from '../utils/pagination';
import { buildRegionalFilter, isWithinScope } from '../middleware/rbac';
import { createAuditLog, buildAuditFromRequest } from '../services/auditService';
import env from '../config/environment';

const listSchools = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const pagination = parsePaginationParams(req, 'created_at', ['created_at', 'school_name', 'school_status']);
  const filters = parseFilterParams(req, ['school_status', 'district_id', 'regency_id']);
  const search = parseSearchQuery(req);
  const where: any = { ...filters };
  const regionFilter = buildRegionalFilter(req.user);
  Object.assign(where, regionFilter);

  if (search) { where.school_name = { [Op.like]: `%${search}%` }; }

  const { count, rows } = await School.findAndCountAll({
    where,
    include: [
      { association: 'district', attributes: ['district_id', 'district_name'] },
      { association: 'regency', attributes: ['regency_id', 'regency_name'] },
    ],
    order: [[pagination.sortBy, pagination.sortOrder]],
    limit: pagination.limit, offset: pagination.offset,
  });
  apiResponse.paginated(res, 'Schools retrieved', rows, buildPaginationResult(count, pagination));
});

const getSchool = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const school = await School.findByPk(req.params.school_id as string, {
    include: [
      { association: 'district', attributes: ['district_id', 'district_name'] },
      { association: 'regency', attributes: ['regency_id', 'regency_name'] },
      { association: 'borrowing_setting' },
    ],
  });
  if (!school) { apiResponse.notFound(res, 'School not found'); return; }
  if (!isWithinScope(req.user, school)) { apiResponse.forbidden(res, 'Cannot access school outside your region'); return; }
  apiResponse.success(res, 'School retrieved', school);
});

const createSchool = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { school_name, school_address, district_id, regency_id } = req.body;
  const district = await District.findByPk(district_id);
  if (!district) { apiResponse.badRequest(res, 'District not found'); return; }

  let targetDistrictId = district_id;
  let targetRegencyId = regency_id || district.regency_id;

  if (req.user!.user_role === UserRole.DISTRICT_ADMIN) {
    targetDistrictId = req.user!.district_id;
    targetRegencyId = req.user!.regency_id;
  } else if (req.user!.user_role === UserRole.REGENCY_ADMIN) {
    targetRegencyId = req.user!.regency_id;
    if (district.regency_id !== req.user!.regency_id) {
      apiResponse.forbidden(res, 'Cannot create school in a district outside your regency');
      return;
    }
  }

  const school = await School.create({
    school_name, school_address,
    district_id: targetDistrictId, regency_id: targetRegencyId,
    school_status: SchoolStatus.ACTIVE,
  });

  // Create default borrowing settings for the school
  await BorrowingSetting.create({
    school_id: school.school_id,
    max_borrow_days: env.DEFAULT_MAX_BORROW_DAYS,
    max_books_per_student: env.DEFAULT_MAX_BOOKS_PER_STUDENT,
    penalty_rate_per_day: env.DEFAULT_PENALTY_RATE_PER_DAY,
    allow_extensions: env.DEFAULT_ALLOW_EXTENSIONS,
    max_extensions: env.DEFAULT_MAX_EXTENSIONS,
  });

  await createAuditLog(buildAuditFromRequest(req, AuditActionType.CREATE, TABLE_NAMES.SCHOOLS, school.school_id, null, { school_name }));
  apiResponse.created(res, 'School created', school);
});

const updateSchool = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const school = await School.findByPk(req.params.school_id as string);
  if (!school) { apiResponse.notFound(res, 'School not found'); return; }
  if (!isWithinScope(req.user, school)) { apiResponse.forbidden(res, 'Cannot modify school outside your region'); return; }
  const oldValues = school.toJSON();
  const { school_name, school_address, school_status } = req.body;
  const updates: any = {};
  if (school_name) updates.school_name = school_name;
  if (school_address) updates.school_address = school_address;
  if (school_status) updates.school_status = school_status;
  await school.update(updates);
  await createAuditLog(buildAuditFromRequest(req, AuditActionType.UPDATE, TABLE_NAMES.SCHOOLS, school.school_id, oldValues, updates));
  apiResponse.success(res, 'School updated', school);
});

const deleteSchool = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const school = await School.findByPk(req.params.school_id as string);
  if (!school) { apiResponse.notFound(res, 'School not found'); return; }
  if (!isWithinScope(req.user, school)) { apiResponse.forbidden(res, 'Cannot delete school outside your region'); return; }
  await school.destroy();
  await createAuditLog(buildAuditFromRequest(req, AuditActionType.SOFT_DELETE, TABLE_NAMES.SCHOOLS, school.school_id));
  apiResponse.success(res, 'School deleted');
});

// ---- Region Controllers ----
const listRegencies = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const userRole = req.user!.user_role as UserRole;
  const where: any = {};
  // Non-super-admins can only see their own regency
  if (userRole !== UserRole.SUPER_ADMIN && req.user!.regency_id) {
    where.regency_id = req.user!.regency_id;
  }
  const regencies = await Regency.findAll({ where, order: [['regency_name', 'ASC']] });
  apiResponse.success(res, 'Regencies retrieved', regencies);
});

const getRegency = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const regency = await Regency.findByPk(req.params.regency_id as string, { include: [{ association: 'districts' }] });
  if (!regency) { apiResponse.notFound(res, 'Regency not found'); return; }
  if (!isWithinScope(req.user, { regency_id: regency.regency_id })) { apiResponse.forbidden(res, 'Cannot access regency outside your scope'); return; }
  apiResponse.success(res, 'Regency retrieved', regency);
});

const createRegency = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const regency = await Regency.create({ regency_name: req.body.regency_name });
  await createAuditLog(buildAuditFromRequest(req, AuditActionType.CREATE, TABLE_NAMES.REGENCIES, regency.regency_id));
  apiResponse.created(res, 'Regency created', regency);
});

const updateRegency = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const regency = await Regency.findByPk(req.params.regency_id as string);
  if (!regency) { apiResponse.notFound(res, 'Regency not found'); return; }
  const oldValues = regency.toJSON();
  await regency.update({ regency_name: req.body.regency_name });
  await createAuditLog(buildAuditFromRequest(req, AuditActionType.UPDATE, TABLE_NAMES.REGENCIES, regency.regency_id, oldValues, { regency_name: req.body.regency_name }));
  apiResponse.success(res, 'Regency updated', regency);
});

const deleteRegency = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const regency = await Regency.findByPk(req.params.regency_id as string);
  if (!regency) { apiResponse.notFound(res, 'Regency not found'); return; }
  
  const districtCount = await District.count({ where: { regency_id: regency.regency_id } });
  if (districtCount > 0) { apiResponse.badRequest(res, 'Cannot delete regency with existing districts'); return; }

  await regency.destroy();
  await createAuditLog(buildAuditFromRequest(req, AuditActionType.DELETE, TABLE_NAMES.REGENCIES, regency.regency_id));
  apiResponse.success(res, 'Regency deleted');
});

const listDistricts = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const userRole = req.user!.user_role as UserRole;
  const where: any = {};
  if (req.query.regency_id) where.regency_id = req.query.regency_id;
  // Scope filtering: regency admins only see districts in their regency
  if (userRole === UserRole.REGENCY_ADMIN && req.user!.regency_id) {
    where.regency_id = req.user!.regency_id;
  } else if (userRole === UserRole.DISTRICT_ADMIN && req.user!.district_id) {
    where.district_id = req.user!.district_id;
  } else if (userRole === UserRole.SCHOOL_ADMIN || userRole === UserRole.STUDENT_MEMBER) {
    if (req.user!.district_id) where.district_id = req.user!.district_id;
  }
  const districts = await District.findAll({ where, include: [{ association: 'regency', attributes: ['regency_id', 'regency_name'] }], order: [['district_name', 'ASC']] });
  apiResponse.success(res, 'Districts retrieved', districts);
});

const getDistrict = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const district = await District.findByPk(req.params.district_id as string, { include: [{ association: 'regency' }, { association: 'schools' }] });
  if (!district) { apiResponse.notFound(res, 'District not found'); return; }
  if (!isWithinScope(req.user, { regency_id: district.regency_id, district_id: district.district_id })) { apiResponse.forbidden(res, 'Cannot access district outside your scope'); return; }
  apiResponse.success(res, 'District retrieved', district);
});

const createDistrict = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { district_name, regency_id } = req.body;
  
  let targetRegencyId = regency_id;
  if (req.user!.user_role === UserRole.REGENCY_ADMIN) {
    targetRegencyId = req.user!.regency_id;
  }

  const regency = await Regency.findByPk(targetRegencyId);
  if (!regency) { apiResponse.badRequest(res, 'Regency not found'); return; }
  const district = await District.create({ district_name, regency_id: targetRegencyId });
  await createAuditLog(buildAuditFromRequest(req, AuditActionType.CREATE, TABLE_NAMES.DISTRICTS, district.district_id));
  apiResponse.created(res, 'District created', district);
});

const updateDistrict = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const district = await District.findByPk(req.params.district_id as string);
  if (!district) { apiResponse.notFound(res, 'District not found'); return; }
  if (!isWithinScope(req.user, { regency_id: district.regency_id, district_id: district.district_id })) { apiResponse.forbidden(res, 'Cannot modify district outside your scope'); return; }
  const oldValues = district.toJSON();
  await district.update({ district_name: req.body.district_name });
  await createAuditLog(buildAuditFromRequest(req, AuditActionType.UPDATE, TABLE_NAMES.DISTRICTS, district.district_id, oldValues, { district_name: req.body.district_name }));
  apiResponse.success(res, 'District updated', district);
});

const deleteDistrict = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const district = await District.findByPk(req.params.district_id as string);
  if (!district) { apiResponse.notFound(res, 'District not found'); return; }
  if (!isWithinScope(req.user, { regency_id: district.regency_id, district_id: district.district_id })) { apiResponse.forbidden(res, 'Cannot delete district outside your scope'); return; }
  
  const schoolCount = await School.count({ where: { district_id: district.district_id } });
  if (schoolCount > 0) { apiResponse.badRequest(res, 'Cannot delete district with existing schools'); return; }

  await district.destroy();
  await createAuditLog(buildAuditFromRequest(req, AuditActionType.DELETE, TABLE_NAMES.DISTRICTS, district.district_id));
  apiResponse.success(res, 'District deleted');
});

export { listSchools, getSchool, createSchool, updateSchool, deleteSchool, listRegencies, getRegency, createRegency, updateRegency, deleteRegency, listDistricts, getDistrict, createDistrict, updateDistrict, deleteDistrict };
