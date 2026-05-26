'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Indexes for incremental synchronization using updated_at
    await queryInterface.addIndex('books', ['updated_at'], { name: 'idx_books_updated_at' });
    await queryInterface.addIndex('users', ['updated_at'], { name: 'idx_users_updated_at' });
    await queryInterface.addIndex('borrowings', ['updated_at'], { name: 'idx_borrowings_updated_at' });
    await queryInterface.addIndex('notifications', ['updated_at'], { name: 'idx_notifications_updated_at' });
    await queryInterface.addIndex('book_qr', ['updated_at'], { name: 'idx_book_qr_updated_at' });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeIndex('books', 'idx_books_updated_at');
    await queryInterface.removeIndex('users', 'idx_users_updated_at');
    await queryInterface.removeIndex('borrowings', 'idx_borrowings_updated_at');
    await queryInterface.removeIndex('notifications', 'idx_notifications_updated_at');
    await queryInterface.removeIndex('book_qr', 'idx_book_qr_updated_at');
  }
};
