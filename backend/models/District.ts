import { Model, DataTypes, Optional } from 'sequelize';
import sequelize from '../config/database';

interface DistrictAttributes {
  district_id: number;
  regency_id: number;
  district_name: string;
  created_at?: Date;
  updated_at?: Date;
}

interface DistrictCreationAttributes extends Optional<DistrictAttributes, 'district_id'> {}

class District extends Model<DistrictAttributes, DistrictCreationAttributes> implements DistrictAttributes {
  public district_id!: number;
  public regency_id!: number;
  public district_name!: string;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;

  public static associate(models: any): void {
    District.belongsTo(models.Regency, {
      foreignKey: 'regency_id',
      as: 'regency',
    });
    District.hasMany(models.School, {
      foreignKey: 'district_id',
      as: 'schools',
    });
    District.hasMany(models.User, {
      foreignKey: 'district_id',
      as: 'users',
    });
  }
}

District.init(
  {
    district_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
      field: 'district_id',
    },
    regency_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: {
        model: 'regencies',
        key: 'regency_id',
      },
    },
    district_name: {
      type: DataTypes.STRING(255),
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [1, 255],
      },
    },
  },
  {
    sequelize,
    tableName: 'districts',
    timestamps: true,
    underscored: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      { fields: ['regency_id'] },
    ],
  }
);

export default District;
export { DistrictAttributes, DistrictCreationAttributes };
