import { Request, Response } from 'express';
import { Op, Transaction } from 'sequelize';
import { sequelize, Borrowing, BookQr, Book, User, BorrowingSetting } from '../models';
import { BorrowingStatus, PenaltyStatus, QrStatus, AuditActionType, TABLE_NAMES, UserRole } from '../config/constants';
import apiResponse from '../utils/apiResponse';
import { asyncHandler } from '../middleware/errorHandler';
import { generateBorrowingCode, calculateLatePenalty, isPastDue } from '../utils/helpers';
import { syncBookStock } from '../services/stockSyncService';
import { createAuditLog, buildAuditFromRequest } from '../services/auditService';
import { sendDueReminder, sendLateWarning } from '../services/notificationService';
import { parsePaginationParams, buildPaginationResult, parseFilterParams } from '../utils/pagination';
import { buildRegionalFilter, isWithinScope } from '../middleware/rbac';
import env from '../config/environment';

/**
 * POST /api/v1/borrowings
 * Create a new borrowing request (student scans QR, system validates).
 * Uses database transactions and concurrency-safe locking.
 */
const createBorrowing = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { book_qr_id, latitude, longitude } = req.body;
  const userId = req.user!.user_id;

  const result = await sequelize.transaction(async (t: Transaction) => {
    // Lock the QR record for concurrency safety
    const bookQr = await BookQr.findByPk(book_qr_id, { lock: Transaction.LOCK.UPDATE, transaction: t, include: [{ association: 'book', attributes: ['book_id', 'book_title', 'school_id', 'available_stock'] }] });
    if (!bookQr) throw Object.assign(new Error('Book QR not found'), { statusCode: 404 });
    if (bookQr.qr_status !== QrStatus.ACTIVE) throw Object.assign(new Error(`QR code is ${bookQr.qr_status}`), { statusCode: 400 });

    const book = (bookQr as any).book;
    if (!book) throw Object.assign(new Error('Associated book not found'), { statusCode: 404 });

    // Scope check: validate student can only borrow from their own school
    if (!isWithinScope(req.user, book)) {
      throw Object.assign(new Error('Cannot borrow book outside your school scope'), { statusCode: 403 });
    }

    // Check if QR is already actively borrowed
    const activeBorrowing = await Borrowing.findOne({ where: { book_qr_id, borrowing_status: { [Op.in]: [BorrowingStatus.PENDING, BorrowingStatus.APPROVED, BorrowingStatus.BORROWED, BorrowingStatus.RESERVED, BorrowingStatus.LATE] } }, transaction: t });
    if (activeBorrowing) throw Object.assign(new Error('This physical book is already borrowed'), { statusCode: 409 });

    // Check borrowing limits
    const settings = await BorrowingSetting.findOne({ where: { school_id: book.school_id }, transaction: t });
    const maxBooks = settings?.max_books_per_student || env.DEFAULT_MAX_BOOKS_PER_STUDENT;
    const activeCount = await Borrowing.count({ where: { user_id: userId, borrowing_status: { [Op.in]: [BorrowingStatus.PENDING, BorrowingStatus.APPROVED, BorrowingStatus.BORROWED, BorrowingStatus.LATE] } }, transaction: t });
    if (activeCount >= maxBooks) throw Object.assign(new Error(`Maximum ${maxBooks} active borrowings allowed`), { statusCode: 400 });

    // Check stock
    if (book.available_stock <= 0) throw Object.assign(new Error('No available stock'), { statusCode: 400 });

    const borrowingCode = generateBorrowingCode();
    const borrowing = await Borrowing.create({ borrowing_code: borrowingCode, user_id: userId, book_qr_id, borrowing_status: BorrowingStatus.PENDING, late_penalty_amount: 0 }, { transaction: t });

    // Sync stock
    await syncBookStock(book.book_id, t);

    return { borrowing, book_title: book.book_title };
  });

  await createAuditLog(buildAuditFromRequest(req, AuditActionType.BORROW, TABLE_NAMES.BORROWINGS, result.borrowing.borrowing_id, null, { borrowing_code: result.borrowing.borrowing_code, book_qr_id }));
  apiResponse.created(res, 'Borrowing request created', result.borrowing);
});

/**
 * PATCH /api/v1/borrowings/:borrowing_id/approve
 * Admin approves borrowing request.
 */
