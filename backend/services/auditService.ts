import { AuditLog } from '../models';
import { AuditActionType } from '../config/constants';
import logger from '../utils/logger';

interface AuditLogEntry {
  action_type: AuditActionType | string;
  table_name: string;
  affected_record_id: string | number;
  old_value?: object | null;
  new_value?: object | null;
  performed_by_user_id?: number | null;
  device_name?: string | null;
  device_type?: string | null;
  device_os?: string | null;
  browser_name?: string | null;
  browser_version?: string | null;
  ip_address?: string | null;
}

/**
 * Create an immutable audit log entry.
 * Audit logs are write-only — no updates or deletions.
 */
const createAuditLog = async (entry: AuditLogEntry): Promise<void> => {
  try {
    await AuditLog.create({
      action_type: entry.action_type,
      table_name: entry.table_name,
      affected_record_id: String(entry.affected_record_id),
      old_value: entry.old_value || null,
      new_value: entry.new_value || null,
      performed_by_user_id: entry.performed_by_user_id || null,
      device_name: entry.device_name || null,
      device_type: entry.device_type || null,
      device_os: entry.device_os || null,
      browser_name: entry.browser_name || null,
      browser_version: entry.browser_version || null,
      ip_address: entry.ip_address || null,
    });
  } catch (error: any) {
    // Critical failure — log automatically but don't break the main flow
    logger.error('Failed to create audit log', {
      error: error.message,
      entry: {
        action_type: entry.action_type,
        table_name: entry.table_name,
        affected_record_id: entry.affected_record_id,
      },
    });
  }
};

/**
 * Helper to build audit entry from request context.
 */
const buildAuditFromRequest = (
  req: Express.Request,
  action_type: AuditActionType | string,
  table_name: string,
  affected_record_id: string | number,
  old_value?: object | null,
  new_value?: object | null
): AuditLogEntry => {
  return {
    action_type,
    table_name,
    affected_record_id,
    old_value: old_value || null,
    new_value: new_value || null,
    performed_by_user_id: req.user?.user_id || null,
    device_name: req.deviceInfo?.device_name || null,
    device_type: req.deviceInfo?.device_type || null,
    device_os: req.deviceInfo?.device_os || null,
    browser_name: req.deviceInfo?.browser_name || null,
    browser_version: req.deviceInfo?.browser_version || null,
    ip_address: req.deviceInfo?.ip_address || null,
  };
};

export { createAuditLog, buildAuditFromRequest, AuditLogEntry };
