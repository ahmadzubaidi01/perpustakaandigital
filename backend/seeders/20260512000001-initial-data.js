'use strict';
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    // 1. Seed master regencies
    await queryInterface.bulkInsert('regencies', [
      { regency_id: 1, regency_name: 'Kabupaten Sidoarjo', created_at: new Date(), updated_at: new Date() },
      { regency_id: 2, regency_name: 'Kota Surabaya', created_at: new Date(), updated_at: new Date() },
    ]);

    // 2. Seed master districts
    await queryInterface.bulkInsert('districts', [
      { district_id: 1, regency_id: 1, district_name: 'Kecamatan Sidoarjo', created_at: new Date(), updated_at: new Date() },
      { district_id: 2, regency_id: 1, district_name: 'Kecamatan Buduran', created_at: new Date(), updated_at: new Date() },
      { district_id: 3, regency_id: 2, district_name: 'Kecamatan Sukolilo', created_at: new Date(), updated_at: new Date() },
    ]);

    // 3. Seed initial school
    await queryInterface.bulkInsert('schools', [
      { school_id: 1, district_id: 1, regency_id: 1, school_name: 'SMA Negeri 1 Sidoarjo', school_address: 'Jl. Jenggolo No.1, Sidoarjo', school_status: 'active', created_at: new Date(), updated_at: new Date() },
    ]);

    // 4. Seed Super Admin account
    const passwordHash = await bcrypt.hash('SuperAdmin@2026', 12);
    await queryInterface.bulkInsert('users', [
      {
        user_id: 1,
        student_id_number: null,
        full_name: 'Super Administrator',
        email_address: 'superadmin@perpustakaandigital.com',
        password_hash: passwordHash,
        phone_number: null,
        profile_photo_url: null,
        class_name: null,
        member_qr_uuid: uuidv4(),
        user_role: 'super_admin',
        account_status: 'active',
        last_login_at: null,
        school_id: null,
        district_id: null,
        regency_id: null,
        created_at: new Date(),
        updated_at: new Date(),
        deleted_at: null,
      },
    ]);

    // 5. Seed default book categories
    await queryInterface.bulkInsert('book_categories', [
      { category_id: 1, category_name: 'Fiction', category_slug: 'fiction', created_at: new Date(), updated_at: new Date() },
      { category_id: 2, category_name: 'Non-Fiction', category_slug: 'non-fiction', created_at: new Date(), updated_at: new Date() },
      { category_id: 3, category_name: 'Science', category_slug: 'science', created_at: new Date(), updated_at: new Date() },
      { category_id: 4, category_name: 'Mathematics', category_slug: 'mathematics', created_at: new Date(), updated_at: new Date() },
      { category_id: 5, category_name: 'History', category_slug: 'history', created_at: new Date(), updated_at: new Date() },
      { category_id: 6, category_name: 'Technology', category_slug: 'technology', created_at: new Date(), updated_at: new Date() },
      { category_id: 7, category_name: 'Literature', category_slug: 'literature', created_at: new Date(), updated_at: new Date() },
      { category_id: 8, category_name: 'Language', category_slug: 'language', created_at: new Date(), updated_at: new Date() },
      { category_id: 9, category_name: 'Arts', category_slug: 'arts', created_at: new Date(), updated_at: new Date() },
      { category_id: 10, category_name: 'Religion', category_slug: 'religion', created_at: new Date(), updated_at: new Date() },
    ]);

    // 6. Seed default borrowing settings for the school
    await queryInterface.bulkInsert('borrowing_settings', [
      { setting_id: 1, school_id: 1, max_borrow_days: 14, max_books_per_student: 3, penalty_rate_per_day: 1000.00, allow_extensions: true, max_extensions: 1, created_at: new Date(), updated_at: new Date() },
    ]);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('borrowing_settings', null, {});
    await queryInterface.bulkDelete('book_categories', null, {});
    await queryInterface.bulkDelete('users', null, {});
    await queryInterface.bulkDelete('schools', null, {});
    await queryInterface.bulkDelete('districts', null, {});
    await queryInterface.bulkDelete('regencies', null, {});
  },
};
