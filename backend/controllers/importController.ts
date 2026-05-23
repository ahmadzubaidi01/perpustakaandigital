import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import ExcelJS from 'exceljs';
import stream from 'stream';
import path from 'path';
import { Op } from 'sequelize';
import { User, School } from '../models';
import { UserRole, AccountStatus, AuditActionType, TABLE_NAMES } from '../config/constants';
import apiResponse from '../utils/apiResponse';
import { asyncHandler } from '../middleware/errorHandler';
import { createAuditLog, buildAuditFromRequest } from '../services/auditService';
import { generateUUID, validatePasswordComplexity } from '../utils/helpers';
import { generateMemberQr } from '../services/qrService';
import env from '../config/environment';

const downloadImportTemplate = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Template Import Pengguna');

  worksheet.columns = [
    { header: 'Nama Lengkap (Wajib)', key: 'full_name', width: 25 },
    { header: 'Email (Wajib)', key: 'email_address', width: 25 },
    { header: 'NISN (Wajib untuk Password)', key: 'student_id_number', width: 20 },
    { header: 'Kelas (Opsional)', key: 'class_name', width: 12 },
    { header: 'No Telepon (Opsional)', key: 'phone_number', width: 15 },
    { header: 'Role (Opsional - default: student_member)', key: 'user_role', width: 25 },
    { header: 'ID Sekolah (Opsional - default: sekolah admin)', key: 'school_id', width: 15 }
  ];

  // Add sample row with helpful sample data
  worksheet.addRow({
    full_name: 'Ahmad Zubaidi',
    email_address: 'ahmad@example.com',
    student_id_number: '1234567890',
    class_name: '12-A',
    phone_number: '081234567890',
    user_role: 'student_member',
    school_id: req.user?.school_id || ''
  });

  const format = req.query.format === 'xlsx' ? 'xlsx' : 'csv';

  if (format === 'xlsx') {
    // Style the header row for Excel
    const headerRow = worksheet.getRow(1);
    headerRow.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: '1E3A8A' } // Sleek navy blue header
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
    headerRow.height = 25;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=template_import_pengguna.xlsx');
    await workbook.xlsx.write(res);
  } else {
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=template_import_pengguna.csv');
    await workbook.csv.write(res);
  }
});