const approveBorrowing = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { borrowing_id } = req.params;

  const result = await sequelize.transaction(async (t: Transaction) => {
    const borrowing = await Borrowing.findByPk(borrowing_id as string, { lock: Transaction.LOCK.UPDATE, transaction: t, include: [{ association: 'borrower' }, { association: 'book_qr', include: [{ association: 'book' }] }] });
    if (!borrowing) throw Object.assign(new Error('Borrowing not found'), { statusCode: 404 });
    if (borrowing.borrowing_status !== BorrowingStatus.PENDING) throw Object.assign(new Error('Only pending borrowings can be approved'), { statusCode: 400 });

    const book = (borrowing as any).book_qr?.book;
    if (book && !isWithinScope(req.user, book)) {
      throw Object.assign(new Error('Cannot approve borrowing outside your regional scope'), { statusCode: 403 });
    }

    const borrower = (borrowing as any).borrower;
    if (borrower && !isWithinScope(req.user, borrower)) {
      throw Object.assign(new Error('Cannot approve borrowing for a student outside your regional scope'), { statusCode: 403 });
    }

    const settings = await BorrowingSetting.findOne({ where: { school_id: book?.school_id }, transaction: t });
    const maxDays = settings?.max_borrow_days || env.DEFAULT_MAX_BORROW_DAYS;
    const now = new Date();
    const dueDate = new Date(now.getTime() + maxDays * 24 * 60 * 60 * 1000);

    await borrowing.update({ borrowing_status: BorrowingStatus.BORROWED, approved_by_user_id: req.user!.user_id, borrowed_at: now, due_date: dueDate }, { transaction: t });
    const bookQr = (borrowing as any).book_qr;
    if (bookQr) {
      await bookQr.update({ qr_status: QrStatus.BORROWED }, { transaction: t });
    }
    if (book) await syncBookStock(book.book_id, t);

    return borrowing;
  });

  await createAuditLog(buildAuditFromRequest(req, AuditActionType.APPROVE, TABLE_NAMES.BORROWINGS, result.borrowing_id, { borrowing_status: BorrowingStatus.PENDING }, { borrowing_status: BorrowingStatus.BORROWED }));
  apiResponse.success(res, 'Borrowing approved', result);
});

/**
 * PATCH /api/v1/borrowings/:borrowing_id/return
 * Process book return with penalty calculation.
 */
const returnBorrowing = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { borrowing_id } = req.params;

  const result = await sequelize.transaction(async (t: Transaction) => {
    const borrowing = await Borrowing.findByPk(borrowing_id as string, { lock: Transaction.LOCK.UPDATE, transaction: t, include: [{ association: 'borrower' }, { association: 'book_qr', include: [{ association: 'book' }] }] });
    if (!borrowing) throw Object.assign(new Error('Borrowing not found'), { statusCode: 404 });
    if (![BorrowingStatus.BORROWED, BorrowingStatus.LATE].includes(borrowing.borrowing_status as any)) throw Object.assign(new Error('Book is not currently borrowed'), { statusCode: 400 });

    const book = (borrowing as any).book_qr?.book;
    if (book && !isWithinScope(req.user, book)) {
      throw Object.assign(new Error('Cannot return book outside your regional scope'), { statusCode: 403 });
    }

    const borrower = (borrowing as any).borrower;
    if (borrower && !isWithinScope(req.user, borrower)) {
      throw Object.assign(new Error('Cannot return borrowing for a student outside your regional scope'), { statusCode: 403 });
    }

    const now = new Date();
    let penaltyAmount = parseFloat(String(borrowing.late_penalty_amount || 0));
    let penaltyStatus = borrowing.penalty_status;

    if (borrowing.due_date && isPastDue(borrowing.due_date)) {
      const settings = await BorrowingSetting.findOne({ where: { school_id: book?.school_id }, transaction: t });
      const rate = settings ? parseFloat(String(settings.penalty_rate_per_day)) : env.DEFAULT_PENALTY_RATE_PER_DAY;
      const additionalPenalty = calculateLatePenalty(borrowing.due_date, now, rate);
      penaltyAmount += additionalPenalty;
      if (penaltyAmount > 0 && penaltyStatus !== PenaltyStatus.PAID) {
        penaltyStatus = PenaltyStatus.UNPAID;
      }
    }

    await borrowing.update({ borrowing_status: BorrowingStatus.RETURNED, returned_at: now, late_penalty_amount: penaltyAmount, penalty_status: penaltyStatus }, { transaction: t });
    const bookQr = (borrowing as any).book_qr;
    if (bookQr) {
      await bookQr.update({ qr_status: QrStatus.ACTIVE }, { transaction: t });
    }
    if (book) await syncBookStock(book.book_id, t);

    return borrowing;
  });

  await createAuditLog(buildAuditFromRequest(req, AuditActionType.RETURN, TABLE_NAMES.BORROWINGS, result.borrowing_id));
  apiResponse.success(res, 'Book returned successfully', result);
});

