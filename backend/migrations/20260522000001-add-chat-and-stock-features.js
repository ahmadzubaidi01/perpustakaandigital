'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // 1. chat_conversations
    await queryInterface.createTable('chat_conversations', {
      conversation_id: {
        type: Sequelize.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      participant_1_id: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        references: { model: 'users', key: 'user_id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      participant_2_id: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        references: { model: 'users', key: 'user_id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      last_message_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'),
      },
    });
    await queryInterface.addIndex('chat_conversations', ['participant_1_id']);
    await queryInterface.addIndex('chat_conversations', ['participant_2_id']);
    await queryInterface.addIndex('chat_conversations', ['participant_1_id', 'participant_2_id'], {
      unique: true,
      name: 'idx_unique_conversation_pair',
    });
    await queryInterface.addIndex('chat_conversations', ['last_message_at']);

    // 2. chat_messages
    await queryInterface.createTable('chat_messages', {
      message_id: {
        type: Sequelize.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      conversation_id: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        references: { model: 'chat_conversations', key: 'conversation_id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      sender_id: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        references: { model: 'users', key: 'user_id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      message_text: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      is_read: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });
    await queryInterface.addIndex('chat_messages', ['conversation_id']);
    await queryInterface.addIndex('chat_messages', ['sender_id']);
    await queryInterface.addIndex('chat_messages', ['is_read']);
    await queryInterface.addIndex('chat_messages', ['created_at']);

    // 3. Add notes column to book_qr (for inventory audit notes)
    await queryInterface.addColumn('book_qr', 'notes', {
      type: Sequelize.TEXT,
      allowNull: true,
      after: 'qr_status',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('book_qr', 'notes');
    await queryInterface.dropTable('chat_messages');
    await queryInterface.dropTable('chat_conversations');
  },
};
