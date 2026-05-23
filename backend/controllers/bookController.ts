import { Request, Response } from 'express';
import { Op } from 'sequelize';
import fs from 'fs';
import path from 'path';
import { Book, BookQr, BookCategory, School } from '../models';
import { BookStatus, BorrowingStatus, AuditActionType, TABLE_NAMES, UserRole } from '../config/constants';
import apiResponse from '../utils/apiResponse';
import { asyncHandler } from '../middleware/errorHandler';
import { generateBookCode, generateUniqueSlug } from '../utils/helpers';
import { generateBookQrCodes } from '../services/qrService';
import { syncBookStock } from '../services/stockSyncService';
import { createAuditLog, buildAuditFromRequest } from '../services/auditService';
import { parsePaginationParams, buildPaginationResult, parseFilterParams, parseSearchQuery } from '../utils/pagination';
import { buildRegionalFilter, isWithinScope } from '../middleware/rbac';
import { setCache, getCache, deleteCache, deleteCachePattern } from '../config/redis';

const createBook = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { book_title, author_name, publisher_name, isbn_code, publication_year, category_id, school_id, rack_location, total_stock, book_description } = req.body;
  const targetSchoolId = school_id || req.user!.school_id;
  if (!targetSchoolId) { apiResponse.badRequest(res, 'school_id is required'); return; }

  const bookCode = generateBookCode(targetSchoolId);
  const bookSlug = generateUniqueSlug(book_title);
  const coverImageUrl = req.file ? `/uploads/${req.file.filename}` : null;

  const book = await Book.create({ book_code: bookCode, book_title, book_slug: bookSlug, book_description: book_description || null, author_name, publisher_name: publisher_name || null, isbn_code: isbn_code || null, publication_year: publication_year || null, category_id: category_id || null, school_id: targetSchoolId, rack_location: rack_location || null, total_stock: total_stock || 0, available_stock: total_stock || 0, borrowed_stock: 0, cover_image_url: coverImageUrl, book_status: BookStatus.AVAILABLE });

  await deleteCachePattern('books:*');
  await createAuditLog(buildAuditFromRequest(req, AuditActionType.CREATE, TABLE_NAMES.BOOKS, book.book_id, null, { book_code: bookCode, book_title, total_stock }));
  apiResponse.created(res, 'Book created successfully', book);
});

const updateBook = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const book = await Book.findByPk(req.params.book_id as string, { include: [{ association: 'school', attributes: ['school_id', 'district_id', 'regency_id'] }] });
  if (!book) { apiResponse.notFound(res, 'Book not found'); return; }
  const school = (book as any).school;
  if (!isWithinScope(req.user, { school_id: book.school_id, district_id: school?.district_id, regency_id: school?.regency_id })) { apiResponse.forbidden(res, 'Cannot modify book outside your region'); return; }

  const oldValues = book.toJSON();
  const { book_title, author_name, publisher_name, isbn_code, publication_year, category_id, school_id, rack_location, total_stock, book_description, book_status } = req.body;

  const updates: any = {};
  if (book_title) { updates.book_title = book_title; updates.book_slug = generateUniqueSlug(book_title); }
  if (author_name) updates.author_name = author_name;
  if (publisher_name !== undefined) updates.publisher_name = publisher_name;
  if (isbn_code !== undefined) updates.isbn_code = isbn_code;
  if (publication_year !== undefined) updates.publication_year = publication_year;
  if (category_id !== undefined) updates.category_id = category_id;
  if (rack_location !== undefined) updates.rack_location = rack_location;
  if (book_description !== undefined) updates.book_description = book_description;
  if (book_status) updates.book_status = book_status;
  if (req.file) {
    updates.cover_image_url = `/uploads/${req.file.filename}`;
    if (book.cover_image_url) {
      const oldPath = path.resolve(__dirname, '..', book.cover_image_url.replace(/^\//, ''));
      if (fs.existsSync(oldPath)) {
        try {
          fs.unlinkSync(oldPath);
        } catch (err) {
          // Silent catch or log error
        }
      }
    }
  }

  // Handle school_id update
  if (school_id !== undefined) {
    const isHighAdmin = [UserRole.SUPER_ADMIN, UserRole.REGENCY_ADMIN, UserRole.DISTRICT_ADMIN].includes(req.user!.user_role as UserRole);
    if (!isHighAdmin && school_id !== book.school_id) {
      apiResponse.forbidden(res, 'Only regional admins can change the school of a book');
      return;
    }
    const targetSchool = await School.findByPk(school_id);
    if (!targetSchool) {
      apiResponse.notFound(res, 'Target school not found');
      return;
    }
    if (!isWithinScope(req.user, { school_id: targetSchool.school_id, district_id: targetSchool.district_id, regency_id: targetSchool.regency_id })) {
      apiResponse.forbidden(res, 'Cannot assign book to a school outside your region');
      return;
    }
    updates.school_id = school_id;
  }

  // Handle stock changes
  if (total_stock !== undefined) {
    updates.total_stock = total_stock;
  }

  await book.update(updates);
  await syncBookStock(book.book_id);
  await deleteCache(`book:${book.book_id}`);
  await deleteCachePattern('books:*');

  await createAuditLog(buildAuditFromRequest(req, AuditActionType.UPDATE, TABLE_NAMES.BOOKS, book.book_id, oldValues, updates));
  apiResponse.success(res, 'Book updated', book);
});

