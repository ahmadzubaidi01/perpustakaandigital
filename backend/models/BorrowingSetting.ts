import { Model, DataTypes, Optional } from 'sequelize';
import sequelize from '../config/database';

interface BorrowingSettingAttributes {
  setting_id: number;
  school_id: number;
  max_borrow_days: number;
  max_books_per_student: number;
  penalty_rate_per_day: number;
  allow_extensions: boolean;
  max_extensions: number;
  created_at?: Date;
  updated_at?: Date;
}

interface BorrowingSettingCreationAttributes extends Optional<BorrowingSettingAttributes,
  'setting_id' | 'max_borrow_days' | 'max_books_per_student' | 'penalty_rate_per_day' |
  'allow_extensions' | 'max_extensions'
> {}

class BorrowingSetting extends Model<BorrowingSettingAttributes, BorrowingSettingCreationAttributes> implements BorrowingSettingAttributes {
  public setting_id!: number;
  public school_id!: number;
  public max_borrow_days!: number;
  public max_books_per_student!: number;
  public penalty_rate_per_day!: number;
  public allow_extensions!: boolean;
  public max_extensions!: number;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;

  public static associate(models: any): void {
    BorrowingSetting.belongsTo(models.School, {
      foreignKey: 'school_id',
      as: 'school',
    });
  }
}

BorrowingSetting.init(
  {
    setting_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
      field: 'setting_id',
    },
    school_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      unique: true,
      references: {
        model: 'schools',
        key: 'school_id',
      },
    },
    max_borrow_days: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 14,
      validate: { min: 1 },
    },
    max_books_per_student: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 3,
      validate: { min: 1 },
    },
    penalty_rate_per_day: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 1000.00,
      validate: { min: 0 },
    },
    allow_extensions: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    max_extensions: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 1,
      validate: { min: 0 },
    },
  },
  {
    sequelize,
    tableName: 'borrowing_settings',
    timestamps: true,
    underscored: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      { unique: true, fields: ['school_id'] },
    ],
  }
);

export default BorrowingSetting;
export { BorrowingSettingAttributes, BorrowingSettingCreationAttributes };
