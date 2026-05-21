import { Model, DataTypes, Optional, Op } from 'sequelize';
import sequelize from '../config/database';
import { UserRole, AccountStatus } from '../config/constants';

interface UserAttributes {
  user_id: number;
  student_id_number: string | null;
  full_name: string;
  email_address: string;
  password_hash: string;
  phone_number: string | null;
  profile_photo_url: string | null;
  class_name: string | null;
  member_qr_uuid: string | null;
  user_role: UserRole;
  account_status: AccountStatus;
  last_login_at: Date | null;
  created_at?: Date;
  updated_at?: Date;
  deleted_at?: Date | null;
  school_id: number | null;
  district_id: number | null;
  regency_id: number | null;
}

interface UserCreationAttributes extends Optional<UserAttributes,
  'user_id' | 'student_id_number' | 'phone_number' | 'profile_photo_url' |
  'class_name' | 'member_qr_uuid' | 'account_status' | 'last_login_at' |
  'deleted_at' | 'school_id' | 'district_id' | 'regency_id'
> {}

class User extends Model<UserAttributes, UserCreationAttributes> implements UserAttributes {
  public user_id!: number;
  public student_id_number!: string | null;
  public full_name!: string;
  public email_address!: string;
  public password_hash!: string;
  public phone_number!: string | null;
  public profile_photo_url!: string | null;
  public class_name!: string | null;
  public member_qr_uuid!: string | null;
  public user_role!: UserRole;
  public account_status!: AccountStatus;
  public last_login_at!: Date | null;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;
  public deleted_at!: Date | null;
  public school_id!: number | null;
  public district_id!: number | null;
  public regency_id!: number | null;

  public static associate(models: any): void {
    User.belongsTo(models.School, {
      foreignKey: 'school_id',
      as: 'school',
    });
    User.belongsTo(models.District, {
      foreignKey: 'district_id',
      as: 'district',
    });
    User.belongsTo(models.Regency, {
      foreignKey: 'regency_id',
      as: 'regency',
    });
    User.hasMany(models.Borrowing, {
      foreignKey: 'user_id',
      as: 'borrowings',
    });
    User.hasMany(models.Borrowing, {
      foreignKey: 'approved_by_user_id',
      as: 'approved_borrowings',
    });
    User.hasMany(models.BookReview, {
      foreignKey: 'user_id',
      as: 'reviews',
    });
    User.hasMany(models.FavoriteBook, {
      foreignKey: 'user_id',
      as: 'favorites',
    });
    User.hasMany(models.Notification, {
      foreignKey: 'user_id',
      as: 'notifications',
    });
    User.hasMany(models.RefreshToken, {
      foreignKey: 'user_id',
      as: 'refresh_tokens',
    });
    User.hasMany(models.UserSession, {
      foreignKey: 'user_id',
      as: 'sessions',
    });
    User.hasMany(models.AuditLog, {
      foreignKey: 'performed_by_user_id',
      as: 'audit_logs',
    });
    User.hasMany(models.QrScanLog, {
      foreignKey: 'scanned_by_user_id',
      as: 'scan_logs',
    });
  }

  /**
   * Exclude password_hash from JSON serialization by default.
   */
  public toJSON(): object {
    const values = { ...this.get() } as any;
    delete values.password_hash;
    return values;
  }
}

User.init(
  {
    user_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
      field: 'user_id',
    },
    student_id_number: {
      type: DataTypes.STRING(50),
      allowNull: true,
      unique: true,
    },
    full_name: {
      type: DataTypes.STRING(255),
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [1, 255],
      },
    },
    email_address: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true,
        notEmpty: true,
      },
    },
    password_hash: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    phone_number: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    profile_photo_url: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    class_name: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    member_qr_uuid: {
      type: DataTypes.UUID,
      allowNull: true,
      unique: true,
    },
    user_role: {
      type: DataTypes.ENUM(...Object.values(UserRole)),
      allowNull: false,
    },
    account_status: {
      type: DataTypes.ENUM(...Object.values(AccountStatus)),
      allowNull: false,
      defaultValue: AccountStatus.ACTIVE,
    },
    last_login_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    school_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      references: {
        model: 'schools',
        key: 'school_id',
      },
    },
    district_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      references: {
        model: 'districts',
        key: 'district_id',
      },
    },
    regency_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      references: {
        model: 'regencies',
        key: 'regency_id',
      },
    },
    deleted_at: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: null,
    },
  },
  {
    sequelize,
    tableName: 'users',
    timestamps: true,
    underscored: true,
    paranoid: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    deletedAt: 'deleted_at',
    indexes: [
      { unique: true, fields: ['email_address'] },
      { unique: true, fields: ['student_id_number'], where: { student_id_number: { [Op.ne]: null } } },
      { unique: true, fields: ['member_qr_uuid'], where: { member_qr_uuid: { [Op.ne]: null } } },
      { fields: ['school_id'] },
      { fields: ['district_id'] },
      { fields: ['regency_id'] },
      { fields: ['user_role'] },
      { fields: ['account_status'] },
    ],
    defaultScope: {
      where: { deleted_at: null },
      attributes: { exclude: ['password_hash'] },
    },
    scopes: {
      withPassword: {
        attributes: { include: ['password_hash'] },
      },
      withDeleted: {
        where: {},
      },
    },
  }
);

export default User;
export { UserAttributes, UserCreationAttributes };
