'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Indexes to optimize list sorting, filtering, and role scoping
    try {
      await queryInterface.addIndex('books', ['created_at'], { name: 'idx_books_created_at' });
    } catch (err) {
      console.warn('Index idx_books_created_at already exists or could not be added:', err.message);
    }
    
    try {
      await queryInterface.addIndex('users', ['user_role'], { name: 'idx_users_user_role' });
    } catch (err) {
      console.warn('Index idx_users_user_role already exists or could not be added:', err.message);
    }
    
    try {
      await queryInterface.addIndex('users', ['created_at'], { name: 'idx_users_created_at' });
    } catch (err) {
      console.warn('Index idx_users_created_at already exists or could not be added:', err.message);
    }
    
    try {
      await queryInterface.addIndex('borrowings', ['borrowing_status'], { name: 'idx_borrowings_borrowing_status' });
    } catch (err) {
      console.warn('Index idx_borrowings_borrowing_status already exists or could not be added:', err.message);
    }
    
    try {
      await queryInterface.addIndex('borrowings', ['created_at'], { name: 'idx_borrowings_created_at' });
    } catch (err) {
      console.warn('Index idx_borrowings_created_at already exists or could not be added:', err.message);
    }
    
    try {
      await queryInterface.addIndex('notifications', ['created_at'], { name: 'idx_notifications_created_at' });
    } catch (err) {
      console.warn('Index idx_notifications_created_at already exists or could not be added:', err.message);
    }
    
    try {
      await queryInterface.addIndex('book_qr', ['qr_status'], { name: 'idx_book_qr_qr_status' });
    } catch (err) {
      console.warn('Index idx_book_qr_qr_status already exists or could not be added:', err.message);
    }
  },

  async down(queryInterface, Sequelize) {
    try {
      await queryInterface.removeIndex('books', 'idx_books_created_at');
    } catch (err) {
      console.warn('Index idx_books_created_at could not be removed:', err.message);
    }
    
    try {
      await queryInterface.removeIndex('users', 'idx_users_user_role');
    } catch (err) {
      console.warn('Index idx_users_user_role could not be removed:', err.message);
    }
    
    try {
      await queryInterface.removeIndex('users', 'idx_users_created_at');
    } catch (err) {
      console.warn('Index idx_users_created_at could not be removed:', err.message);
    }
    
    try {
      await queryInterface.removeIndex('borrowings', 'idx_borrowings_borrowing_status');
    } catch (err) {
      console.warn('Index idx_borrowings_borrowing_status could not be removed:', err.message);
    }
    
    try {
      await queryInterface.removeIndex('borrowings', 'idx_borrowings_created_at');
    } catch (err) {
      console.warn('Index idx_borrowings_created_at could not be removed:', err.message);
    }
    
    try {
      await queryInterface.removeIndex('notifications', 'idx_notifications_created_at');
    } catch (err) {
      console.warn('Index idx_notifications_created_at could not be removed:', err.message);
    }
    
    try {
      await queryInterface.removeIndex('book_qr', 'idx_book_qr_qr_status');
    } catch (err) {
      console.warn('Index idx_book_qr_qr_status could not be removed:', err.message);
    }
  }
};
