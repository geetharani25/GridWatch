import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { JWTPayload } from '../types/user';

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  const queryToken = req.query.token as string | undefined;
  const raw = header?.startsWith('Bearer ') ? header.slice(7) : queryToken;

  if (!raw) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  try {
    const payload = jwt.verify(raw, config.JWT_SECRET) as JWTPayload;
    req.user = { id: payload.sub, role: payload.role, zones: payload.zones };
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}
