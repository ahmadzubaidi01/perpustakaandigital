import { Model, DataTypes, Optional } from 'sequelize';
import sequelize from '../config/database';

interface FavoriteBookAttributes {
  favorite_id: number;
  user_id: number;
  book_id: number;
  created_at?: Date;
  updated_at?: Date;
  deleted_at?: Date | null;
}

interface FavoriteBookCreationAttributes extends Optional<FavoriteBookAttributes, 'favorite_id' | 'deleted_at'> {}

class FavoriteBook extends Model<FavoriteBookAttributes, FavoriteBookCreationAttributes> implements FavoriteBookAttributes {
  public favorite_id!: number;
  public user_id!: number;
  public book_id!: number;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;
  public deleted_at!: Date | null;

  public static associate(models: any): void {
    FavoriteBook.belongsTo(models.User, {
      foreignKey: 'user_id',
      as: 'user',
    });
    FavoriteBook.belongsTo(models.Book, {
      foreignKey: 'book_id',
      as: 'book',
    });
  }
}

FavoriteBook.init(
  {
    favorite_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
      field: 'favorite_id',
    },
    user_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: {
        model: 'users',
        key: 'user_id',
      },
    },
    book_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: {
        model: 'books',
        key: 'book_id',
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
    tableName: 'favorite_books',
    timestamps: true,
    underscored: true,
    paranoid: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    deletedAt: 'deleted_at',
    indexes: [
      { fields: ['user_id'] },
      { fields: ['book_id'] },
      { unique: true, fields: ['user_id', 'book_id'], name: 'idx_unique_user_book_favorite' },
    ],
    defaultScope: {
      where: { deleted_at: null },
    },
    scopes: {
      withDeleted: { where: {} },
    },
  }
);

export default FavoriteBook;
export { FavoriteBookAttributes, FavoriteBookCreationAttributes };