/**
 * PATCH /api/v1/borrowings/:borrowing_id/extend
 * Extend borrowing due date.
 */
const extendBorrowing = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { borrowing_id } = req.params;

  const result = await sequelize.transaction(async (t: Transaction) => {
    const borrowing = await Borrowing.findByPk(borrowing_id as string, { lock: Transaction.LOCK.UPDATE, transaction: t, include: [{ association: 'borrower' }, { association: 'book_qr', include: [{ association: 'book' }] }] });
    if (!borrowing) throw Object.assign(new Error('Borrowing not found'), { statusCode: 404 });
    if (![BorrowingStatus.BORROWED, BorrowingStatus.LATE].includes(borrowing.borrowing_status)) {
      throw Object.assign(new Error('Only borrowed or late books can be extended'), { statusCode: 400 });
    }

    const book = (borrowing as any).book_qr?.book;
    
    // Scope check: Student can only extend their own; Admins can extend within their scope.
    const userRole = req.user!.user_role as UserRole;
    if (userRole === UserRole.STUDENT_MEMBER) {
      if (borrowing.user_id !== req.user!.user_id) {
        throw Object.assign(new Error('You can only extend your own borrowings'), { statusCode: 403 });
      }
    } else {
      if (book && !isWithinScope(req.user, book)) {
        throw Object.assign(new Error('Cannot extend borrowing outside your regional scope'), { statusCode: 403 });
      }
      const borrower = (borrowing as any).borrower;
      if (borrower && !isWithinScope(req.user, borrower)) {
        throw Object.assign(new Error('Cannot extend borrowing for a student outside your regional scope'), { statusCode: 403 });
      }
    }

    const settings = await BorrowingSetting.findOne({ where: { school_id: book?.school_id }, transaction: t });
    if (!settings?.allow_extensions && !env.DEFAULT_ALLOW_EXTENSIONS) throw Object.assign(new Error('Extensions are not allowed'), { statusCode: 400 });

    const maxDays = settings?.max_borrow_days || env.DEFAULT_MAX_BORROW_DAYS;
    
    // Base extension date: if original due date is in the future, extend from that.
    // If original due date is already passed (late), extend from now.
    const baseDate = (borrowing.due_date && borrowing.due_date.getTime() > Date.now()) 
      ? new Date(borrowing.due_date) 
      : new Date();
    const newDueDate = new Date(baseDate.getTime() + maxDays * 24 * 60 * 60 * 1000);

    // Calculate penalty accrued up to today if it was late
    let penaltyAmount = parseFloat(String(borrowing.late_penalty_amount || 0));
    let penaltyStatus = borrowing.penalty_status;

    if (borrowing.due_date && isPastDue(borrowing.due_date)) {
      const rate = settings ? parseFloat(String(settings.penalty_rate_per_day)) : env.DEFAULT_PENALTY_RATE_PER_DAY;
      const additionalPenalty = calculateLatePenalty(borrowing.due_date, new Date(), rate);
      penaltyAmount += additionalPenalty;
      if (penaltyAmount > 0 && penaltyStatus !== PenaltyStatus.PAID) {
        penaltyStatus = PenaltyStatus.UNPAID;
      }
    }

    await borrowing.update({
      due_date: newDueDate,
      borrowing_status: BorrowingStatus.BORROWED,
      late_penalty_amount: penaltyAmount,
      penalty_status: penaltyStatus
    }, { transaction: t });

    return borrowing;
  });

  await createAuditLog(buildAuditFromRequest(req, AuditActionType.EXTEND, TABLE_NAMES.BORROWINGS, result.borrowing_id));
  apiResponse.success(res, 'Borrowing extended', result);
});

