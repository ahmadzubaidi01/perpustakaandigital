import { Model, DataTypes, Optional } from 'sequelize';
import sequelize from '../config/database';

interface ChatConversationAttributes {
  conversation_id: number;
  participant_1_id: number;
  participant_2_id: number;
  last_message_at: Date | null;
  created_at?: Date;
  updated_at?: Date;
}

interface ChatConversationCreationAttributes extends Optional<ChatConversationAttributes,
  'conversation_id' | 'last_message_at'
> {}

class ChatConversation extends Model<ChatConversationAttributes, ChatConversationCreationAttributes> implements ChatConversationAttributes {
  public conversation_id!: number;
  public participant_1_id!: number;
  public participant_2_id!: number;
  public last_message_at!: Date | null;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;

  public static associate(models: any): void {
    ChatConversation.belongsTo(models.User, {
      foreignKey: 'participant_1_id',
      as: 'participant_1',
    });
    ChatConversation.belongsTo(models.User, {
      foreignKey: 'participant_2_id',
      as: 'participant_2',
    });
    ChatConversation.hasMany(models.ChatMessage, {
      foreignKey: 'conversation_id',
      as: 'messages',
    });
  }
}

ChatConversation.init(
  {
    conversation_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
      field: 'conversation_id',
    },
    participant_1_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: {
        model: 'users',
        key: 'user_id',
      },
    },
    participant_2_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: {
        model: 'users',
        key: 'user_id',
      },
    },
    last_message_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'chat_conversations',
    timestamps: true,
    underscored: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      { fields: ['participant_1_id'] },
      { fields: ['participant_2_id'] },
      { unique: true, fields: ['participant_1_id', 'participant_2_id'], name: 'idx_unique_conversation_pair' },
      { fields: ['last_message_at'] },
    ],
  }
);

export default ChatConversation;
export { ChatConversationAttributes, ChatConversationCreationAttributes };
