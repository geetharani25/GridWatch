export type UserRole = 'operator' | 'supervisor';

export interface User {
  id:    string;
  email?: string;
  role:  UserRole;
  zones: string[];   // zone UUIDs; empty array for supervisors (all zones permitted)
}

export interface JWTPayload {
  sub:   string;   // user.id
  role:  UserRole;
  zones: string[];
  iat:   number;
  exp:   number;
}

// Augment express Request
declare global {
  namespace Express {
    interface Request {
      user?: User;
      zoneFilter?: string[] | null;
    }
  }
}
