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
 * Helper to auto-increment a serial number pattern (e.g. Box-10-005 -> Box-10-006).
 */
export const incrementSerialNumber = (serial: string): string => {
  const match = serial.match(/^(.*?)(\d+)$/);
  if (!match) return `${serial}-1`;
  const prefix = match[1];
  const numStr = match[2];
  const nextNum = parseInt(numStr, 10) + 1;
  const nextNumStr = String(nextNum).padStart(numStr.length, '0');
  return `${prefix}${nextNumStr}`;
};

/**
 * Generate QR codes for a book's physical copies.
 * Each physical copy gets a UNIQUE QR — no merging of QR identities.
 */
const generateBookQrCodes = async (
  bookId: number,
  schoolId: number,
  quantity: number,
  customSerial?: string
): Promise<GeneratedQr[]> => {
  const results: GeneratedQr[] = [];

  // Determine if we should generate custom serials
  let currentSerial = '';
  let isCustom = false;

  if (customSerial) {
    currentSerial = customSerial;
    isCustom = true;
  } else {
    // If no custom serial is provided, check if the last generated copy of the book has a custom pattern
    const lastQr = await BookQr.findOne({
      where: { book_id: bookId },
      order: [['book_qr_id', 'DESC']],
      paranoid: false,
    });
    // Standard format matches /^QR-\d{4}-\d{6}-\d{3}-[A-Z0-9]+$/i. If it does not match, it is a custom pattern!
    if (lastQr && !/^QR-\d{4}-\d{6}-\d{3}-[A-Z0-9]+$/i.test(lastQr.qr_serial_number)) {
      currentSerial = incrementSerialNumber(lastQr.qr_serial_number);
      isCustom = true;
    }
  }

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
    
    let qrSerialNumber = '';
    if (isCustom) {
      if (i === 0) {
        qrSerialNumber = currentSerial;
      } else {
        currentSerial = incrementSerialNumber(currentSerial);
        qrSerialNumber = currentSerial;
      }

      // Verify that this generated custom serial doesn't already exist in the system
      const existing = await BookQr.findOne({ where: { qr_serial_number: qrSerialNumber }, paranoid: false });
      if (existing) {
        const err = new Error(`Nomor seri QR '${qrSerialNumber}' sudah terdaftar di sistem`);
        (err as any).statusCode = 400;
        throw err;
      }
    } else {
      qrSerialNumber = generateQrSerialNumber(schoolId, bookId, copyIndex);
    }

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
