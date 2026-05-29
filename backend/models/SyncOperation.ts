import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database';

export class SyncOperation extends Model {
  public operation_id!: string;
  public user_id!: number;
  public operation_type!: string;
  public entity_name!: string;
  public processed_at!: Date;
}

SyncOperation.init(
  {
    operation_id: {
      type: DataTypes.UUID,
      primaryKey: true,
      allowNull: false,
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: true, // Allow null for operations by system or unauthenticated (though unlikely)
    },
    operation_type: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    entity_name: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    processed_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    modelName: 'SyncOperation',
    tableName: 'sync_operations',
    timestamps: false,
    indexes: [
      {
        unique: true,
        fields: ['operation_id'],
      },
      {
        fields: ['processed_at'],
      },
    ],
  }
);