const deleteBook = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const book = await Book.findByPk(req.params.book_id as string, { include: [{ association: 'school', attributes: ['school_id', 'district_id', 'regency_id'] }] });
  if (!book) { apiResponse.notFound(res, 'Book not found'); return; }
  const school = (book as any).school;
  if (!isWithinScope(req.user, { school_id: book.school_id, district_id: school?.district_id, regency_id: school?.regency_id })) { apiResponse.forbidden(res, 'Cannot delete book outside your region'); return; }
  await book.destroy(); // Soft delete via paranoid
  await deleteCachePattern('books:*');
  await createAuditLog(buildAuditFromRequest(req, AuditActionType.SOFT_DELETE, TABLE_NAMES.BOOKS, book.book_id));
  apiResponse.success(res, 'Book deleted');
});

const getBook = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const cached = await getCache(`book:${req.params.book_id}`);
  if (cached) { apiResponse.success(res, 'Book retrieved (cached)', cached); return; }

  const book = await Book.findByPk(req.params.book_id as string, {
    include: [
      { association: 'category', required: false, attributes: ['category_id', 'category_name'] },
      { association: 'school', required: false, attributes: ['school_id', 'school_name'] },
      {
        association: 'qr_codes',
        required: false,
        attributes: ['book_qr_id', 'qr_uuid', 'qr_serial_number', 'qr_status', 'qr_image_url'],
        include: [
          {
            association: 'borrowings',
            required: false,
            where: {
              borrowing_status: {
                [Op.in]: ['pending', 'approved', 'borrowed', 'late']
              }
            },
            attributes: ['borrowing_id', 'borrowing_status', 'due_date'],
            include: [
              {
                association: 'borrower',
                required: false,
                attributes: ['user_id', 'full_name', 'student_id_number']
              }
            ]
          }
        ]
      },
      { 
        association: 'reviews', 
        required: false, 
        attributes: ['review_id', 'rating_score', 'review_text', 'created_at'], 
        include: [
          { association: 'user', required: false, attributes: ['user_id', 'full_name'] }
        ] 
      }
    ]
  });
  if (!book) { apiResponse.notFound(res, 'Book not found'); return; }

  await setCache(`book:${book.book_id}`, book.toJSON(), 300);
  apiResponse.success(res, 'Book retrieved', book);
});

const listBooks = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const pagination = parsePaginationParams(req, 'created_at', ['created_at', 'book_title', 'author_name', 'publication_year', 'available_stock']);
  const filters = parseFilterParams(req, ['book_status', 'category_id', 'school_id']);
  const search = parseSearchQuery(req);
  const where: any = { ...filters };

  // Apply regional scope — for regency/district admins, scope via school join
  const regionFilter = buildRegionalFilter(req.user);
  if (regionFilter.school_id) {
    where.school_id = regionFilter.school_id;
  } else if (regionFilter.district_id || regionFilter.regency_id) {
    // Will be handled via the school include filter below
  }

  if (search) {
    where[Op.or] = [
      { book_title: { [Op.like]: `%${search}%` } },
      { author_name: { [Op.like]: `%${search}%` } },
      { isbn_code: { [Op.like]: `%${search}%` } },
      { book_code: { [Op.like]: `%${search}%` } },
    ];
  }

  // Build school include — add a where clause if scoping by district or regency
  const schoolIncludeWhere: any = {};
  if (regionFilter.district_id) schoolIncludeWhere.district_id = regionFilter.district_id;
  else if (regionFilter.regency_id) schoolIncludeWhere.regency_id = regionFilter.regency_id;
  const schoolInclude = Object.keys(schoolIncludeWhere).length > 0
    ? { association: 'school', attributes: ['school_id', 'school_name'], where: schoolIncludeWhere }
    : { association: 'school', attributes: ['school_id', 'school_name'] };

  const { count, rows } = await Book.findAndCountAll({ where, include: [{ association: 'category', attributes: ['category_id', 'category_name'] }, schoolInclude], order: [[pagination.sortBy, pagination.sortOrder]], limit: pagination.limit, offset: pagination.offset });
  apiResponse.paginated(res, 'Books retrieved', rows, buildPaginationResult(count, pagination));
});

export { createBook, updateBook, deleteBook, getBook, listBooks };
