import { Model, DataTypes, Optional } from 'sequelize';
import sequelize from '../config/database';

interface ChatMessageAttributes {
  message_id: number;
  conversation_id: number;
  sender_id: number;
  message_text: string;
  is_read: boolean;
  created_at?: Date;
}

interface ChatMessageCreationAttributes extends Optional<ChatMessageAttributes,
  'message_id' | 'is_read'
> {}

class ChatMessage extends Model<ChatMessageAttributes, ChatMessageCreationAttributes> implements ChatMessageAttributes {
  public message_id!: number;
  public conversation_id!: number;
  public sender_id!: number;
  public message_text!: string;
  public is_read!: boolean;
  public readonly created_at!: Date;

  public static associate(models: any): void {
    ChatMessage.belongsTo(models.ChatConversation, {
      foreignKey: 'conversation_id',
      as: 'conversation',
    });
    ChatMessage.belongsTo(models.User, {
      foreignKey: 'sender_id',
      as: 'sender',
    });
  }
}

ChatMessage.init(
  {
    message_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
      field: 'message_id',
    },
    conversation_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: {
        model: 'chat_conversations',
        key: 'conversation_id',
      },
    },
    sender_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: {
        model: 'users',
        key: 'user_id',
      },
    },
    message_text: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    is_read: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
  },
  {
    sequelize,
    tableName: 'chat_messages',
    timestamps: true,
    underscored: true,
    createdAt: 'created_at',
    updatedAt: false, // Messages are immutable — no updated_at
    indexes: [
      { fields: ['conversation_id'] },
      { fields: ['sender_id'] },
      { fields: ['is_read'] },
      { fields: ['created_at'] },
    ],
  }
);

export default ChatMessage;
export { ChatMessageAttributes, ChatMessageCreationAttributes };
