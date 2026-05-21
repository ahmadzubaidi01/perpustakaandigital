import { Model, DataTypes, Optional } from 'sequelize';
import sequelize from '../config/database';
import { SchoolStatus } from '../config/constants';

interface SchoolAttributes {
  school_id: number;
  district_id: number;
  regency_id: number;
  school_name: string;
  school_address: string;
  school_status: SchoolStatus;
  created_at?: Date;
  updated_at?: Date;
  deleted_at?: Date | null;
}

interface SchoolCreationAttributes extends Optional<SchoolAttributes, 'school_id' | 'school_status' | 'deleted_at'> {}

class School extends Model<SchoolAttributes, SchoolCreationAttributes> implements SchoolAttributes {
  public school_id!: number;
  public district_id!: number;
  public regency_id!: number;
  public school_name!: string;
  public school_address!: string;
  public school_status!: SchoolStatus;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;
  public deleted_at!: Date | null;

  public static associate(models: any): void {
    School.belongsTo(models.District, {
      foreignKey: 'district_id',
      as: 'district',
    });
    School.belongsTo(models.Regency, {
      foreignKey: 'regency_id',
      as: 'regency',
    });
    School.hasMany(models.User, {
      foreignKey: 'school_id',
      as: 'users',
    });
    School.hasMany(models.Book, {
      foreignKey: 'school_id',
      as: 'books',
    });
    School.hasOne(models.BorrowingSetting, {
      foreignKey: 'school_id',
      as: 'borrowing_setting',
    });
  }
}

School.init(
  {
    school_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
      field: 'school_id',
    },
    district_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: {
        model: 'districts',
        key: 'district_id',
      },
    },
    regency_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: {
        model: 'regencies',
        key: 'regency_id',
      },
    },
    school_name: {
      type: DataTypes.STRING(255),
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [1, 255],
      },
    },
    school_address: {
      type: DataTypes.TEXT,
      allowNull: false,
      validate: {
        notEmpty: true,
      },
    },
    school_status: {
      type: DataTypes.ENUM(...Object.values(SchoolStatus)),
      allowNull: false,
      defaultValue: SchoolStatus.ACTIVE,
    },
    deleted_at: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: null,
    },
  },
  {
    sequelize,
    tableName: 'schools',
    timestamps: true,
    underscored: true,
    paranoid: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    deletedAt: 'deleted_at',
    indexes: [
      { fields: ['district_id'] },
      { fields: ['regency_id'] },
      { fields: ['school_status'] },
    ],
    defaultScope: {
      where: { deleted_at: null },
    },
    scopes: {
      withDeleted: { where: {} },
    },
  }
);

export default School;
export { SchoolAttributes, SchoolCreationAttributes };
