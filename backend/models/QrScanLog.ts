import { Model, DataTypes, Optional } from 'sequelize';
import sequelize from '../config/database';
import { ScanType } from '../config/constants';

/**
 * QrScanLog — immutable historical scan records.
 * QR scan logs MUST preserve immutable historical records.
 */

interface QrScanLogAttributes {
  scan_log_id: number;
  book_qr_id: number;
  scanned_by_user_id: number;
  scan_type: ScanType;
  latitude: number | null;
  longitude: number | null;
  device_name: string | null;
  device_type: string | null;
  device_os: string | null;
  browser_name: string | null;
  browser_version: string | null;
  scanned_at: Date;
  created_at?: Date;
  updated_at?: Date;
}

interface QrScanLogCreationAttributes extends Optional<QrScanLogAttributes,
  'scan_log_id' | 'latitude' | 'longitude' | 'device_name' | 'device_type' |
  'device_os' | 'browser_name' | 'browser_version'
> {}

class QrScanLog extends Model<QrScanLogAttributes, QrScanLogCreationAttributes> implements QrScanLogAttributes {
  public scan_log_id!: number;
  public book_qr_id!: number;
  public scanned_by_user_id!: number;
  public scan_type!: ScanType;
  public latitude!: number | null;
  public longitude!: number | null;
  public device_name!: string | null;
  public device_type!: string | null;
  public device_os!: string | null;
  public browser_name!: string | null;
  public browser_version!: string | null;
  public scanned_at!: Date;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;

  public static associate(models: any): void {
    QrScanLog.belongsTo(models.BookQr, {
      foreignKey: 'book_qr_id',
      as: 'book_qr',
    });
    QrScanLog.belongsTo(models.User, {
      foreignKey: 'scanned_by_user_id',
      as: 'scanned_by',
    });
  }
}

QrScanLog.init(
  {
    scan_log_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
      field: 'scan_log_id',
    },
    book_qr_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: {
        model: 'book_qr',
        key: 'book_qr_id',
      },
    },
    scanned_by_user_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: {
        model: 'users',
        key: 'user_id',
      },
    },
    scan_type: {
      type: DataTypes.ENUM(...Object.values(ScanType)),
      allowNull: false,
    },
    latitude: {
      type: DataTypes.DECIMAL(10, 8),
      allowNull: true,
    },
    longitude: {
      type: DataTypes.DECIMAL(11, 8),
      allowNull: true,
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
    scanned_at: {
      type: DataTypes.DATE,
      allowNull: false,
    },
  },
  {
    sequelize,
    tableName: 'qr_scan_logs',
    timestamps: true,
    underscored: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      { fields: ['book_qr_id'] },
      { fields: ['scanned_by_user_id'] },
      { fields: ['scan_type'] },
      { fields: ['scanned_at'] },
      { fields: ['created_at'] },
    ],
  }
);

export default QrScanLog;
export { QrScanLogAttributes, QrScanLogCreationAttributes };
