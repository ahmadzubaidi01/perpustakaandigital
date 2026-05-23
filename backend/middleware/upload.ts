import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
import { Request } from 'express';
import env from '../config/environment';
import { AppError } from './errorHandler';

/**
 * File upload middleware with security validation.
 * - MIME type validation
 * - File size validation
 * - Secure randomized filenames
 * - Prevents direct executable access
 */

const storage = multer.diskStorage({
  destination: (_req: Request, _file: Express.Multer.File, cb: (error: Error | null, destination: string) => void) => {
    const uploadDir = path.resolve(__dirname, '..', env.UPLOAD_DIR);
    cb(null, uploadDir);
  },
  filename: (_req: Request, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) => {
    // Secure randomized filename
    const randomName = crypto.randomBytes(16).toString('hex');
    const timestamp = Date.now();
    const ext = path.extname(file.originalname).toLowerCase();

    // Prevent executable extensions
    const dangerousExtensions = ['.exe', '.bat', '.cmd', '.sh', '.ps1', '.msi', '.com', '.vbs', '.js', '.php', '.py', '.rb'];
    if (dangerousExtensions.includes(ext)) {
      cb(new AppError('File type not allowed', 400), '');
      return;
    }

    cb(null, `${timestamp}-${randomName}${ext}`);
  },
});

const fileFilter = (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // MIME type validation
  const allowedMimeTypes = env.UPLOAD_ALLOWED_IMAGE_TYPES;

  if (!allowedMimeTypes.includes(file.mimetype)) {
    cb(new AppError(`Invalid file type. Allowed types: ${allowedMimeTypes.join(', ')}`, 400));
    return;
  }

  // Additional check: verify extension matches MIME type
  const ext = path.extname(file.originalname).toLowerCase();
  const mimeToExt: Record<string, string[]> = {
    'image/jpeg': ['.jpg', '.jpeg'],
    'image/png': ['.png'],
    'image/webp': ['.webp'],
  };

  const allowedExts = mimeToExt[file.mimetype] || [];
  if (!allowedExts.includes(ext)) {
    cb(new AppError('File extension does not match its MIME type', 400));
    return;
  }

  cb(null, true);
};

/**
 * Upload middleware for single image files.
 */
const uploadSingle = (fieldName: string) => {
  return multer({
    storage,
    fileFilter,
    limits: {
      fileSize: 2 * 1024 * 1024, // 2MB Limit
      files: 1,
    },
  }).single(fieldName);
};

/**
 * Upload middleware for multiple image files.
 */
const uploadMultiple = (fieldName: string, maxCount: number = 5) => {
  return multer({
    storage,
    fileFilter,
    limits: {
      fileSize: 2 * 1024 * 1024, // 2MB Limit
      files: maxCount,
    },
  }).array(fieldName, maxCount);
};

/**
 * Upload middleware for specific fields.
 */
const uploadFields = (fields: multer.Field[]) => {
  return multer({
    storage,
    fileFilter,
    limits: {
      fileSize: 2 * 1024 * 1024, // 2MB Limit
    },
  }).fields(fields);
};

export {
  uploadSingle,
  uploadMultiple,
  uploadFields,
};
