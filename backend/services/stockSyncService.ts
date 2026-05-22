import { Transaction, Op } from 'sequelize';
import { Book, BookQr, Borrowing } from '../models';
import { BorrowingStatus, BookStatus, QrStatus } from '../config/constants';
import { deleteCache, deleteCachePattern } from '../config/redis';
import logger from '../utils/logger';

/**
 * Stock synchronization service.
 * Ensures available_stock + borrowed_stock NEVER exceeds total_stock.
 * Automatically syncs after borrow, return, and status changes.
 *
 * ALL stock sync operations MUST use database transactions.
 */

/**
 * Recalculate and sync stock for a specific book.
 * Uses row-level locking for concurrency safety.
 */
const syncBookStock = async (bookId: number, transaction?: Transaction): Promise<void> => {
  try {
    // Lock the book row for update (concurrency-safe)
    const book = await Book.findByPk(bookId, {
      lock: transaction ? Transaction.LOCK.UPDATE : undefined,
      transaction,
    });

    if (!book) {
      logger.warn('Stock sync: Book not found', { bookId });
      return;
    }

    // Count active borrowings for this book's QR codes
    const bookQrIds = await BookQr.findAll({
      where: { book_id: bookId },
      attributes: ['book_qr_id'],
      transaction,
    });

    const qrIds = bookQrIds.map((qr) => qr.book_qr_id);

    if (qrIds.length === 0) {
      // No QR codes — all stock is available
      let updatedStatus = book.book_status;
      if (book.total_stock > 0 && book.book_status === BookStatus.BORROWED) {
        updatedStatus = BookStatus.AVAILABLE;
      } else if (book.total_stock === 0 && book.book_status === BookStatus.AVAILABLE) {
        updatedStatus = BookStatus.BORROWED;
      }

      await book.update(
        {
          borrowed_stock: 0,
          available_stock: book.total_stock,
          book_status: updatedStatus,
        },
        { transaction }
      );
    } else {
      // Count active QR codes (status = ACTIVE)
      const activeQrCount = await BookQr.count({
        where: {
          book_id: bookId,
          qr_status: QrStatus.ACTIVE,
        },
        transaction,
      });

      // Find all QR codes for this book to query associated borrowings
      const bookQrs = await BookQr.findAll({
        where: { book_id: bookId },
        attributes: ['book_qr_id'],
        transaction,
      });
      const qrIds = bookQrs.map((qr) => qr.book_qr_id);

      let pendingOrReservedCount = 0;
      if (qrIds.length > 0) {
        pendingOrReservedCount = await Borrowing.count({
          where: {
            book_qr_id: { [Op.in]: qrIds },
            borrowing_status: { [Op.in]: [BorrowingStatus.PENDING, BorrowingStatus.RESERVED] },
          },
          transaction,
        });
      }

      const newAvailableStock = Math.max(0, activeQrCount - pendingOrReservedCount);

      // Count borrowed QR codes (status = BORROWED)
      const newBorrowedStock = await BookQr.count({
        where: {
          book_id: bookId,
          qr_status: QrStatus.BORROWED,
        },
        transaction,
      });

      let updatedStatus = book.book_status;
      if (newAvailableStock === 0 && book.book_status === BookStatus.AVAILABLE) {
        updatedStatus = BookStatus.BORROWED;
      } else if (newAvailableStock > 0 && book.book_status === BookStatus.BORROWED) {
        updatedStatus = BookStatus.AVAILABLE;
      }

      await book.update(
        {
          borrowed_stock: newBorrowedStock,
          available_stock: newAvailableStock,
          book_status: updatedStatus,
        },
        { transaction }
      );
    }

    // Invalidate cache — Redis MUST NOT serve stale borrowing or stock data
    try {
      await deleteCache(`book:${bookId}`);
      await deleteCachePattern(`books:list:*`);
      await deleteCachePattern(`dashboard:*`);
    } catch (cacheError: any) {
      logger.warn('Stock sync: Cache invalidation failed', {
        bookId,
        error: cacheError.message,
      });
    }

    logger.info('Stock sync completed', { bookId });
  } catch (error: any) {
    logger.error('Stock sync failed', {
      bookId,
      error: error.message,
    });
    throw error;
  }
};

/**
 * Sync stock for all books in a school.
 */
const syncSchoolBookStock = async (schoolId: number): Promise<void> => {
  const books = await Book.findAll({
    where: { school_id: schoolId },
    attributes: ['book_id'],
  });

  for (const book of books) {
    await syncBookStock(book.book_id);
  }
};

/**
 * Validate stock before borrowing.
 * Returns true if stock is available, false otherwise.
 */
const validateStockAvailability = async (
  bookId: number,
  transaction?: Transaction
): Promise<boolean> => {
  const book = await Book.findByPk(bookId, {
    lock: transaction ? Transaction.LOCK.UPDATE : undefined,
    transaction,
  });

  if (!book) return false;

  return book.available_stock > 0;
};

export {
  syncBookStock,
  syncSchoolBookStock,
  validateStockAvailability,
};
