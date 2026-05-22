'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.changeColumn('book_qr', 'qr_status', {
      type: Sequelize.ENUM('active', 'inactive', 'damaged', 'lost', 'borrowed', 'maintenance'),
      allowNull: false,
      defaultValue: 'active'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.changeColumn('book_qr', 'qr_status', {
      type: Sequelize.ENUM('active', 'inactive', 'damaged', 'lost'),
      allowNull: false,
      defaultValue: 'active'
    });
  }
};
