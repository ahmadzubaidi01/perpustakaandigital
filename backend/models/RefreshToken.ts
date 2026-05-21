import { Model, DataTypes, Optional } from 'sequelize';
import sequelize from '../config/database';

interface RefreshTokenAttributes {
  refresh_token_id: number;
  user_id: number;
  token_hash: string;
  device_name: string | null;
  device_type: string | null;
  ip_address: string | null;
  issued_at: Date;
  expired_at: Date;
  revoked_at: Date | null;
  created_at?: Date;
  updated_at?: Date;
}

interface RefreshTokenCreationAttributes extends Optional<RefreshTokenAttributes,
  'refresh_token_id' | 'device_name' | 'device_type' | 'ip_address' | 'revoked_at'
> {}

class RefreshToken extends Model<RefreshTokenAttributes, RefreshTokenCreationAttributes> implements RefreshTokenAttributes {
  public refresh_token_id!: number;
  public user_id!: number;
  public token_hash!: string;
  public device_name!: string | null;
  public device_type!: string | null;
  public ip_address!: string | null;
  public issued_at!: Date;
  public expired_at!: Date;
  public revoked_at!: Date | null;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;

  public static associate(models: any): void {
    RefreshToken.belongsTo(models.User, {
      foreignKey: 'user_id',
      as: 'user',
    });
  }

  /**
   * Check if token is still valid.
   */
  public isValid(): boolean {
    if (this.revoked_at) return false;
    if (new Date() > this.expired_at) return false;
    return true;
  }
}

RefreshToken.init(
  {
    refresh_token_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
      field: 'refresh_token_id',
    },
    user_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: {
        model: 'users',
        key: 'user_id',
      },
    },
    token_hash: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    device_name: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    device_type: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    ip_address: {
      type: DataTypes.STRING(45),
      allowNull: true,
    },
    issued_at: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    expired_at: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    revoked_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'refresh_tokens',
    timestamps: true,
    underscored: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      { fields: ['user_id'] },
      { fields: ['token_hash'] },
      { fields: ['expired_at'] },
    ],
  }
);

export default RefreshToken;
export { RefreshTokenAttributes, RefreshTokenCreationAttributes };
