import { Model, DataTypes, Optional } from 'sequelize';
import sequelize from '../config/database';
import { NotificationType } from '../config/constants';

interface NotificationAttributes {
  notification_id: number;
  user_id: number;
  notification_title: string;
  notification_message: string;
  notification_type: NotificationType;
  is_read: boolean;
  reference_id?: string | null;
  sent_at: Date | null;
  created_at?: Date;
  updated_at?: Date;
  deleted_at?: Date | null;
}

interface NotificationCreationAttributes extends Optional<NotificationAttributes,
  'notification_id' | 'is_read' | 'reference_id' | 'sent_at' | 'deleted_at'
> {}

class Notification extends Model<NotificationAttributes, NotificationCreationAttributes> implements NotificationAttributes {
  public notification_id!: number;
  public user_id!: number;
  public notification_title!: string;
  public notification_message!: string;
  public notification_type!: NotificationType;
  public is_read!: boolean;
  public reference_id!: string | null;
  public sent_at!: Date | null;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;
  public deleted_at!: Date | null;

  public static associate(models: any): void {
    Notification.belongsTo(models.User, {
      foreignKey: 'user_id',
      as: 'user',
    });
  }
}

Notification.init(
  {
    notification_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
      field: 'notification_id',
    },
    user_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: {
        model: 'users',
        key: 'user_id',
      },
    },
    notification_title: {
      type: DataTypes.STRING(255),
      allowNull: false,
      validate: { notEmpty: true },
    },
    notification_message: {
      type: DataTypes.TEXT,
      allowNull: false,
      validate: { notEmpty: true },
    },
    notification_type: {
      type: DataTypes.ENUM(...Object.values(NotificationType)),
      allowNull: false,
    },
    is_read: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false, // is_read MUST default to false
    },
    reference_id: {
      type: DataTypes.STRING(255),
      allowNull: true,
      defaultValue: null,
    },
    sent_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    deleted_at: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: null,
    },
  },
  {
    sequelize,
    tableName: 'notifications',
    timestamps: true,
    underscored: true,
    paranoid: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    deletedAt: 'deleted_at',
    indexes: [
      { fields: ['user_id'] },
      { fields: ['notification_type'] },
      { fields: ['is_read'] },
      { fields: ['created_at'] },
    ],
    defaultScope: {
      where: { deleted_at: null },
    },
    scopes: {
      withDeleted: { where: {} },
    },
  }
);

export default Notification;
export { NotificationAttributes, NotificationCreationAttributes };
