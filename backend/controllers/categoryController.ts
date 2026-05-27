import { Request, Response } from 'express';
import { Op } from 'sequelize';
import { BookCategory } from '../models';
import { AuditActionType, TABLE_NAMES } from '../config/constants';
import apiResponse from '../utils/apiResponse';
import { asyncHandler } from '../middleware/errorHandler';
import { createAuditLog, buildAuditFromRequest } from '../services/auditService';
import { generateUniqueSlug } from '../utils/helpers';

const listCategories = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const categories = await BookCategory.findAll({ order: [['category_name', 'ASC']] });
  apiResponse.success(res, 'Categories retrieved', categories);
});

const getCategory = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const category = await BookCategory.findByPk(req.params.category_id as string);
  if (!category) { apiResponse.notFound(res, 'Category not found'); return; }
  apiResponse.success(res, 'Category retrieved', category);
});

const createCategory = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { category_name } = req.body;
  if (!category_name || !category_name.trim()) {
    apiResponse.badRequest(res, 'Nama kategori tidak boleh kosong.');
    return;
  }

  // Check if category with same name already exists (active or soft-deleted)
  const existingCategory = await BookCategory.findOne({
    where: { category_name: category_name.trim() },
    paranoid: false,
  });

  if (existingCategory) {
    if (existingCategory.deleted_at !== null) {
      // Restore the soft-deleted category
      existingCategory.deleted_at = null;
      await existingCategory.save();
      await createAuditLog(buildAuditFromRequest(req, AuditActionType.RESTORE, TABLE_NAMES.BOOK_CATEGORIES, existingCategory.category_id));
      apiResponse.created(res, 'Kategori berhasil dipulihkan dari data terhapus', existingCategory);
      return;
    } else {
      apiResponse.badRequest(res, 'Kategori dengan nama tersebut sudah ada.');
      return;
    }
  }

  const category_slug = generateUniqueSlug(category_name);
  const category = await BookCategory.create({ category_name: category_name.trim(), category_slug });
  await createAuditLog(buildAuditFromRequest(req, AuditActionType.CREATE, TABLE_NAMES.BOOK_CATEGORIES, category.category_id));
  apiResponse.created(res, 'Category created', category);
});

const updateCategory = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const category = await BookCategory.findByPk(req.params.category_id as string);
  if (!category) { apiResponse.notFound(res, 'Category not found'); return; }
  const { category_name } = req.body;
  const updates: any = {};
  if (category_name) { updates.category_name = category_name; updates.category_slug = generateUniqueSlug(category_name); }
  await category.update(updates);
  await createAuditLog(buildAuditFromRequest(req, AuditActionType.UPDATE, TABLE_NAMES.BOOK_CATEGORIES, category.category_id));
  apiResponse.success(res, 'Category updated', category);
});

const deleteCategory = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const category = await BookCategory.findByPk(req.params.category_id as string);
  if (!category) { apiResponse.notFound(res, 'Category not found'); return; }
  await category.destroy();
  await createAuditLog(buildAuditFromRequest(req, AuditActionType.SOFT_DELETE, TABLE_NAMES.BOOK_CATEGORIES, category.category_id));
  apiResponse.success(res, 'Category deleted');
});

export { listCategories, getCategory, createCategory, updateCategory, deleteCategory };
