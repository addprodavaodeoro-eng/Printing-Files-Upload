import { Request, Response, NextFunction } from 'express';
import { db, verifyPassword } from './db';

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  const tokenHeader = req.headers['x-admin-token'] as string | undefined;

  let token: string | undefined;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  } else if (tokenHeader) {
    token = tokenHeader.trim();
  }

  if (!token || !db.validateSession(token)) {
    res.status(401).json({ error: 'Unauthorized. Admin login required.' });
    return;
  }

  next();
}

export function handleAdminLogin(password: string): { success: boolean; token?: string; error?: string } {
  if (!password) {
    return { success: false, error: 'Password is required' };
  }

  const settings = db.getSettings();
  const isValid = verifyPassword(password, settings.adminPasswordHash, settings.adminPasswordSalt);

  if (!isValid) {
    return { success: false, error: 'Invalid admin password' };
  }

  const sessionToken = db.createSession(48); // 48 hours validity
  return { success: true, token: sessionToken };
}