/**
 * POST /api/v1/borrowings/reserve
 * Reserve a book.
 */
const reserveBook = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { book_qr_id } = req.body;
  const userId = req.user!.user_id;

  const result = await sequelize.transaction(async (t: Transaction) => {
    const bookQr = await BookQr.findByPk(book_qr_id, { lock: Transaction.LOCK.UPDATE, transaction: t, include: [{ association: 'book' }] });
    if (!bookQr) throw Object.assign(new Error('Book QR not found'), { statusCode: 404 });

    const book = (bookQr as any).book;
    if (book && !isWithinScope(req.user, book)) {
      throw Object.assign(new Error('Cannot reserve book outside your school scope'), { statusCode: 403 });
    }

    const activeBorrowing = await Borrowing.findOne({ where: { book_qr_id, borrowing_status: { [Op.in]: [BorrowingStatus.PENDING, BorrowingStatus.APPROVED, BorrowingStatus.BORROWED, BorrowingStatus.RESERVED, BorrowingStatus.LATE] } }, transaction: t });
    if (activeBorrowing) throw Object.assign(new Error('This book copy is not available'), { statusCode: 409 });

    const borrowingCode = generateBorrowingCode();
    const borrowing = await Borrowing.create({ borrowing_code: borrowingCode, user_id: userId, book_qr_id, borrowing_status: BorrowingStatus.RESERVED, late_penalty_amount: 0 }, { transaction: t });

    // Sync stock
    if (book) {
      await syncBookStock(book.book_id, t);
    }

    return borrowing;
  });

  await createAuditLog(buildAuditFromRequest(req, AuditActionType.RESERVE, TABLE_NAMES.BORROWINGS, result.borrowing_id));
  apiResponse.created(res, 'Book reserved', result);
});

/**
 * GET /api/v1/borrowings
 * List borrowings with pagination, filtering, and sorting.
 */
const listBorrowings = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const pagination = parsePaginationParams(req, 'created_at', ['created_at', 'borrowed_at', 'due_date', 'borrowing_status']);
  const filters = parseFilterParams(req, ['borrowing_status', 'penalty_status', 'user_id']);
  const where: any = { ...filters };

  const { search } = req.query;
  if (search) {
    where[Op.or] = [
      { '$borrower.full_name$': { [Op.like]: `%${search}%` } },
      { '$borrower.student_id_number$': { [Op.like]: `%${search}%` } },
      { borrowing_code: { [Op.like]: `%${search}%` } }
    ];
  }

  // Regional scope: filter through book_qr -> book -> school
  const userRole = req.user!.user_role as UserRole;
  const regionFilter = buildRegionalFilter(req.user);

  // Build school-level where for the nested include
  const schoolWhere: any = {};
  if (regionFilter.school_id) schoolWhere.school_id = regionFilter.school_id;
  else if (regionFilter.district_id) schoolWhere.district_id = regionFilter.district_id;
  else if (regionFilter.regency_id) schoolWhere.regency_id = regionFilter.regency_id;

  // For students, also limit to their own borrowings
  if (userRole === UserRole.STUDENT_MEMBER) {
    where.user_id = req.user!.user_id;
  }

  const schoolInclude: any = { association: 'school', attributes: ['school_id', 'school_name', 'district_id', 'regency_id'] };
  if (Object.keys(schoolWhere).length > 0) {
    schoolInclude.where = schoolWhere;
    schoolInclude.required = true;
  }

  const bookInclude: any = {
    association: 'book',
    attributes: ['book_id', 'book_title', 'book_code', 'school_id'],
    paranoid: false,
    include: [schoolInclude]
  };
  if (Object.keys(schoolWhere).length > 0) {
    bookInclude.required = true;
  }

  const { count, rows } = await Borrowing.findAndCountAll({ where, include: [{ association: 'borrower', attributes: ['user_id', 'full_name', 'email_address', 'student_id_number', 'class_name'] }, { association: 'book_qr', required: Object.keys(schoolWhere).length > 0, paranoid: false, include: [bookInclude] }, { association: 'approved_by', attributes: ['user_id', 'full_name'] }], order: [[pagination.sortBy, pagination.sortOrder]], limit: pagination.limit, offset: pagination.offset });

  apiResponse.paginated(res, 'Borrowings retrieved', rows, buildPaginationResult(count, pagination));
});

