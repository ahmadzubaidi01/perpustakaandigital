import { Model, DataTypes, Optional } from 'sequelize';
import sequelize from '../config/database';

interface PasswordResetAttributes {
  reset_id: number;
  email_address: string;
  reset_token_hash: string;
  expired_at: Date;
  created_at?: Date;
  updated_at?: Date;
}

interface PasswordResetCreationAttributes extends Optional<PasswordResetAttributes, 'reset_id'> {}

class PasswordReset extends Model<PasswordResetAttributes, PasswordResetCreationAttributes> implements PasswordResetAttributes {
  public reset_id!: number;
  public email_address!: string;
  public reset_token_hash!: string;
  public expired_at!: Date;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;
}

PasswordReset.init(
  {
    reset_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
      field: 'reset_id',
    },
    email_address: {
      type: DataTypes.STRING(255),
      allowNull: false,
      validate: {
        isEmail: true,
      },
    },
    reset_token_hash: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    expired_at: {
      type: DataTypes.DATE,
      allowNull: false,
    },
  },
  {
    sequelize,
    tableName: 'password_resets',
    timestamps: true,
    underscored: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      { fields: ['email_address'] },
      { fields: ['reset_token_hash'] },
      { fields: ['expired_at'] },
    ],
  }
);

export default PasswordReset;
export { PasswordResetAttributes, PasswordResetCreationAttributes };
