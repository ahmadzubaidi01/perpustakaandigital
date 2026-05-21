import { Model, DataTypes, Optional } from 'sequelize';
import sequelize from '../config/database';

/**
 * AuditLog — IMMUTABLE, non-editable audit trail.
 * No update or delete operations permitted.
 * Only has created_at (no updated_at or deleted_at).
 * Cascade deletion MUST NOT remove audit logs.
 */

interface AuditLogAttributes {
  log_id: number;
  action_type: string;
  table_name: string;
  affected_record_id: string; // Flexible primary key reference format (string to support various PK types)
  old_value: object | null;
  new_value: object | null;
  performed_by_user_id: number | null;
  device_name: string | null;
  device_type: string | null;
  device_os: string | null;
  browser_name: string | null;
  browser_version: string | null;
  ip_address: string | null;
  created_at?: Date;
}

interface AuditLogCreationAttributes extends Optional<AuditLogAttributes,
  'log_id' | 'old_value' | 'new_value' | 'performed_by_user_id' |
  'device_name' | 'device_type' | 'device_os' | 'browser_name' |
  'browser_version' | 'ip_address'
> {}

class AuditLog extends Model<AuditLogAttributes, AuditLogCreationAttributes> implements AuditLogAttributes {
  public log_id!: number;
  public action_type!: string;
  public table_name!: string;
  public affected_record_id!: string;
  public old_value!: object | null;
  public new_value!: object | null;
  public performed_by_user_id!: number | null;
  public device_name!: string | null;
  public device_type!: string | null;
  public device_os!: string | null;
  public browser_name!: string | null;
  public browser_version!: string | null;
  public ip_address!: string | null;
  public readonly created_at!: Date;

  public static associate(models: any): void {
    AuditLog.belongsTo(models.User, {
      foreignKey: 'performed_by_user_id',
      as: 'performed_by',
      // No CASCADE — audit logs must never be deleted via cascade
      onDelete: 'SET NULL',
    });
  }
}

AuditLog.init(
  {
    log_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
      field: 'log_id',
    },
    action_type: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    table_name: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    affected_record_id: {
      type: DataTypes.STRING(100), // Flexible to support various PK formats
      allowNull: false,
    },
    old_value: {
      type: DataTypes.JSON, // Structured JSON storage
      allowNull: true,
    },
    new_value: {
      type: DataTypes.JSON, // Structured JSON storage
      allowNull: true,
    },
    performed_by_user_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      references: {
        model: 'users',
        key: 'user_id',
      },
    },
    device_name: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    device_type: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    device_os: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    browser_name: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    browser_version: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    ip_address: {
      type: DataTypes.STRING(45),
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'audit_logs',
    timestamps: true,
    underscored: true,
    createdAt: 'created_at',
    updatedAt: false, // Immutable — no updated_at
    indexes: [
      { fields: ['performed_by_user_id'] },
      { fields: ['action_type'] },
      { fields: ['table_name'] },
      { fields: ['affected_record_id'] },
      { fields: ['created_at'] },
      { fields: ['table_name', 'affected_record_id'], name: 'idx_audit_table_record' },
    ],
  }
);

export default AuditLog;
export { AuditLogAttributes, AuditLogCreationAttributes };