/**
 * GET /api/v1/borrowings/:borrowing_id
 */
const getBorrowing = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const borrowing = await Borrowing.findByPk(req.params.borrowing_id as string, {
    include: [
      { association: 'borrower', required: false, attributes: ['user_id', 'full_name', 'email_address', 'class_name', 'student_id_number'] },
      { 
        association: 'book_qr', 
        required: false, 
        paranoid: false,
        include: [{ association: 'book', required: false, paranoid: false }] 
      },
      { association: 'approved_by', required: false, attributes: ['user_id', 'full_name'] }
    ]
  });
  if (!borrowing) { apiResponse.notFound(res, 'Borrowing not found'); return; }

  // Scope check: validate via the book's school
  const book = (borrowing as any).book_qr?.book;
  if (book && !isWithinScope(req.user, book)) { apiResponse.forbidden(res, 'Cannot access borrowing outside your region'); return; }

  // Students can only see their own borrowings
  if (req.user!.user_role === UserRole.STUDENT_MEMBER && borrowing.user_id !== req.user!.user_id) {
    apiResponse.forbidden(res, 'You can only access your own borrowings'); return;
  }

  apiResponse.success(res, 'Borrowing retrieved', borrowing);
});

/**
 * POST /api/v1/borrowings/quick-borrow
 * Admin one-click borrow: validates student + QR, auto-approves in one transaction.
 */
const quickBorrow = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { student_id, qr_payload } = req.body;
  const adminUserId = req.user!.user_id;

  if (!student_id || !qr_payload) {
    apiResponse.badRequest(res, 'student_id and qr_payload are required');
    return;
  }

  // Validate QR payload
  const { validateQrPayload } = require('../services/qrService');
  const validation = validateQrPayload(qr_payload);
  if (!validation.valid) {
    apiResponse.badRequest(res, validation.error || 'Invalid QR payload');
    return;
  }

  const result = await sequelize.transaction(async (t: Transaction) => {
    // Find the student
    const student = await User.findByPk(student_id, { transaction: t });
    if (!student) throw Object.assign(new Error('Student not found'), { statusCode: 404 });
    if (student.user_role !== UserRole.STUDENT_MEMBER) throw Object.assign(new Error('User is not a student'), { statusCode: 400 });

    // Find the book QR by UUID
    const bookQr = await BookQr.findOne({
      where: { qr_uuid: validation.data!.uuid },
      lock: Transaction.LOCK.UPDATE,
      transaction: t,
      include: [{ association: 'book', attributes: ['book_id', 'book_title', 'school_id', 'available_stock'] }],
    });
    if (!bookQr) throw Object.assign(new Error('Book QR not found'), { statusCode: 404 });
    if (bookQr.qr_status !== QrStatus.ACTIVE) throw Object.assign(new Error(`QR code is ${bookQr.qr_status}`), { statusCode: 400 });

    const book = (bookQr as any).book;
    if (!book) throw Object.assign(new Error('Associated book not found'), { statusCode: 404 });

    // Scope check: Admin can only quick-borrow for books and students in their regional scope
    if (!isWithinScope(req.user, book)) {
      throw Object.assign(new Error('Cannot borrow book outside your regional scope'), { statusCode: 403 });
    }
    if (!isWithinScope(req.user, student)) {
      throw Object.assign(new Error('Cannot borrow for a student outside your regional scope'), { statusCode: 403 });
    }

    // Check if QR is already actively borrowed
    const activeBorrowing = await Borrowing.findOne({
      where: {
        book_qr_id: bookQr.book_qr_id,
        borrowing_status: { [Op.in]: [BorrowingStatus.PENDING, BorrowingStatus.APPROVED, BorrowingStatus.BORROWED, BorrowingStatus.RESERVED, BorrowingStatus.LATE] },
      },
      transaction: t,
    });
    if (activeBorrowing) throw Object.assign(new Error('This physical book is already borrowed'), { statusCode: 409 });

    // Check borrowing limits
    const settings = await BorrowingSetting.findOne({ where: { school_id: book.school_id }, transaction: t });
    const maxBooks = settings?.max_books_per_student || env.DEFAULT_MAX_BOOKS_PER_STUDENT;
    const activeCount = await Borrowing.count({
      where: {
        user_id: student.user_id,
        borrowing_status: { [Op.in]: [BorrowingStatus.PENDING, BorrowingStatus.APPROVED, BorrowingStatus.BORROWED, BorrowingStatus.LATE] },
      },
      transaction: t,
    });
    if (activeCount >= maxBooks) throw Object.assign(new Error(`Student has reached maximum ${maxBooks} active borrowings`), { statusCode: 400 });

    // Check stock
    if (book.available_stock <= 0) throw Object.assign(new Error('No available stock'), { statusCode: 400 });

    // Create borrowing and auto-approve
    const borrowingCode = generateBorrowingCode();
    const maxDays = settings?.max_borrow_days || env.DEFAULT_MAX_BORROW_DAYS;
    const now = new Date();
    const dueDate = new Date(now.getTime() + maxDays * 24 * 60 * 60 * 1000);

    const borrowing = await Borrowing.create({
      borrowing_code: borrowingCode,
      user_id: student.user_id,
      book_qr_id: bookQr.book_qr_id,
      borrowing_status: BorrowingStatus.BORROWED,
      approved_by_user_id: adminUserId,
      borrowed_at: now,
      due_date: dueDate,
      late_penalty_amount: 0,
    }, { transaction: t });

    await bookQr.update({ qr_status: QrStatus.BORROWED }, { transaction: t });

    // Sync stock
    await syncBookStock(book.book_id, t);

    return { borrowing, book_title: book.book_title, student_name: student.full_name, due_date: dueDate };
  });

  // Audit & notification
  await createAuditLog(buildAuditFromRequest(req, AuditActionType.QUICK_BORROW, TABLE_NAMES.BORROWINGS, result.borrowing.borrowing_id, null, {
    borrowing_code: result.borrowing.borrowing_code,
    student_id,
  }));

  // Send notification to student
  try {
    const { sendBorrowingEvent } = require('../services/notificationService');
    await sendBorrowingEvent(student_id, result.book_title, 'quick_borrow');
  } catch { /* notification failure is non-critical */ }

  apiResponse.created(res, 'Quick borrow completed', {
    borrowing: result.borrowing,
    book_title: result.book_title,
    student_name: result.student_name,
    due_date: result.due_date,
  });
});

