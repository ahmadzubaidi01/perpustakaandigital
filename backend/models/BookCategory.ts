import { Model, DataTypes, Optional } from 'sequelize';
import sequelize from '../config/database';

interface BookCategoryAttributes {
  category_id: number;
  category_name: string;
  category_slug: string;
  created_at?: Date;
  updated_at?: Date;
  deleted_at?: Date | null;
}

interface BookCategoryCreationAttributes extends Optional<BookCategoryAttributes, 'category_id' | 'deleted_at'> {}

class BookCategory extends Model<BookCategoryAttributes, BookCategoryCreationAttributes> implements BookCategoryAttributes {
  public category_id!: number;
  public category_name!: string;
  public category_slug!: string;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;
  public deleted_at!: Date | null;

  public static associate(models: any): void {
    BookCategory.hasMany(models.Book, {
      foreignKey: 'category_id',
      as: 'books',
    });
  }
}

BookCategory.init(
  {
    category_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
      field: 'category_id',
    },
    category_name: {
      type: DataTypes.STRING(255),
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [1, 255],
      },
    },
    category_slug: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
      validate: {
        notEmpty: true,
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
    tableName: 'book_categories',
    timestamps: true,
    underscored: true,
    paranoid: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    deletedAt: 'deleted_at',
    indexes: [
      { unique: true, fields: ['category_slug'] },
    ],
    defaultScope: {
      where: { deleted_at: null },
    },
    scopes: {
      withDeleted: { where: {} },
    },
  }
);

export default BookCategory;
export { BookCategoryAttributes, BookCategoryCreationAttributes };
