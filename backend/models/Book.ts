import { Model, DataTypes, Optional, Op } from 'sequelize';
import sequelize from '../config/database';
import { BookStatus } from '../config/constants';

interface BookAttributes {
  book_id: number;
  book_code: string;
  book_title: string;
  book_slug: string;
  book_description: string | null;
  author_name: string;
  publisher_name: string | null;
  isbn_code: string | null;
  publication_year: number | null;
  category_id: number | null;
  school_id: number;
  rack_location: string | null;
  total_stock: number;
  available_stock: number;
  borrowed_stock: number;
  cover_image_url: string | null;
  book_status: BookStatus;
  created_at?: Date;
  updated_at?: Date;
  deleted_at?: Date | null;
}

interface BookCreationAttributes extends Optional<BookAttributes,
  'book_id' | 'book_description' | 'publisher_name' | 'isbn_code' |
  'publication_year' | 'category_id' | 'rack_location' | 'available_stock' |
  'borrowed_stock' | 'cover_image_url' | 'book_status' | 'deleted_at'
> {}

class Book extends Model<BookAttributes, BookCreationAttributes> implements BookAttributes {
  public book_id!: number;
  public book_code!: string;
  public book_title!: string;
  public book_slug!: string;
  public book_description!: string | null;
  public author_name!: string;
  public publisher_name!: string | null;
  public isbn_code!: string | null;
  public publication_year!: number | null;
  public category_id!: number | null;
  public school_id!: number;
  public rack_location!: string | null;
  public total_stock!: number;
  public available_stock!: number;
  public borrowed_stock!: number;
  public cover_image_url!: string | null;
  public book_status!: BookStatus;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;
  public deleted_at!: Date | null;

  public static associate(models: any): void {
    Book.belongsTo(models.BookCategory, {
      foreignKey: 'category_id',
      as: 'category',
    });
    Book.belongsTo(models.School, {
      foreignKey: 'school_id',
      as: 'school',
    });
    Book.hasMany(models.BookQr, {
      foreignKey: 'book_id',
      as: 'qr_codes',
    });
    Book.hasMany(models.BookReview, {
      foreignKey: 'book_id',
      as: 'reviews',
    });
    Book.hasMany(models.FavoriteBook, {
      foreignKey: 'book_id',
      as: 'favorites',
    });
  }
}

Book.init(
  {
    book_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
      field: 'book_id',
    },
    book_code: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
    },
    book_title: {
      type: DataTypes.STRING(500),
      allowNull: false,
      validate: {
        notEmpty: true,
      },
    },
    book_slug: {
      type: DataTypes.STRING(550),
      allowNull: false,
      unique: true,
    },
    book_description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    author_name: {
      type: DataTypes.STRING(255),
      allowNull: false,
      validate: {
        notEmpty: true,
      },
    },
    publisher_name: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    isbn_code: {
      type: DataTypes.STRING(20),
      allowNull: true,
      unique: true,
    },
    publication_year: {
      type: DataTypes.INTEGER,
      allowNull: true,
      validate: {
        min: 1, // Supports historical book publication dates
        max: 9999,
      },
    },
    category_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      references: {
        model: 'book_categories',
        key: 'category_id',
      },
    },
    school_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: {
        model: 'schools',
        key: 'school_id',
      },
    },
    rack_location: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    total_stock: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: 0,
      },
    },
    available_stock: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: 0,
      },
    },
    borrowed_stock: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: 0,
      },
    },
    cover_image_url: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    book_status: {
      type: DataTypes.ENUM(...Object.values(BookStatus)),
      allowNull: false,
      defaultValue: BookStatus.AVAILABLE,
    },
    deleted_at: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: null,
    },
  },
  {
    sequelize,
    tableName: 'books',
    timestamps: true,
    underscored: true,
    paranoid: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    deletedAt: 'deleted_at',
    indexes: [
      { unique: true, fields: ['book_code'] },
      { unique: true, fields: ['book_slug'] },
      { unique: true, fields: ['isbn_code'], where: { isbn_code: { [Op.ne]: null } } },
      { fields: ['school_id'] },
      { fields: ['category_id'] },
      { fields: ['book_status'] },
      { fields: ['created_at'] },
    ],
    defaultScope: {
      where: { deleted_at: null },
    },
    scopes: {
      withDeleted: { where: {} },
    },
    validate: {
      stockConsistency() {
        const self = this as any;
        if (self.available_stock + self.borrowed_stock > self.total_stock) {
          throw new Error('available_stock + borrowed_stock MUST NEVER exceed total_stock');
        }
      },
    },
  }
);

export default Book;
export { BookAttributes, BookCreationAttributes };
