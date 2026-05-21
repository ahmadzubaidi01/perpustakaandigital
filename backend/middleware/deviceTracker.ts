import { Request, Response, NextFunction } from 'express';

/**
 * Device and browser tracking middleware.
 * Extracts device information from User-Agent and request headers.
 * Stores data for audit logs, session tracking, and scan logs.
 */
const deviceTracker = (req: Request, _res: Response, next: NextFunction): void => {
  const userAgent = req.headers['user-agent'] || '';
  const ip = req.headers['x-forwarded-for'] as string || req.ip || req.socket.remoteAddress || null;

  // Parse browser info
  let browserName: string | null = null;
  let browserVersion: string | null = null;

  if (userAgent.includes('Firefox/')) {
    browserName = 'Firefox';
    browserVersion = userAgent.match(/Firefox\/([\d.]+)/)?.[1] || null;
  } else if (userAgent.includes('Edg/')) {
    browserName = 'Edge';
    browserVersion = userAgent.match(/Edg\/([\d.]+)/)?.[1] || null;
  } else if (userAgent.includes('OPR/') || userAgent.includes('Opera/')) {
    browserName = 'Opera';
    browserVersion = userAgent.match(/OPR\/([\d.]+)/)?.[1] || null;
  } else if (userAgent.includes('Chrome/')) {
    browserName = 'Chrome';
    browserVersion = userAgent.match(/Chrome\/([\d.]+)/)?.[1] || null;
  } else if (userAgent.includes('Safari/') && !userAgent.includes('Chrome')) {
    browserName = 'Safari';
    browserVersion = userAgent.match(/Version\/([\d.]+)/)?.[1] || null;
  }

  // Parse OS info
  let deviceOs: string | null = null;

  if (userAgent.includes('Windows')) {
    deviceOs = 'Windows';
  } else if (userAgent.includes('Mac OS X') || userAgent.includes('Macintosh')) {
    deviceOs = 'macOS';
  } else if (userAgent.includes('Android')) {
    deviceOs = 'Android';
  } else if (userAgent.includes('iOS') || userAgent.includes('iPhone') || userAgent.includes('iPad')) {
    deviceOs = 'iOS';
  } else if (userAgent.includes('Linux')) {
    deviceOs = 'Linux';
  }

  // Parse device type
  let deviceType: string | null = null;

  if (userAgent.includes('Mobile') || userAgent.includes('Android')) {
    deviceType = 'mobile';
  } else if (userAgent.includes('Tablet') || userAgent.includes('iPad')) {
    deviceType = 'tablet';
  } else {
    deviceType = 'desktop';
  }

  // Parse device name from custom header or User-Agent
  const deviceName = req.headers['x-device-name'] as string || null;

  req.deviceInfo = {
    device_name: deviceName,
    device_type: deviceType,
    device_os: deviceOs,
    browser_name: browserName,
    browser_version: browserVersion,
    ip_address: typeof ip === 'string' ? ip.split(',')[0].trim() : null,
  };

  next();
};

export { deviceTracker };
