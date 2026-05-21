'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // 1. regencies
    await queryInterface.createTable('regencies', {
      regency_id: { type: Sequelize.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
      regency_name: { type: Sequelize.STRING(255), allowNull: false },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP') },
    });

    // 2. districts
    await queryInterface.createTable('districts', {
      district_id: { type: Sequelize.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
      regency_id: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, references: { model: 'regencies', key: 'regency_id' }, onUpdate: 'CASCADE', onDelete: 'RESTRICT' },
      district_name: { type: Sequelize.STRING(255), allowNull: false },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP') },
    });
    await queryInterface.addIndex('districts', ['regency_id']);

    // 3. schools
    await queryInterface.createTable('schools', {
      school_id: { type: Sequelize.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
      district_id: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, references: { model: 'districts', key: 'district_id' }, onUpdate: 'CASCADE', onDelete: 'RESTRICT' },
      regency_id: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, references: { model: 'regencies', key: 'regency_id' }, onUpdate: 'CASCADE', onDelete: 'RESTRICT' },
      school_name: { type: Sequelize.STRING(255), allowNull: false },
      school_address: { type: Sequelize.TEXT, allowNull: false },
      school_status: { type: Sequelize.ENUM('active', 'inactive', 'suspended'), allowNull: false, defaultValue: 'active' },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP') },
      deleted_at: { type: Sequelize.DATE, allowNull: true },
    });
    await queryInterface.addIndex('schools', ['district_id']);
    await queryInterface.addIndex('schools', ['regency_id']);

    // 4. book_categories
    await queryInterface.createTable('book_categories', {
      category_id: { type: Sequelize.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
      category_name: { type: Sequelize.STRING(255), allowNull: false },
      category_slug: { type: Sequelize.STRING(255), allowNull: false, unique: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP') },
      deleted_at: { type: Sequelize.DATE, allowNull: true },
    });
    await queryInterface.addIndex('book_categories', ['category_slug'], { unique: true, name: 'idx_unique_category_slug' });

    // 5. users
    await queryInterface.createTable('users', {
      user_id: { type: Sequelize.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
      student_id_number: { type: Sequelize.STRING(50), allowNull: true, unique: true },
      full_name: { type: Sequelize.STRING(255), allowNull: false },
      email_address: { type: Sequelize.STRING(255), allowNull: false, unique: true },
      password_hash: { type: Sequelize.STRING(255), allowNull: false },
      phone_number: { type: Sequelize.STRING(20), allowNull: true },
      profile_photo_url: { type: Sequelize.STRING(500), allowNull: true },
      class_name: { type: Sequelize.STRING(100), allowNull: true },
      member_qr_uuid: { type: Sequelize.UUID, allowNull: true, unique: true },
      user_role: { type: Sequelize.ENUM('super_admin', 'regency_admin', 'district_admin', 'school_admin', 'student_member'), allowNull: false },
      account_status: { type: Sequelize.ENUM('active', 'inactive', 'suspended'), allowNull: false, defaultValue: 'active' },
      last_login_at: { type: Sequelize.DATE, allowNull: true },
      school_id: { type: Sequelize.INTEGER.UNSIGNED, allowNull: true, references: { model: 'schools', key: 'school_id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL' },
      district_id: { type: Sequelize.INTEGER.UNSIGNED, allowNull: true, references: { model: 'districts', key: 'district_id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL' },
      regency_id: { type: Sequelize.INTEGER.UNSIGNED, allowNull: true, references: { model: 'regencies', key: 'regency_id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL' },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP') },
      deleted_at: { type: Sequelize.DATE, allowNull: true },
    });
    await queryInterface.addIndex('users', ['email_address'], { unique: true, name: 'idx_unique_email' });
    await queryInterface.addIndex('users', ['school_id']);
    await queryInterface.addIndex('users', ['district_id']);
    await queryInterface.addIndex('users', ['regency_id']);
    await queryInterface.addIndex('users', ['user_role']);
    await queryInterface.addIndex('users', ['account_status']);

    // 6. books
    await queryInterface.createTable('books', {
      book_id: { type: Sequelize.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
      book_code: { type: Sequelize.STRING(50), allowNull: false, unique: true },
      book_title: { type: Sequelize.STRING(500), allowNull: false },
      book_slug: { type: Sequelize.STRING(550), allowNull: false, unique: true },
      book_description: { type: Sequelize.TEXT, allowNull: true },
      author_name: { type: Sequelize.STRING(255), allowNull: false },
      publisher_name: { type: Sequelize.STRING(255), allowNull: true },
      isbn_code: { type: Sequelize.STRING(20), allowNull: true },
      publication_year: { type: Sequelize.INTEGER, allowNull: true },
      category_id: { type: Sequelize.INTEGER.UNSIGNED, allowNull: true, references: { model: 'book_categories', key: 'category_id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL' },
      school_id: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, references: { model: 'schools', key: 'school_id' }, onUpdate: 'CASCADE', onDelete: 'RESTRICT' },
      rack_location: { type: Sequelize.STRING(100), allowNull: true },
      total_stock: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
      available_stock: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
      borrowed_stock: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
      cover_image_url: { type: Sequelize.STRING(500), allowNull: true },
      book_status: { type: Sequelize.ENUM('available', 'borrowed', 'reserved', 'damaged', 'lost', 'maintenance'), allowNull: false, defaultValue: 'available' },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP') },
      deleted_at: { type: Sequelize.DATE, allowNull: true },
    });
    await queryInterface.addIndex('books', ['book_code'], { unique: true, name: 'idx_unique_book_code' });
    await queryInterface.addIndex('books', ['book_slug'], { unique: true, name: 'idx_unique_book_slug' });
    await queryInterface.addIndex('books', ['school_id']);
    await queryInterface.addIndex('books', ['category_id']);
    await queryInterface.addIndex('books', ['book_status']);
    await queryInterface.addIndex('books', ['created_at']);

    // 7. book_qr
    await queryInterface.createTable('book_qr', {
      book_qr_id: { type: Sequelize.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
      book_id: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, references: { model: 'books', key: 'book_id' }, onUpdate: 'CASCADE', onDelete: 'RESTRICT' },
      qr_uuid: { type: Sequelize.UUID, allowNull: false, unique: true },
      qr_serial_number: { type: Sequelize.STRING(50), allowNull: false, unique: true },
      qr_image_url: { type: Sequelize.STRING(500), allowNull: true },
      qr_status: { type: Sequelize.ENUM('active', 'inactive', 'damaged', 'lost'), allowNull: false, defaultValue: 'active' },
      last_scanned_at: { type: Sequelize.DATE, allowNull: true },
      last_scanned_latitude: { type: Sequelize.DECIMAL(10, 8), allowNull: true },
      last_scanned_longitude: { type: Sequelize.DECIMAL(11, 8), allowNull: true },
      last_scanned_by_user_id: { type: Sequelize.INTEGER.UNSIGNED, allowNull: true, references: { model: 'users', key: 'user_id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL' },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP') },
    });
    await queryInterface.addIndex('book_qr', ['qr_uuid'], { unique: true, name: 'idx_unique_qr_uuid' });
    await queryInterface.addIndex('book_qr', ['qr_serial_number'], { unique: true, name: 'idx_unique_qr_serial' });
    await queryInterface.addIndex('book_qr', ['book_id']);
    await queryInterface.addIndex('book_qr', ['qr_status']);

    // 8. borrowings
    await queryInterface.createTable('borrowings', {
      borrowing_id: { type: Sequelize.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
      borrowing_code: { type: Sequelize.STRING(50), allowNull: false, unique: true },
      user_id: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, references: { model: 'users', key: 'user_id' }, onUpdate: 'CASCADE', onDelete: 'RESTRICT' },
      book_qr_id: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, references: { model: 'book_qr', key: 'book_qr_id' }, onUpdate: 'CASCADE', onDelete: 'RESTRICT' },
      borrowed_at: { type: Sequelize.DATE, allowNull: true },
      due_date: { type: Sequelize.DATE, allowNull: true },
      returned_at: { type: Sequelize.DATE, allowNull: true },
      late_penalty_amount: { type: Sequelize.DECIMAL(12, 2), allowNull: false, defaultValue: 0.00 },
      penalty_status: { type: Sequelize.ENUM('unpaid', 'paid', 'waived'), allowNull: true },
      borrowing_status: { type: Sequelize.ENUM('pending', 'approved', 'borrowed', 'reserved', 'returned', 'late', 'cancelled'), allowNull: false, defaultValue: 'pending' },
      approved_by_user_id: { type: Sequelize.INTEGER.UNSIGNED, allowNull: true, references: { model: 'users', key: 'user_id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL' },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP') },
    });
    await queryInterface.addIndex('borrowings', ['borrowing_code'], { unique: true, name: 'idx_unique_borrowing_code' });
    await queryInterface.addIndex('borrowings', ['user_id']);
    await queryInterface.addIndex('borrowings', ['book_qr_id']);
    await queryInterface.addIndex('borrowings', ['borrowing_status']);
    await queryInterface.addIndex('borrowings', ['penalty_status']);
    await queryInterface.addIndex('borrowings', ['created_at']);
    await queryInterface.addIndex('borrowings', ['book_qr_id', 'borrowing_status'], { name: 'idx_book_qr_borrowing_status' });
    await queryInterface.addIndex('borrowings', ['user_id', 'borrowing_status'], { name: 'idx_user_borrowing_status' });

    // 9. borrowing_settings
    await queryInterface.createTable('borrowing_settings', {
      setting_id: { type: Sequelize.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
      school_id: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, unique: true, references: { model: 'schools', key: 'school_id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
      max_borrow_days: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, defaultValue: 14 },
      max_books_per_student: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, defaultValue: 3 },
      penalty_rate_per_day: { type: Sequelize.DECIMAL(12, 2), allowNull: false, defaultValue: 1000.00 },
      allow_extensions: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      max_extensions: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, defaultValue: 1 },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP') },
    });

    // 10. book_reviews
    await queryInterface.createTable('book_reviews', {
      review_id: { type: Sequelize.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
      book_id: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, references: { model: 'books', key: 'book_id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
      user_id: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, references: { model: 'users', key: 'user_id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
      rating_score: { type: Sequelize.INTEGER, allowNull: false },
      review_text: { type: Sequelize.TEXT, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP') },
      deleted_at: { type: Sequelize.DATE, allowNull: true },
    });
    await queryInterface.addIndex('book_reviews', ['book_id']);
    await queryInterface.addIndex('book_reviews', ['user_id']);

    // 11. favorite_books
    await queryInterface.createTable('favorite_books', {
      favorite_id: { type: Sequelize.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
      user_id: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, references: { model: 'users', key: 'user_id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
      book_id: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, references: { model: 'books', key: 'book_id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP') },
      deleted_at: { type: Sequelize.DATE, allowNull: true },
    });
    await queryInterface.addIndex('favorite_books', ['user_id', 'book_id'], { unique: true, name: 'idx_unique_user_book_fav' });

    // 12. password_resets
    await queryInterface.createTable('password_resets', {
      reset_id: { type: Sequelize.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
      email_address: { type: Sequelize.STRING(255), allowNull: false },
      reset_token_hash: { type: Sequelize.STRING(255), allowNull: false },
      expired_at: { type: Sequelize.DATE, allowNull: false },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP') },
    });
    await queryInterface.addIndex('password_resets', ['email_address']);
    await queryInterface.addIndex('password_resets', ['reset_token_hash']);

    // 13. refresh_tokens
    await queryInterface.createTable('refresh_tokens', {
      refresh_token_id: { type: Sequelize.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
      user_id: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, references: { model: 'users', key: 'user_id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
      token_hash: { type: Sequelize.STRING(255), allowNull: false },
      device_name: { type: Sequelize.STRING(255), allowNull: true },
      device_type: { type: Sequelize.STRING(100), allowNull: true },
      ip_address: { type: Sequelize.STRING(45), allowNull: true },
      issued_at: { type: Sequelize.DATE, allowNull: false },
      expired_at: { type: Sequelize.DATE, allowNull: false },
      revoked_at: { type: Sequelize.DATE, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP') },
    });
    await queryInterface.addIndex('refresh_tokens', ['user_id']);
    await queryInterface.addIndex('refresh_tokens', ['token_hash']);

    // 14. notifications
    await queryInterface.createTable('notifications', {
      notification_id: { type: Sequelize.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
      user_id: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, references: { model: 'users', key: 'user_id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
      notification_title: { type: Sequelize.STRING(255), allowNull: false },
      notification_message: { type: Sequelize.TEXT, allowNull: false },
      notification_type: { type: Sequelize.ENUM('due_reminder', 'late_warning', 'availability_notice', 'account_verification', 'school_announcement', 'system_alert'), allowNull: false },
      is_read: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      sent_at: { type: Sequelize.DATE, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP') },
      deleted_at: { type: Sequelize.DATE, allowNull: true },
    });
    await queryInterface.addIndex('notifications', ['user_id']);
    await queryInterface.addIndex('notifications', ['notification_type']);
    await queryInterface.addIndex('notifications', ['created_at']);

    // 15. audit_logs (IMMUTABLE — no updated_at, no deleted_at)
    await queryInterface.createTable('audit_logs', {
      log_id: { type: Sequelize.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
      action_type: { type: Sequelize.STRING(50), allowNull: false },
      table_name: { type: Sequelize.STRING(100), allowNull: false },
      affected_record_id: { type: Sequelize.STRING(100), allowNull: false },
      old_value: { type: Sequelize.JSON, allowNull: true },
      new_value: { type: Sequelize.JSON, allowNull: true },
      performed_by_user_id: { type: Sequelize.INTEGER.UNSIGNED, allowNull: true, references: { model: 'users', key: 'user_id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL' },
      device_name: { type: Sequelize.STRING(255), allowNull: true },
      device_type: { type: Sequelize.STRING(100), allowNull: true },
      device_os: { type: Sequelize.STRING(100), allowNull: true },
      browser_name: { type: Sequelize.STRING(100), allowNull: true },
      browser_version: { type: Sequelize.STRING(50), allowNull: true },
      ip_address: { type: Sequelize.STRING(45), allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });
    await queryInterface.addIndex('audit_logs', ['performed_by_user_id']);
    await queryInterface.addIndex('audit_logs', ['action_type']);
    await queryInterface.addIndex('audit_logs', ['table_name']);
    await queryInterface.addIndex('audit_logs', ['created_at']);

    // 16. user_sessions
    await queryInterface.createTable('user_sessions', {
      session_id: { type: Sequelize.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
      user_id: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, references: { model: 'users', key: 'user_id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
      device_name: { type: Sequelize.STRING(255), allowNull: true },
      device_type: { type: Sequelize.STRING(100), allowNull: true },
      device_os: { type: Sequelize.STRING(100), allowNull: true },
      browser_name: { type: Sequelize.STRING(100), allowNull: true },
      browser_version: { type: Sequelize.STRING(50), allowNull: true },
      ip_address: { type: Sequelize.STRING(45), allowNull: true },
      login_at: { type: Sequelize.DATE, allowNull: false },
      expired_at: { type: Sequelize.DATE, allowNull: false },
      session_status: { type: Sequelize.ENUM('active', 'expired', 'revoked', 'terminated'), allowNull: false, defaultValue: 'active' },
      deleted_at: { type: Sequelize.DATE, allowNull: true },
    });
    await queryInterface.addIndex('user_sessions', ['user_id']);
    await queryInterface.addIndex('user_sessions', ['session_status']);

    // 17. qr_scan_logs
    await queryInterface.createTable('qr_scan_logs', {
      scan_log_id: { type: Sequelize.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
      book_qr_id: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, references: { model: 'book_qr', key: 'book_qr_id' }, onUpdate: 'CASCADE', onDelete: 'RESTRICT' },
      scanned_by_user_id: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, references: { model: 'users', key: 'user_id' }, onUpdate: 'CASCADE', onDelete: 'RESTRICT' },
      scan_type: { type: Sequelize.ENUM('borrowing', 'returning', 'verification', 'inventory', 'audit'), allowNull: false },
      latitude: { type: Sequelize.DECIMAL(10, 8), allowNull: true },
      longitude: { type: Sequelize.DECIMAL(11, 8), allowNull: true },
      device_name: { type: Sequelize.STRING(255), allowNull: true },
      device_type: { type: Sequelize.STRING(100), allowNull: true },
      device_os: { type: Sequelize.STRING(100), allowNull: true },
      browser_name: { type: Sequelize.STRING(100), allowNull: true },
      browser_version: { type: Sequelize.STRING(50), allowNull: true },
      scanned_at: { type: Sequelize.DATE, allowNull: false },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP') },
    });
    await queryInterface.addIndex('qr_scan_logs', ['book_qr_id']);
    await queryInterface.addIndex('qr_scan_logs', ['scanned_by_user_id']);
    await queryInterface.addIndex('qr_scan_logs', ['scan_type']);
    await queryInterface.addIndex('qr_scan_logs', ['scanned_at']);
    await queryInterface.addIndex('qr_scan_logs', ['created_at']);
  },

  async down(queryInterface) {
    // Drop in reverse order to respect FK constraints
    await queryInterface.dropTable('qr_scan_logs');
    await queryInterface.dropTable('user_sessions');
    await queryInterface.dropTable('audit_logs');
    await queryInterface.dropTable('notifications');
    await queryInterface.dropTable('refresh_tokens');
    await queryInterface.dropTable('password_resets');
    await queryInterface.dropTable('favorite_books');
    await queryInterface.dropTable('book_reviews');
    await queryInterface.dropTable('borrowing_settings');
    await queryInterface.dropTable('borrowings');
    await queryInterface.dropTable('book_qr');
    await queryInterface.dropTable('books');
    await queryInterface.dropTable('users');
    await queryInterface.dropTable('book_categories');
    await queryInterface.dropTable('schools');
    await queryInterface.dropTable('districts');
    await queryInterface.dropTable('regencies');
  },
};
