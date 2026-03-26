import { Request, Response, NextFunction } from 'express';

export function zoneGuard(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  if (req.user.role === 'supervisor') {
    req.zoneFilter = null; // null = all zones
  } else {
    req.zoneFilter = req.user.zones;
    if (req.zoneFilter.length === 0) {
      res.status(403).json({ error: 'No zone assignment' });
      return;
    }
  }
  next();
}