const importUsers = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  if (!req.file) {
    apiResponse.badRequest(res, 'File tidak boleh kosong');
    return;
  }

  const workbook = new ExcelJS.Workbook();
  const fileExtension = path.extname(req.file.originalname).toLowerCase();

  try {
    if (fileExtension === '.xls') {
      apiResponse.badRequest(res, 'Format .xls (Excel lama) tidak didukung. Silakan simpan kembali file Anda sebagai .xlsx (Excel baru) atau .csv sebelum mengimpor.');
      return;
    }

    if (fileExtension === '.csv') {
      const bufferStream = new stream.PassThrough();
      bufferStream.end(req.file.buffer);
      await workbook.csv.read(bufferStream);
    } else {
      await workbook.xlsx.load(req.file.buffer as any);
    }
  } catch (err: any) {
    apiResponse.badRequest(res, 'Gagal membaca file. Pastikan format Excel (.xlsx) atau CSV Anda valid.');
    return;
  }

  const worksheet = workbook.getWorksheet(1);
  if (!worksheet) {
    apiResponse.badRequest(res, 'File kosong atau sheet tidak ditemukan');
    return;
  }

  const admin = req.user!;
  const adminRole = admin.user_role as UserRole;
  const defaultSchoolId = admin.school_id;

  const successUsers: any[] = [];
  const errors: { row: number; error: string }[] = [];

  const rows: any[] = [];
  worksheet.eachRow((row, index) => {
    if (index === 1) return; // Skip headers
    
    // ExcelJS cell values can be objects or primitive values. Ensure we get string representation.
    const getCellValue = (colNum: number) => {
      const cell = row.getCell(colNum);
      if (cell.value && typeof cell.value === 'object') {
        if ('text' in cell.value) return String(cell.value.text);
        if ('result' in cell.value) return String(cell.value.result);
      }
      return cell.value !== undefined && cell.value !== null ? String(cell.value) : '';
    };

    rows.push({
      rowNumber: index,
      full_name: getCellValue(1).trim(),
      email_address: getCellValue(2).trim(),
      student_id_number: getCellValue(3).trim(),
      class_name: getCellValue(4).trim(),
      phone_number: getCellValue(5).trim(),
      user_role: getCellValue(6).trim(),
      rawSchoolId: getCellValue(7).trim()
    });
  });

  for (const rowData of rows) {
    const { rowNumber, full_name, email_address, student_id_number, class_name, phone_number, user_role, rawSchoolId } = rowData;

    if (!full_name) {
      errors.push({ row: rowNumber, error: 'Nama Lengkap wajib diisi' });
      continue;
    }
    if (!email_address) {
      errors.push({ row: rowNumber, error: 'Email wajib diisi' });
      continue;
    }
    if (!student_id_number) {
      errors.push({ row: rowNumber, error: 'NISN wajib diisi karena digunakan untuk password default' });
      continue;
    }

    const password = `${student_id_number}Pw@`;

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email_address)) {
      errors.push({ row: rowNumber, error: `Email "${email_address}" tidak valid` });
      continue;
    }

    // Password complexity check
    const pwCheck = validatePasswordComplexity(password);
    if (!pwCheck.valid) {
      errors.push({ row: rowNumber, error: `Password lemah: ${pwCheck.errors.join(', ')}` });
      continue;
    }

    // Role check
    let resolvedRole = UserRole.STUDENT_MEMBER;
    if (user_role) {
      const validRoles = [
        UserRole.SUPER_ADMIN,
        UserRole.REGENCY_ADMIN,
        UserRole.DISTRICT_ADMIN,
        UserRole.SCHOOL_ADMIN,
        UserRole.STUDENT_MEMBER
      ];
      if (!validRoles.includes(user_role as UserRole)) {
        errors.push({ row: rowNumber, error: `Role "${user_role}" tidak valid` });
        continue;
      }
      resolvedRole = user_role as UserRole;
    }

    // School check and scoping
    let resolvedSchoolId: number | null = null;
    const bodySchoolId = req.body.school_id ? parseInt(req.body.school_id, 10) : null;

    if (bodySchoolId && !isNaN(bodySchoolId)) {
      resolvedSchoolId = bodySchoolId;
    } else if (rawSchoolId) {
      resolvedSchoolId = parseInt(rawSchoolId, 10);
      if (isNaN(resolvedSchoolId)) {
        errors.push({ row: rowNumber, error: `ID Sekolah "${rawSchoolId}" harus berupa angka` });
        continue;
      }
    } else {
      resolvedSchoolId = defaultSchoolId;
    }

    // School admin regional scope validation
    if (adminRole === UserRole.SCHOOL_ADMIN && resolvedSchoolId !== defaultSchoolId) {
      errors.push({ row: rowNumber, error: 'Sebagai Admin Sekolah, Anda hanya diperbolehkan mengimport pengguna ke sekolah Anda sendiri' });
      continue;
    }

    // Regency / District admin scope checks
    if (adminRole === UserRole.REGENCY_ADMIN && resolvedSchoolId) {
      const school = await School.findByPk(resolvedSchoolId);
      if (!school || school.regency_id !== admin.regency_id) {
        errors.push({ row: rowNumber, error: 'Sekolah yang ditentukan berada di luar cakupan kabupaten Anda' });
        continue;
      }
    }
    if (adminRole === UserRole.DISTRICT_ADMIN && resolvedSchoolId) {
      const school = await School.findByPk(resolvedSchoolId);
      if (!school || school.district_id !== admin.district_id) {
        errors.push({ row: rowNumber, error: 'Sekolah yang ditentukan berada di luar cakupan kecamatan Anda' });
        continue;
      }
    }

    // Check uniqueness (existing email or NISN)
    const existing = await User.scope('withDeleted').findOne({
      where: {
        [Op.or]: [
          { email_address },
          ...(student_id_number ? [{ student_id_number }] : [])
        ]
      }
    });
    if (existing) {
      errors.push({ row: rowNumber, error: 'Email atau NISN sudah terdaftar' });
      continue;
    }

    try {
      const password_hash = await bcrypt.hash(password, env.BCRYPT_SALT_ROUNDS);
      const member_qr_uuid = generateUUID();

      // Find appropriate school to inherit regional values
      let userRegencyId = admin.regency_id;
      let userDistrictId = admin.district_id;
      if (resolvedSchoolId) {
        const schoolObj = await School.findByPk(resolvedSchoolId);
        if (schoolObj) {
          userRegencyId = schoolObj.regency_id;
          userDistrictId = schoolObj.district_id;
        }
      }

      const createdUser = await User.create({
        full_name,
        email_address,
        password_hash,
        phone_number: phone_number || null,
        student_id_number: student_id_number || null,
        class_name: class_name || null,
        member_qr_uuid,
        user_role: resolvedRole,
        account_status: AccountStatus.ACTIVE,
        school_id: resolvedSchoolId,
        district_id: userDistrictId,
        regency_id: userRegencyId
      });

      if (resolvedRole === UserRole.STUDENT_MEMBER) {
        await generateMemberQr(member_qr_uuid, createdUser.user_id, full_name);
      }

      await createAuditLog(buildAuditFromRequest(req, AuditActionType.CREATE, TABLE_NAMES.USERS, createdUser.user_id, null, {
        full_name,
        email_address,
        user_role: createdUser.user_role
      }));

      successUsers.push({
        user_id: createdUser.user_id,
        full_name: createdUser.full_name,
        email_address: createdUser.email_address
      });
    } catch (createErr: any) {
      errors.push({ row: rowNumber, error: `Kesalahan database: ${createErr.message}` });
    }
  }

  apiResponse.success(res, 'Proses import selesai', {
    success_count: successUsers.length,
    error_count: errors.length,
    errors
  });
});

export { downloadImportTemplate, importUsers };
