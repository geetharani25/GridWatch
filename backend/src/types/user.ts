export type UserRole = 'operator' | 'supervisor';

export interface User {
  id:    string;
  email?: string;
  role:  UserRole;
  zones: string[];
}

export interface JWTPayload {
  sub:   string;
  role:  UserRole;
  zones: string[];
  iat:   number;
  exp:   number;
}

declare global {
  namespace Express {
    interface Request {
      user?: User;
      zoneFilter?: string[] | null;
    }
  }
}
