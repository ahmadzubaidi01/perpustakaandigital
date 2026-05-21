import { Model, DataTypes, Optional } from 'sequelize';
import sequelize from '../config/database';

interface RegencyAttributes {
  regency_id: number;
  regency_name: string;
  created_at?: Date;
  updated_at?: Date;
}

interface RegencyCreationAttributes extends Optional<RegencyAttributes, 'regency_id'> {}

class Regency extends Model<RegencyAttributes, RegencyCreationAttributes> implements RegencyAttributes {
  public regency_id!: number;
  public regency_name!: string;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;

  // Associations
  public static associate(models: any): void {
    Regency.hasMany(models.District, {
      foreignKey: 'regency_id',
      as: 'districts',
    });
    Regency.hasMany(models.School, {
      foreignKey: 'regency_id',
      as: 'schools',
    });
    Regency.hasMany(models.User, {
      foreignKey: 'regency_id',
      as: 'users',
    });
  }
}

Regency.init(
  {
    regency_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
      field: 'regency_id',
    },
    regency_name: {
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
    tableName: 'regencies',
    timestamps: true,
    underscored: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  }
);

export default Regency;
export { RegencyAttributes, RegencyCreationAttributes };
