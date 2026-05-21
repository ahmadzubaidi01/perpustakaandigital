import { Model, DataTypes, Optional } from 'sequelize';
import sequelize from '../config/database';
import { SessionStatus } from '../config/constants';

interface UserSessionAttributes {
  session_id: number;
  user_id: number;
  device_name: string | null;
  device_type: string | null;
  device_os: string | null;
  browser_name: string | null;
  browser_version: string | null;
  ip_address: string | null;
  login_at: Date;
  expired_at: Date;
  session_status: SessionStatus;
  deleted_at: Date | null;
}

interface UserSessionCreationAttributes extends Optional<UserSessionAttributes,
  'session_id' | 'device_name' | 'device_type' | 'device_os' |
  'browser_name' | 'browser_version' | 'ip_address' | 'session_status' | 'deleted_at'
> {}

class UserSession extends Model<UserSessionAttributes, UserSessionCreationAttributes> implements UserSessionAttributes {
  public session_id!: number;
  public user_id!: number;
  public device_name!: string | null;
  public device_type!: string | null;
  public device_os!: string | null;
  public browser_name!: string | null;
  public browser_version!: string | null;
  public ip_address!: string | null;
  public login_at!: Date;
  public expired_at!: Date;
  public session_status!: SessionStatus;
  public deleted_at!: Date | null;

  public static associate(models: any): void {
    UserSession.belongsTo(models.User, {
      foreignKey: 'user_id',
      as: 'user',
    });
  }

  /**
   * Check if session is still active and not expired.
   */
  public isActive(): boolean {
    return this.session_status === SessionStatus.ACTIVE && new Date() < this.expired_at;
  }
}

UserSession.init(
  {
    session_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
      field: 'session_id',
    },
    user_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
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
    login_at: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    expired_at: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    session_status: {
      type: DataTypes.ENUM(...Object.values(SessionStatus)),
      allowNull: false,
      defaultValue: SessionStatus.ACTIVE,
    },
    deleted_at: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: null,
    },
  },
  {
    sequelize,
    tableName: 'user_sessions',
    timestamps: false, // Uses login_at and expired_at instead
    underscored: true,
    indexes: [
      { fields: ['user_id'] },
      { fields: ['session_status'] },
      { fields: ['expired_at'] },
      { fields: ['login_at'] },
    ],
  }
);

export default UserSession;
export { UserSessionAttributes, UserSessionCreationAttributes };
