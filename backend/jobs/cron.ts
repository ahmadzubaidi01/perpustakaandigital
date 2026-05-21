import cron from 'node-cron';
import { Op } from 'sequelize';
import { Borrowing, BookQr } from '../models';
import { BorrowingStatus, QrStatus } from '../config/constants';
import logger from '../utils/logger';

export const initCronJobs = () => {
  // Run every midnight at 00:00
  cron.schedule('0 0 * * *', async () => {
    logger.info('Running daily auto-lost check for borrowings...');
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      // Find borrowings that are 'borrowed' and their due_date was more than 30 days ago
      // Or if there's no due_date, check borrowed_at
      const overdueBorrowings = await Borrowing.findAll({
        where: {
          borrowing_status: BorrowingStatus.BORROWED,
          [Op.or]: [
            { due_date: { [Op.lt]: thirtyDaysAgo } },
            { 
              due_date: null,
              borrowed_at: { [Op.lt]: thirtyDaysAgo } 
            }
          ]
        }
      });

      let count = 0;
      for (const borrowing of overdueBorrowings) {
        // Update borrowing status to late
        await borrowing.update({ borrowing_status: BorrowingStatus.LATE });

        // Update QR status to lost
        const qr = await BookQr.findByPk(borrowing.book_qr_id);
        if (qr) {
          await qr.update({ qr_status: QrStatus.LOST });
        }
        count++;
      }

      logger.info(`Auto-lost check completed. Marked ${count} borrowings and QR codes as lost.`);
    } catch (error) {
      logger.error('Error during daily auto-lost cron job:', error);
    }
  });

  logger.info('Cron jobs initialized.');
};
