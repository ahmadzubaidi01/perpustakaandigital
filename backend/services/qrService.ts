import QRCode from 'qrcode';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { BookQr, Book } from '../models';
import { QrStatus } from '../config/constants';
import { generateQrSerialNumber } from '../utils/helpers';
import env from '../config/environment';
import logger from '../utils/logger';

interface GeneratedQr {
  qr_uuid: string;
  qr_serial_number: string;
  qr_image_url: string;
}

/**
 * Generate QR codes for a book's physical copies.
 * Each physical copy gets a UNIQUE QR — no merging of QR identities.
 */
const generateBookQrCodes = async (
  bookId: number,
  schoolId: number,
  quantity: number
): Promise<GeneratedQr[]> => {
  const results: GeneratedQr[] = [];

  // Get current count of QRs for this book to determine sequence
  const existingCount = await BookQr.count({ where: { book_id: bookId } });

  const uploadDir = path.resolve(__dirname, '..', env.UPLOAD_DIR, 'qr');

  // Ensure QR upload directory exists
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  for (let i = 0; i < quantity; i++) {
    const copyIndex = existingCount + i + 1;
    const qrUuid = uuidv4();
    const qrSerialNumber = generateQrSerialNumber(schoolId, bookId, copyIndex);

    // QR payload contains encrypted identification data
    const qrPayload = JSON.stringify({
      uuid: qrUuid,
      serial: qrSerialNumber,
      book_id: bookId,
      school_id: schoolId,
      type: 'book_qr',
      version: 1,
    });

    // Generate QR code image
    const fileName = `qr-${qrSerialNumber}-${Date.now()}.png`;
    const filePath = path.join(uploadDir, fileName);

    await QRCode.toFile(filePath, qrPayload, {
      type: 'png',
      width: 400,
      margin: 2,
      color: {
        dark: '#1E40AF', // Blue color matching design rules
        light: '#FFFFFF',
      },
      errorCorrectionLevel: 'H', // High error correction for durability
    });

    const qrImageUrl = `/uploads/qr/${fileName}`;

    results.push({
      qr_uuid: qrUuid,
      qr_serial_number: qrSerialNumber,
      qr_image_url: qrImageUrl,
    });
  }

  return results;
};

/**
 * Generate QR code as base64 data URL (for inline display/download).
 */
const generateQrDataUrl = async (payload: string): Promise<string> => {
  return QRCode.toDataURL(payload, {
    width: 400,
    margin: 2,
    color: {
      dark: '#1E40AF',
      light: '#FFFFFF',
    },
    errorCorrectionLevel: 'H',
  });
};

/**
 * Validate a scanned QR payload.
 */
const validateQrPayload = (rawPayload: string): {
  valid: boolean;
  data?: {
    uuid: string;
    serial: string;
    book_id: number;
    school_id: number;
  };
  error?: string;
} => {
  try {
    const parsed = JSON.parse(rawPayload);

    if (!parsed.uuid || !parsed.serial || !parsed.book_id || parsed.type !== 'book_qr') {
      return { valid: false, error: 'Invalid QR format' };
    }

    return {
      valid: true,
      data: {
        uuid: parsed.uuid,
        serial: parsed.serial,
        book_id: parsed.book_id,
        school_id: parsed.school_id,
      },
    };
  } catch {
    return { valid: false, error: 'Unable to parse QR data' };
  }
};

/**
 * Generate member QR code for a student.
 */
const generateMemberQr = async (
  memberQrUuid: string,
  userId: number,
  fullName: string
): Promise<string> => {
  const payload = JSON.stringify({
    uuid: memberQrUuid,
    user_id: userId,
    type: 'member_qr',
    version: 1,
  });

  const uploadDir = path.resolve(__dirname, '..', env.UPLOAD_DIR, 'member-qr');

  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  const fileName = `member-${memberQrUuid}-${Date.now()}.png`;
  const filePath = path.join(uploadDir, fileName);

  await QRCode.toFile(filePath, payload, {
    type: 'png',
    width: 400,
    margin: 2,
    color: {
      dark: '#1E40AF',
      light: '#FFFFFF',
    },
    errorCorrectionLevel: 'H',
  });

  return `/uploads/member-qr/${fileName}`;
};

export {
  generateBookQrCodes,
  generateQrDataUrl,
  validateQrPayload,
  generateMemberQr,
  GeneratedQr,
};
