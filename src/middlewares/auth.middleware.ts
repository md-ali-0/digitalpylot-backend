/* eslint-disable @typescript-eslint/no-explicit-any */
import logger from '@config/winston';
import { ApiError } from '@core/error.classes';
import { RbacService } from '@services/rbac.service';
import { verifyAccessToken } from '@utils/jwt.util';
import { NextFunction, Request, Response } from 'express';
import prisma from '../config/db';
import { Role } from '../types/index';

export const authenticate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(ApiError.Unauthorized('No token provided', 'auth.no_token'));
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyAccessToken(token);

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: {
        userRoles: {
          include: {
            role: {
              include: {
                permissions: {
                  include: { permission: true },
                },
              },
            },
          },
        },
      },
    });

    if (!user) {
      return next(ApiError.Unauthorized('Invalid token', 'auth.invalid_token'));
    }

    if (user.deletedAt) {
      return next(ApiError.Unauthorized('Account deleted', 'auth.account_deleted'));
    }

    if (user.status !== 'ACTIVE') {
      return next(ApiError.Forbidden('Account is not active', 'auth.account_inactive'));
    }

    const resolvedPermissions = await RbacService.resolveEffectivePermissions(user.id);

    req.user = {
      id: user.id,
      email: user.email,
      role: normalizeRoleForCheck(user.userRoles[0]?.role.name || 'USER') as Role,
      roles: resolvedPermissions.roles,
      permissions: resolvedPermissions.permissions,
      status: user.status,
      tenantId: user.tenantId,
    } as any;

    next();
  } catch (error: any) {
    logger.warn(`Authentication failed: ${error.message}`);
    next(error);
  }
};

export const optionalAuthenticate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }

    const token = authHeader.split(' ')[1];

    try {
      const decoded = verifyAccessToken(token);
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        include: {
          userRoles: {
            include: {
              role: {
                include: {
                  permissions: {
                    include: { permission: true },
                  },
                },
              },
            },
          },
        },
      });

      if (user && !user.deletedAt && user.status === 'ACTIVE') {
        const resolvedPermissions = await RbacService.resolveEffectivePermissions(user.id);

        req.user = {
          id: user.id,
          email: user.email,
          role: normalizeRoleForCheck(user.userRoles[0]?.role.name || 'USER') as Role,
          roles: resolvedPermissions.roles,
          permissions: resolvedPermissions.permissions,
          status: user.status,
          tenantId: user.tenantId,
        } as any;
      }
    } catch (error: any) {
      logger.warn(`[OptionalAuth] Token verification failed: ${error.message}`);
    }

    next();
  } catch (error: any) {
    logger.warn(`Optional authentication error: ${error.message}`);
    next();
  }
};

function normalizeRoleForCheck(roleName: string): string {
  const r = roleName.trim().toLowerCase().replace(/\s+/g, '_');
  if (r === 'super_admin') return 'SUPER_ADMIN';
  if (r === 'admin') return 'ADMIN';
  if (r === 'manager') return 'MANAGER';
  if (r === 'affiliate') return 'AFFILIATE';
  if (r === 'advertiser') return 'ADVERTISER';
  return roleName.toUpperCase().replace(/\s+/g, '_');
}

export const authorizeRoles = (allowedRoles: Role[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !(req.user as any).roles) {
      return next(ApiError.Forbidden('Insufficient role', 'auth.insufficient_role'));
    }

    const userRoles = ((req.user as any).roles || []) as string[];
    const normalizedUserRoles = userRoles.map(normalizeRoleForCheck);
    const normalizedAllowedRoles = allowedRoles.map((r) => r.toUpperCase().replace(/\s+/g, '_'));

    const hasRole = normalizedUserRoles.some((userRole) =>
      normalizedAllowedRoles.includes(userRole),
    );

    if (!hasRole) {
      return next(ApiError.Forbidden('Insufficient role', 'auth.insufficient_role'));
    }
    next();
  };
};

export const authorizePermissions = (requiredPermissions: string | string[]) => {
  const permissions = Array.isArray(requiredPermissions)
    ? requiredPermissions
    : [requiredPermissions];

  return (req: Request, res: Response, next: NextFunction) => {
    const userPermissions = (req.user?.permissions || []) as string[];

    const hasPermission = permissions.every((permission) => userPermissions.includes(permission));
    if (!hasPermission) {
      return next(
        ApiError.Forbidden(
          `Missing required permission: ${permissions.join(', ')}`,
          'auth.insufficient_permission',
        ),
      );
    }

    next();
  };
};

export const authorizeResourceOwner = (getOwnerId: (req: Request) => string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return next(ApiError.Unauthorized());
    const ownerId = getOwnerId(req);
    const isAdmin = ((req.user as any).roles || []).some((role: string) =>
      ['ADMIN', 'SUPER_ADMIN'].includes(normalizeRoleForCheck(role)),
    );

    if (req.user.id !== ownerId && !isAdmin) {
      return next(ApiError.Forbidden('Not owner', 'auth.not_owner'));
    }
    next();
  };
};
