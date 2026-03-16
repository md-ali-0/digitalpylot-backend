/* eslint-disable @typescript-eslint/no-explicit-any */
export * from './jwt-signin-options';
export * from './multer';

export type Role = 'SUPER_ADMIN' | 'ADMIN' | 'MANAGER' | 'AFFILIATE' | 'ADVERTISER';
export type ApplicationRole = 'ADMIN' | 'MANAGER';

// Augment the Express User interface
declare global {
  namespace Express {
    interface User {
      affiliateId?: string;
      id: string;
      email: string;
      role: Role;
      status: string;
      tenantId: string;
      permissions?: string[];
      profile?: any;
    }

    interface Request {
      rawBody?: Buffer;
    }
  }
}

declare module 'express-session' {
  interface SessionData {
    [key: string]: any;
  }
}
