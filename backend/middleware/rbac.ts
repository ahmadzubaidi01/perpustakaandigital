import { Request, Response, NextFunction } from 'express';
import { UserRole, ROLE_HIERARCHY } from '../config/constants';
import apiResponse from '../utils/apiResponse';

/**
 * Role-Based Access Control (RBAC) middleware.
 * Enforces the complete multi-level role hierarchy:
 * super_admin > regency_admin > district_admin > school_admin > student_member
 */

/**
 * Restrict access to specific roles.
 */
const requireRole = (...allowedRoles: UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      apiResponse.unauthorized(res, 'Authentication required');
      return;
    }

    const userRole = req.user.user_role as UserRole;

    if (!allowedRoles.includes(userRole)) {
      apiResponse.forbidden(res, 'Insufficient permissions for this action');
      return;
    }

    next();
  };
};

/**
 * Restrict access to users with role at or above the specified minimum level.
 * Lower hierarchy number = higher authority.
 */
const requireMinRole = (minRole: UserRole) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      apiResponse.unauthorized(res, 'Authentication required');
      return;
    }

    const userRole = req.user.user_role as UserRole;
    const userLevel = ROLE_HIERARCHY[userRole];
    const requiredLevel = ROLE_HIERARCHY[minRole];

    if (userLevel === undefined || userLevel > requiredLevel) {
      apiResponse.forbidden(res, 'Insufficient permissions for this action');
      return;
    }

    next();
  };
};

/**
 * Enforce regional scope — users can only access data within their assigned region.
 * - Super Admin: unrestricted
 * - Regency Admin: only their regency
 * - District Admin: only their district
 * - School Admin: only their school
 * - Student Member: only their school
 */
const enforceRegionalScope = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.user) {
    apiResponse.unauthorized(res, 'Authentication required');
    return;
  }

  const userRole = req.user.user_role as UserRole;

  // Super Admin can access everything
  if (userRole === UserRole.SUPER_ADMIN) {
    next();
    return;
  }

  // Extract target scope from request params or query
  const targetRegencyId = parseInt((req.params.regency_id || req.query.regency_id) as string, 10);
  const targetDistrictId = parseInt((req.params.district_id || req.query.district_id) as string, 10);
  const targetSchoolId = parseInt((req.params.school_id || req.query.school_id) as string, 10);

  switch (userRole) {
    case UserRole.REGENCY_ADMIN:
      if (targetRegencyId && targetRegencyId !== req.user.regency_id) {
        apiResponse.forbidden(res, 'Cannot access data outside your regency');
        return;
      }
      break;

    case UserRole.DISTRICT_ADMIN:
      if (targetDistrictId && targetDistrictId !== req.user.district_id) {
        apiResponse.forbidden(res, 'Cannot access data outside your district');
        return;
      }
      if (targetRegencyId && targetRegencyId !== req.user.regency_id) {
        apiResponse.forbidden(res, 'Cannot access data outside your regency');
        return;
      }
      break;

    case UserRole.SCHOOL_ADMIN:
    case UserRole.STUDENT_MEMBER:
      if (targetSchoolId && targetSchoolId !== req.user.school_id) {
        apiResponse.forbidden(res, 'Cannot access data outside your school');
        return;
      }
      break;
  }

  next();
};

/**
 * Enforce that user can only access their own data.
 * Super Admin and school admins can access any user in their scope.
 */
const enforceSelfOrAdmin = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.user) {
    apiResponse.unauthorized(res, 'Authentication required');
    return;
  }

  const userRole = req.user.user_role as UserRole;
  const targetUserId = parseInt(req.params.user_id as string, 10);

  // Admins can access (scope will be enforced separately)
  if (ROLE_HIERARCHY[userRole] <= ROLE_HIERARCHY[UserRole.SCHOOL_ADMIN]) {
    next();
    return;
  }

  // Students can only access their own data
  if (targetUserId && targetUserId !== req.user.user_id) {
    apiResponse.forbidden(res, 'You can only access your own data');
    return;
  }

  next();
};

/**
 * Build a regional scope filter based on user's role and assigned region.
 * Returns a Sequelize where clause for filtering.
 */
const buildRegionalFilter = (user: Express.Request['user']): Record<string, any> => {
  if (!user) return {};

  const userRole = user.user_role as UserRole;

  switch (userRole) {
    case UserRole.SUPER_ADMIN:
      return {}; // No filter — access all

    case UserRole.REGENCY_ADMIN:
      return { regency_id: user.regency_id };

    case UserRole.DISTRICT_ADMIN:
      return { district_id: user.district_id };

    case UserRole.SCHOOL_ADMIN:
    case UserRole.STUDENT_MEMBER:
      return { school_id: user.school_id };

    default:
      return {};
  }
};

/**
 * Check if a record belongs to the requesting user's region scope.
 * Returns true if the user is allowed to access the record.
 * 
 * The record must have at least one of: school_id, district_id, regency_id.
 * Super Admins always pass. Other roles are checked against their assigned region.
 */
const isWithinScope = (
  user: Express.Request['user'],
  record: { school_id?: number | null; district_id?: number | null; regency_id?: number | null }
): boolean => {
  if (!user) return false;

  const userRole = user.user_role as UserRole;

  // Super Admin can access everything
  if (userRole === UserRole.SUPER_ADMIN) return true;

  switch (userRole) {
    case UserRole.REGENCY_ADMIN:
      // Must match regency_id
      if (record.regency_id != null) return record.regency_id === user.regency_id;
      return true; // If record has no regency_id, allow (e.g. global categories)

    case UserRole.DISTRICT_ADMIN:
      // Prefer district_id match, fallback to regency_id
      if (record.district_id != null) return record.district_id === user.district_id;
      if (record.regency_id != null) return record.regency_id === user.regency_id;
      return true;

    case UserRole.SCHOOL_ADMIN:
    case UserRole.STUDENT_MEMBER:
      // Prefer school_id match, fallback up the chain
      if (record.school_id != null) return record.school_id === user.school_id;
      if (record.district_id != null) return record.district_id === user.district_id;
      if (record.regency_id != null) return record.regency_id === user.regency_id;
      return true;

    default:
      return false;
  }
};

export {
  requireRole,
  requireMinRole,
  enforceRegionalScope,
  enforceSelfOrAdmin,
  buildRegionalFilter,
  isWithinScope,
};