/**
 * POST /api/v1/borrowings/quick-return
 * Admin one-click return: finds active borrowing by QR and processes return.
 */
const quickReturn = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { qr_payload } = req.body;

  if (!qr_payload) {
    apiResponse.badRequest(res, 'qr_payload is required');
    return;
  }

  const { validateQrPayload } = require('../services/qrService');
  const validation = validateQrPayload(qr_payload);
  if (!validation.valid) {
    apiResponse.badRequest(res, validation.error || 'Invalid QR payload');
    return;
  }

  const result = await sequelize.transaction(async (t: Transaction) => {
    // Find the book QR by UUID
    const bookQr = await BookQr.findOne({
      where: { qr_uuid: validation.data!.uuid },
      transaction: t,
      include: [{ association: 'book', attributes: ['book_id', 'book_title', 'school_id'] }],
    });
    if (!bookQr) throw Object.assign(new Error('Book QR not found'), { statusCode: 404 });

    const book = (bookQr as any).book;
    if (book && !isWithinScope(req.user, book)) {
      throw Object.assign(new Error('Cannot return book outside your regional scope'), { statusCode: 403 });
    }

    // Find the active borrowing for this QR
    const borrowing = await Borrowing.findOne({
      where: {
        book_qr_id: bookQr.book_qr_id,
        borrowing_status: { [Op.in]: [BorrowingStatus.BORROWED, BorrowingStatus.LATE] },
      },
      lock: Transaction.LOCK.UPDATE,
      transaction: t,
      include: [{ association: 'borrower', attributes: ['user_id', 'full_name', 'email_address', 'class_name', 'student_id_number', 'school_id', 'district_id', 'regency_id'] }],
    });
    if (!borrowing) throw Object.assign(new Error('No active borrowing found for this QR code'), { statusCode: 404 });

    const borrower = (borrowing as any).borrower;
    if (borrower && !isWithinScope(req.user, borrower)) {
      throw Object.assign(new Error('Cannot return borrowing for a student outside your regional scope'), { statusCode: 403 });
    }

    const now = new Date();
    let penaltyAmount = parseFloat(String(borrowing.late_penalty_amount || 0));
    let penaltyStatus = borrowing.penalty_status;

    if (borrowing.due_date && isPastDue(borrowing.due_date)) {
      const settings = await BorrowingSetting.findOne({ where: { school_id: book?.school_id }, transaction: t });
      const rate = settings ? parseFloat(String(settings.penalty_rate_per_day)) : env.DEFAULT_PENALTY_RATE_PER_DAY;
      const additionalPenalty = calculateLatePenalty(borrowing.due_date, now, rate);
      penaltyAmount += additionalPenalty;
      if (penaltyAmount > 0 && penaltyStatus !== PenaltyStatus.PAID) {
        penaltyStatus = PenaltyStatus.UNPAID;
      }
    }

    await borrowing.update({
      borrowing_status: BorrowingStatus.RETURNED,
      returned_at: now,
      late_penalty_amount: penaltyAmount,
      penalty_status: penaltyStatus,
    }, { transaction: t });

    await bookQr.update({ qr_status: QrStatus.ACTIVE }, { transaction: t });

    if (book) await syncBookStock(book.book_id, t);

    return {
      borrowing,
      book_title: book?.book_title || 'Unknown',
      borrower: (borrowing as any).borrower,
      penalty_amount: penaltyAmount,
    };
  });

  // Audit
  await createAuditLog(buildAuditFromRequest(req, AuditActionType.QUICK_RETURN, TABLE_NAMES.BORROWINGS, result.borrowing.borrowing_id));

  // Send notification to student
  try {
    const { sendReturnEvent } = require('../services/notificationService');
    await sendReturnEvent(result.borrowing.user_id, result.book_title, result.penalty_amount);
  } catch { /* notification failure is non-critical */ }

  apiResponse.success(res, 'Quick return completed', {
    borrowing: result.borrowing,
    book_title: result.book_title,
    borrower: result.borrower,
    penalty_amount: result.penalty_amount,
  });
});

