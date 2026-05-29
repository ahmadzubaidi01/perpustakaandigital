import { Request, Response, NextFunction } from 'express';
import { SyncOperation } from '../models';
import logger from '../utils/logger';

/**
 * Middleware to enforce idempotency using X-Operation-ID header.
 * Ideal for preventing duplicate offline sync operations.
 */
export const enforceIdempotency = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const operationId = req.headers['x-operation-id'] as string;
  
  if (!operationId) {
    return next(); // Proceed normally if no idempotency key is provided
  }

  try {
    const existingOp = await SyncOperation.findOne({ where: { operation_id: operationId } });

    if (existingOp) {
      logger.info(`Idempotency hit for operation ${operationId}. Skipping execution and returning success.`);
      // Return a standard 200 OK because the client just wants to know it succeeded
      res.status(200).json({
        success: true,
        message: 'Operation already processed (Idempotency)',
        data: { operation_id: operationId },
        error: null,
        metadata: {
          idempotent: true,
          processed_at: existingOp.processed_at,
        }
      });
      return; // Do NOT call next()
    }

    // Attach a hook to record the operation after the request successfully finishes
    // Note: We use res.on('finish') to record it only if the actual controller succeeded (2xx)
    res.on('finish', async () => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        try {
          const userId = (req as any).user?.user_id || null;
          await SyncOperation.create({
            operation_id: operationId,
            user_id: userId,
            operation_type: req.method,
            entity_name: req.baseUrl + req.path,
          });
        } catch (err: any) {
          logger.error(`Failed to record idempotency key ${operationId}:`, { error: err.message });
        }
      }
    });

    next();
  } catch (error: any) {
    logger.error('Error in idempotency middleware:', { error: error.message });
    next(error);
  }
};
