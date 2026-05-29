import sequelize from '../config/database';

// Import all models
import Regency from './Regency';
import District from './District';
import School from './School';
import BookCategory from './BookCategory';
import User from './User';
import Book from './Book';
import BookQr from './BookQr';
import Borrowing from './Borrowing';
import BorrowingSetting from './BorrowingSetting';
import BookReview from './BookReview';
import FavoriteBook from './FavoriteBook';
import PasswordReset from './PasswordReset';
import RefreshToken from './RefreshToken';
import Notification from './Notification';
import AuditLog from './AuditLog';
import UserSession from './UserSession';
import QrScanLog from './QrScanLog';
import ChatConversation from './ChatConversation';
import ChatMessage from './ChatMessage';
import { SyncOperation } from './SyncOperation';

// Collect all models
const models = {
  Regency,
  District,
  School,
  BookCategory,
  User,
  Book,
  BookQr,
  Borrowing,
  BorrowingSetting,
  BookReview,
  FavoriteBook,
  PasswordReset,
  RefreshToken,
  Notification,
  AuditLog,
  UserSession,
  QrScanLog,
  ChatConversation,
  ChatMessage,
  SyncOperation,
};

// Initialize associations
Object.values(models).forEach((model: any) => {
  if (model.associate) {
    model.associate(models);
  }
});

export {
  sequelize,
  Regency,
  District,
  School,
  BookCategory,
  User,
  Book,
  BookQr,
  Borrowing,
  BorrowingSetting,
  BookReview,
  FavoriteBook,
  PasswordReset,
  RefreshToken,
  Notification,
  AuditLog,
  UserSession,
  QrScanLog,
  ChatConversation,
  ChatMessage,
  SyncOperation,
};

export default models;