/**
 * GET /api/v1/borrowings/search-student
 * Search for students by name, student_id_number, or member_qr_uuid.
 */
const searchStudent = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { q } = req.query;
  if (!q || (q as string).trim().length < 2) {
    apiResponse.badRequest(res, 'Search query must be at least 2 characters');
    return;
  }

  const searchTerm = (q as string).trim();

  // Build regional scope
  const regionFilter = buildRegionalFilter(req.user);
  const where: any = {
    user_role: UserRole.STUDENT_MEMBER,
    account_status: 'active',
    [Op.or]: [
      { full_name: { [Op.like]: `%${searchTerm}%` } },
      { student_id_number: { [Op.like]: `%${searchTerm}%` } },
      { member_qr_uuid: searchTerm },
      { email_address: { [Op.like]: `%${searchTerm}%` } },
    ],
  };

  // Apply school scope
  if (regionFilter.school_id) where.school_id = regionFilter.school_id;
  else if (regionFilter.district_id) where.district_id = regionFilter.district_id;
  else if (regionFilter.regency_id) where.regency_id = regionFilter.regency_id;

  const students = await User.findAll({
    where,
    attributes: ['user_id', 'full_name', 'student_id_number', 'class_name', 'email_address', 'profile_photo_url', 'member_qr_uuid', 'school_id'],
    include: [
      { association: 'school', attributes: ['school_id', 'school_name'], required: false },
    ],
    limit: 20,
    order: [['full_name', 'ASC']],
  });

  // Enrich with active borrowing count
  const enriched = await Promise.all(
    students.map(async (student) => {
      const activeCount = await Borrowing.count({
        where: {
          user_id: student.user_id,
          borrowing_status: { [Op.in]: [BorrowingStatus.PENDING, BorrowingStatus.APPROVED, BorrowingStatus.BORROWED, BorrowingStatus.LATE] },
        },
      });
      return {
        ...(student.toJSON() as any),
        active_borrowing_count: activeCount,
      };
    })
  );

  apiResponse.success(res, 'Students found', enriched);
});

export { createBorrowing, approveBorrowing, returnBorrowing, extendBorrowing, reserveBook, listBorrowings, getBorrowing, quickBorrow, quickReturn, searchStudent };
