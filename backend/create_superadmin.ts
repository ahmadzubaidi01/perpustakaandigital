import dotenv from 'dotenv';
dotenv.config();

import sequelize from './config/database';
import { User } from './models';
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { UserRole, AccountStatus } from './config/constants';

async function main() {
  try {
    await sequelize.authenticate();
    console.log('Koneksi database berhasil...');

    const email = 'superadmin@perpustakaandigital.com';
    const password = 'SuperAdmin@2026'; // Silakan ganti password di sini
    
    // Cek apakah email sudah terdaftar
    const existingUser = await User.findOne({ where: { email_address: email } });
    if (existingUser) {
      console.log(`Email ${email} sudah terdaftar. Mengubah rolenya menjadi super_admin...`);
      await existingUser.update({
        user_role: UserRole.SUPER_ADMIN,
        account_status: AccountStatus.ACTIVE
      });
      console.log('Berhasil mengubah role user menjadi Super Admin!');
      return;
    }

    // Melakukan hash password dengan bcrypt
    const passwordHash = await bcrypt.hash(password, 12);

    // Membuat user baru
    const admin = await User.create({
      full_name: 'Super Administrator',
      email_address: email,
      password_hash: passwordHash,
      user_role: UserRole.SUPER_ADMIN,
      account_status: AccountStatus.ACTIVE,
      member_qr_uuid: uuidv4()
    });

    console.log('Super Admin baru berhasil dibuat:', admin.toJSON());
  } catch (error: any) {
    console.error('Terjadi kesalahan:', error.message);
  } finally {
    await sequelize.close();
  }
}

main();
