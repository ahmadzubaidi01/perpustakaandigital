import { Request, Response } from 'express';
import { AuditLog } from '../models';
import apiResponse from '../utils/apiResponse';
import { asyncHandler } from '../middleware/errorHandler';
import { parsePaginationParams, buildPaginationResult, parseFilterParams } from '../utils/pagination';

const listAuditLogs = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const pagination = parsePaginationParams(req, 'created_at', ['created_at', 'action_type', 'table_name']);
  const filters = parseFilterParams(req, ['action_type', 'table_name', 'performed_by_user_id']);
  const where: any = { ...filters };

  if (req.query.affected_record_id) where.affected_record_id = req.query.affected_record_id;
  if (req.query.start_date && req.query.end_date) {
    where.created_at = { [require('sequelize').Op.between]: [new Date(req.query.start_date as string), new Date(req.query.end_date as string)] };
  }

  const { count, rows } = await AuditLog.findAndCountAll({
    where,
    include: [{ association: 'performed_by', attributes: ['user_id', 'full_name', 'email_address'] }],
    order: [[pagination.sortBy, pagination.sortOrder]],
    limit: pagination.limit, offset: pagination.offset,
  });
  apiResponse.paginated(res, 'Audit logs retrieved', rows, buildPaginationResult(count, pagination));
});

const getAuditLog = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const log = await AuditLog.findByPk(req.params.log_id as string, { include: [{ association: 'performed_by', attributes: ['user_id', 'full_name', 'email_address'] }] });
  if (!log) { apiResponse.notFound(res, 'Audit log not found'); return; }
  apiResponse.success(res, 'Audit log retrieved', log);
});

export { listAuditLogs, getAuditLog };
