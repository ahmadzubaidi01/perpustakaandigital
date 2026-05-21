import { Model, DataTypes, Optional } from 'sequelize';
import sequelize from '../config/database';
import { QrStatus } from '../config/constants';

interface BookQrAttributes {
  book_qr_id: number;
  book_id: number;
  qr_uuid: string;
  qr_serial_number: string;
  qr_image_url: string | null;
  qr_status: QrStatus;
  notes: string | null;
  last_scanned_at: Date | null;
  last_scanned_latitude: number | null;
  last_scanned_longitude: number | null;
  last_scanned_by_user_id: number | null;
  created_at?: Date;
  updated_at?: Date;
}

interface BookQrCreationAttributes extends Optional<BookQrAttributes,
  'book_qr_id' | 'qr_image_url' | 'qr_status' | 'notes' | 'last_scanned_at' |
  'last_scanned_latitude' | 'last_scanned_longitude' | 'last_scanned_by_user_id'
> {}

class BookQr extends Model<BookQrAttributes, BookQrCreationAttributes> implements BookQrAttributes {
  public book_qr_id!: number;
  public book_id!: number;
  public qr_uuid!: string;
  public qr_serial_number!: string;
  public qr_image_url!: string | null;
  public qr_status!: QrStatus;
  public notes!: string | null;
  public last_scanned_at!: Date | null;
  public last_scanned_latitude!: number | null;
  public last_scanned_longitude!: number | null;
  public last_scanned_by_user_id!: number | null;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;

  public static associate(models: any): void {
    BookQr.belongsTo(models.Book, {
      foreignKey: 'book_id',
      as: 'book',
    });
    BookQr.belongsTo(models.User, {
      foreignKey: 'last_scanned_by_user_id',
      as: 'last_scanned_by',
    });
    BookQr.hasMany(models.Borrowing, {
      foreignKey: 'book_qr_id',
      as: 'borrowings',
    });
    BookQr.hasMany(models.QrScanLog, {
      foreignKey: 'book_qr_id',
      as: 'scan_logs',
    });
  }
}

BookQr.init(
  {
    book_qr_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
      field: 'book_qr_id',
    },
    book_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: {
        model: 'books',
        key: 'book_id',
      },
    },
    qr_uuid: {
      type: DataTypes.UUID,
      allowNull: false,
      unique: true,
      defaultValue: DataTypes.UUIDV4,
    },
    qr_serial_number: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
      // qr_serial_number is immutable after creation
    },
    qr_image_url: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    qr_status: {
      type: DataTypes.ENUM(...Object.values(QrStatus)),
      allowNull: false,
      defaultValue: QrStatus.ACTIVE,
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    last_scanned_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    last_scanned_latitude: {
      type: DataTypes.DECIMAL(10, 8),
      allowNull: true,
    },
    last_scanned_longitude: {
      type: DataTypes.DECIMAL(11, 8),
      allowNull: true,
    },
    last_scanned_by_user_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      references: {
        model: 'users',
        key: 'user_id',
      },
    },
  },
  {
    sequelize,
    tableName: 'book_qr',
    timestamps: true,
    underscored: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      { unique: true, fields: ['qr_uuid'] },
      { unique: true, fields: ['qr_serial_number'] },
      { fields: ['book_id'] },
      { fields: ['qr_status'] },
      { fields: ['last_scanned_by_user_id'] },
    ],
  }
);

export default BookQr;
export { BookQrAttributes, BookQrCreationAttributes };
