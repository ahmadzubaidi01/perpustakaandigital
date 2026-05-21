import { Model, DataTypes, Optional } from 'sequelize';
import sequelize from '../config/database';
import { RATING_CONSTRAINTS } from '../config/constants';

interface BookReviewAttributes {
  review_id: number;
  book_id: number;
  user_id: number;
  rating_score: number;
  review_text: string | null;
  created_at?: Date;
  updated_at?: Date;
  deleted_at?: Date | null;
}

interface BookReviewCreationAttributes extends Optional<BookReviewAttributes,
  'review_id' | 'review_text' | 'deleted_at'
> {}

class BookReview extends Model<BookReviewAttributes, BookReviewCreationAttributes> implements BookReviewAttributes {
  public review_id!: number;
  public book_id!: number;
  public user_id!: number;
  public rating_score!: number;
  public review_text!: string | null;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;
  public deleted_at!: Date | null;

  public static associate(models: any): void {
    BookReview.belongsTo(models.Book, {
      foreignKey: 'book_id',
      as: 'book',
    });
    BookReview.belongsTo(models.User, {
      foreignKey: 'user_id',
      as: 'user',
    });
  }
}

BookReview.init(
  {
    review_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
      field: 'review_id',
    },
    book_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: {
        model: 'books',
        key: 'book_id',
      },
    },
    user_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: {
        model: 'users',
        key: 'user_id',
      },
    },
    rating_score: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        min: RATING_CONSTRAINTS.MIN_SCORE,
        max: RATING_CONSTRAINTS.MAX_SCORE,
        isInt: true,
      },
    },
    review_text: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    deleted_at: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: null,
    },
  },
  {
    sequelize,
    tableName: 'book_reviews',
    timestamps: true,
    underscored: true,
    paranoid: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    deletedAt: 'deleted_at',
    indexes: [
      { fields: ['book_id'] },
      { fields: ['user_id'] },
    ],
    defaultScope: {
      where: { deleted_at: null },
    },
    scopes: {
      withDeleted: { where: {} },
    },
  }
);

export default BookReview;
export { BookReviewAttributes, BookReviewCreationAttributes };
