import { Request, Response } from 'express';
import { Op, fn, col, literal } from 'sequelize';
import { User, Book, Borrowing, School, District, BookQr, UserSession, AuditLog } from '../models';
import { BorrowingStatus, UserRole, AccountStatus, SessionStatus } from '../config/constants';
import apiResponse from '../utils/apiResponse';
import { asyncHandler } from '../middleware/errorHandler';
import { setCache, getCache } from '../config/redis';
import { buildRegionalFilter } from '../middleware/rbac';

/** Super Admin Dashboard */
const getSuperAdminDashboard = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const cacheKey = 'dashboard:super_admin';
  const cached = await getCache(cacheKey);
  if (cached) { apiResponse.success(res, 'Dashboard (cached)', cached); return; }

  const [totalBooks, totalSchools, totalStudents, totalBorrowings, activeBorrowings, onlineUsers, recentAuditLogs] = await Promise.all([
    Book.count(),
    School.count(),
    User.count({ where: { user_role: UserRole.STUDENT_MEMBER } }),
    Borrowing.count(),
    Borrowing.count({ where: { borrowing_status: { [Op.in]: [BorrowingStatus.BORROWED, BorrowingStatus.LATE] } } }),
    UserSession.count({ where: { session_status: SessionStatus.ACTIVE, expired_at: { [Op.gt]: new Date() } } }),
    AuditLog.findAll({ order: [['created_at', 'DESC']], limit: 10, include: [{ association: 'performed_by', attributes: ['user_id', 'full_name'] }] }),
  ]);

  // Region analytics
  const regionStats = await School.findAll({
    attributes: ['regency_id', [fn('COUNT', col('school_id')), 'school_count']],
    group: ['regency_id'],
    include: [{ association: 'regency', attributes: ['regency_name'] }],
    raw: false,
  });

  const data = { total_books: totalBooks, total_schools: totalSchools, total_students: totalStudents, total_borrowings: totalBorrowings, active_borrowings: activeBorrowings, online_users: onlineUsers, region_analytics: regionStats, recent_audit_logs: recentAuditLogs };
  await setCache(cacheKey, data, 300);
  apiResponse.success(res, 'Super Admin Dashboard', data);
});

/** Regency Admin Dashboard */
const getRegencyAdminDashboard = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const regencyId = req.user!.regency_id;
  if (!regencyId) { apiResponse.badRequest(res, 'Regency ID not assigned'); return; }

  const cacheKey = `dashboard:regency:${regencyId}`;
  const cached = await getCache(cacheKey);
  if (cached) { apiResponse.success(res, 'Dashboard (cached)', cached); return; }

  const [totalSchools, totalDistricts, totalBooks, totalBorrowings] = await Promise.all([
    School.count({ where: { regency_id: regencyId } }),
    District.count({ where: { regency_id: regencyId } }),
    Book.count({ include: [{ association: 'school', attributes: [], where: { regency_id: regencyId } }] }),
    Borrowing.count({ include: [{ association: 'book_qr', attributes: [], include: [{ association: 'book', attributes: [], include: [{ association: 'school', attributes: [], where: { regency_id: regencyId } }] }] }] }),
  ]);

  const districtStats = await School.findAll({
    attributes: ['district_id', [fn('COUNT', col('school_id')), 'school_count']],
    where: { regency_id: regencyId },
    group: ['district_id'],
    include: [{ association: 'district', attributes: ['district_name'] }],
  });

  const data = { total_schools: totalSchools, total_districts: totalDistricts, total_books: totalBooks, total_borrowings: totalBorrowings, district_activity: districtStats };
  await setCache(cacheKey, data, 300);
  apiResponse.success(res, 'Regency Admin Dashboard', data);
});

