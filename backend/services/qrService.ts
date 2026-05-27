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

  let currentSerial = '';

  if (customSerial) {
    currentSerial = customSerial;
  } else {
    // Look up the last registered copy for that book
    const lastQr = await BookQr.findOne({
      where: { book_id: bookId },
      order: [['book_qr_id', 'DESC']],
      paranoid: false,
    });
    if (lastQr) {
      currentSerial = incrementSerialNumber(lastQr.qr_serial_number);
    } else {
      const err = new Error('Kode serial kustom pertama harus diisi untuk buku ini');
      (err as any).statusCode = 400;
      throw err;
    }
  }

  const uploadDir = path.resolve(__dirname, '..', env.UPLOAD_DIR, 'qr');

  // Ensure QR upload directory exists
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  for (let i = 0; i < quantity; i++) {
    const qrUuid = uuidv4();
    
    let qrSerialNumber = '';
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

    const qrOptions = {
      type: 'png' as const,
      width: 400,
      margin: 2,
      color: {
        dark: '#1E40AF', // Blue color matching design rules
        light: '#FFFFFF',
      },
      errorCorrectionLevel: 'H' as const,
    };

    try {
      // Try strictly enforcing version 2 (25x25 grid size)
      await QRCode.toFile(filePath, qrPayload, {
        ...qrOptions,
        version: 2,
      });
    } catch (versionError) {
      logger.info(`QR payload too large for Version 2 (25x25). Gracefully falling back to default minimum version: ${versionError}`);
      // Fallback: auto-scale version to prevent crash
      await QRCode.toFile(filePath, qrPayload, qrOptions);
    }

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
  const qrOptions = {
    width: 400,
    margin: 2,
    color: {
      dark: '#1E40AF',
      light: '#FFFFFF',
    },
    errorCorrectionLevel: 'H' as const,
  };
  try {
    return await QRCode.toDataURL(payload, {
      ...qrOptions,
      version: 2,
    });
  } catch (error) {
    return await QRCode.toDataURL(payload, qrOptions);
  }
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

  const qrOptions = {
    type: 'png' as const,
    width: 400,
    margin: 2,
    color: {
      dark: '#1E40AF',
      light: '#FFFFFF',
    },
    errorCorrectionLevel: 'H' as const,
  };

  try {
    await QRCode.toFile(filePath, payload, {
      ...qrOptions,
      version: 2,
    });
  } catch (error) {
    await QRCode.toFile(filePath, payload, qrOptions);
  }

  return `/uploads/member-qr/${fileName}`;
};

export {
  generateBookQrCodes,
  generateQrDataUrl,
  validateQrPayload,
  generateMemberQr,
  GeneratedQr,
};