/** District Admin Dashboard */
const getDistrictAdminDashboard = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const districtId = req.user!.district_id;
  if (!districtId) { apiResponse.badRequest(res, 'District ID not assigned'); return; }

  const cacheKey = `dashboard:district:${districtId}`;
  const cached = await getCache(cacheKey);
  if (cached) { apiResponse.success(res, 'Dashboard (cached)', cached); return; }

  const [totalSchools, totalBooks, totalBorrowings] = await Promise.all([
    School.count({ where: { district_id: districtId } }),
    Book.count({ include: [{ association: 'school', attributes: [], where: { district_id: districtId } }] }),
    Borrowing.count({ include: [{ association: 'book_qr', attributes: [], include: [{ association: 'book', attributes: [], include: [{ association: 'school', attributes: [], where: { district_id: districtId } }] }] }] }),
  ]);

  const schoolStats = await Book.findAll({
    attributes: ['school_id', [fn('COUNT', col('book_id')), 'book_count'], [fn('SUM', col('available_stock')), 'total_available']],
    include: [{ association: 'school', attributes: ['school_name'], where: { district_id: districtId } }],
    group: ['school_id'],
  });

  const data = { total_schools: totalSchools, total_books: totalBooks, total_borrowings: totalBorrowings, school_activity: schoolStats };
  await setCache(cacheKey, data, 300);
  apiResponse.success(res, 'District Admin Dashboard', data);
});

/** School Admin Dashboard */
const getSchoolAdminDashboard = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const schoolId = req.user!.school_id;
  if (!schoolId) { apiResponse.badRequest(res, 'School ID not assigned'); return; }

  const cacheKey = `dashboard:school:${schoolId}`;
  const cached = await getCache(cacheKey);
  if (cached) { apiResponse.success(res, 'Dashboard (cached)', cached); return; }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [borrowedBooks, availableBooks, totalBooks, dailyBorrowings, dailyReturns] = await Promise.all([
    Book.sum('borrowed_stock', { where: { school_id: schoolId } }),
    Book.sum('available_stock', { where: { school_id: schoolId } }),
    Book.count({ where: { school_id: schoolId } }),
    Borrowing.count({ where: { borrowed_at: { [Op.gte]: today } }, include: [{ association: 'book_qr', attributes: [], include: [{ association: 'book', attributes: [], where: { school_id: schoolId } }] }] }),
    Borrowing.count({ where: { returned_at: { [Op.gte]: today } }, include: [{ association: 'book_qr', attributes: [], include: [{ association: 'book', attributes: [], where: { school_id: schoolId } }] }] }),
  ]);

  // Popular books
  const popularBooks = await Borrowing.findAll({
    attributes: [[fn('COUNT', col('Borrowing.borrowing_id')), 'borrow_count']],
    include: [{ association: 'book_qr', attributes: [], include: [{ association: 'book', attributes: ['book_id', 'book_title', 'author_name', 'cover_image_url'], where: { school_id: schoolId } }] }],
    group: ['book_qr.book.book_id'],
    order: [[literal('borrow_count'), 'DESC']],
    limit: 5,
    raw: false,
  });

  // Top borrowers
  const topBorrowers = await Borrowing.findAll({
    attributes: ['user_id', [fn('COUNT', col('Borrowing.borrowing_id')), 'borrow_count']],
    include: [{ association: 'borrower', attributes: ['user_id', 'full_name', 'class_name'] }],
    where: { borrowing_status: { [Op.in]: [BorrowingStatus.BORROWED, BorrowingStatus.RETURNED] } },
    group: ['user_id'],
    order: [[literal('borrow_count'), 'DESC']],
    limit: 5,
  });

  const data = { borrowed_books: borrowedBooks || 0, available_books: availableBooks || 0, total_books: totalBooks, daily_borrowings: dailyBorrowings, daily_returns: dailyReturns, popular_books: popularBooks, top_borrowers: topBorrowers };
  await setCache(cacheKey, data, 300);
  apiResponse.success(res, 'School Admin Dashboard', data);
});

export { getSuperAdminDashboard, getRegencyAdminDashboard, getDistrictAdminDashboard, getSchoolAdminDashboard };
