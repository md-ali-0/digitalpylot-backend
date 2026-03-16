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

    // Soft Delete Check
    if (user.deletedAt) {
      return next(ApiError.Unauthorized('Account deleted', 'auth.account_deleted'));
    }

    if (user.status !== 'ACTIVE') {
      return next(ApiError.Forbidden('Account is not active', 'auth.account_inactive'));
    }

    // Strict Tenant Check: if x-tenant-id is sent, user must belong to that tenant (Super Admin can skip)
    const requestTenantIdRaw = req.headers['x-tenant-id'] as string;
    if (requestTenantIdRaw) {
      let resolvedRequestTenantId = requestTenantIdRaw;
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        requestTenantIdRaw,
      );
      if (!isUuid) {
        const tenant = await prisma.tenant.findUnique({ where: { slug: requestTenantIdRaw } });
        resolvedRequestTenantId = tenant?.id ?? requestTenantIdRaw;
      }
      const isSuperAdmin = user.userRoles.some(
        (ur) =>
          ur.role.name === 'Super Admin' ||
          ur.role.name.toLowerCase().replace(/\s+/g, '_') === 'super_admin',
      );
      if (!isSuperAdmin && user.tenantId !== resolvedRequestTenantId) {
        return next(ApiError.Forbidden('Tenant mismatch', 'auth.tenant_mismatch'));
      }
    }

    // If token has tenantId (it should), verify it matches user
    if ((decoded as any).tenantId && (decoded as any).tenantId !== user.tenantId) {
      return next(ApiError.Unauthorized('Token tenant mismatch', 'auth.token_mismatch'));
    }

    const resolvedPermissions = await RbacService.resolveEffectivePermissions(user.id);
    const roles = new Set<string>(resolvedPermissions.roles);

    // Vendor Info (Legacy Mapping)
    let additionalInfo = undefined;

    // Dynamic naming convention check (case-insensitive usually better, but names are strict in seed)
    const isAdvertiser = roles.has('Advertiser') || roles.has('ADVERTISER');
    const isAffiliate = roles.has('Affiliate') || roles.has('AFFILIATE');

    if (isAdvertiser) {
      const advertiser = await prisma.advertiser.findUnique({ where: { userId: user.id } });
      additionalInfo = advertiser;
    } else if (isAffiliate) {
      const affiliate = await prisma.affiliate.findUnique({ where: { userId: user.id } });
      additionalInfo = affiliate;
    }

    req.user = {
      id: user.id,
      email: user.email,
      roles: Array.from(roles), // Now array of strings
      permissions: resolvedPermissions.permissions,
      status: user.status,
      tenantId: user.tenantId,
      profile: additionalInfo,
      affiliateId: isAffiliate ? additionalInfo?.id : undefined,
      ...additionalInfo,
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
        const requestTenantId = req.headers['x-tenant-id'] as string;
        if (requestTenantId && user.tenantId !== requestTenantId) {
          return next();
        }

        const resolvedPermissions = await RbacService.resolveEffectivePermissions(user.id);
        const roles = new Set<string>(resolvedPermissions.roles);

        let additionalInfo = undefined;
        const isAdvertiser = roles.has('Advertiser') || roles.has('ADVERTISER');
        const isAffiliate = roles.has('Affiliate') || roles.has('AFFILIATE');

        if (isAdvertiser) {
          const advertiser = await prisma.advertiser.findUnique({ where: { userId: user.id } });
          additionalInfo = advertiser;
        } else if (isAffiliate) {
          const affiliate = await prisma.affiliate.findUnique({ where: { userId: user.id } });
          additionalInfo = affiliate;
        }

        req.user = {
          id: user.id,

          email: user.email,
          roles: Array.from(roles),
          permissions: resolvedPermissions.permissions,
          status: user.status,
          tenantId: user.tenantId,
          profile: additionalInfo,
          affiliateId: isAffiliate ? additionalInfo?.id : undefined,
          ...additionalInfo,
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

/**
 * Normalize DB role names (e.g. "Super Admin", "Admin") to Role type format (SUPER_ADMIN, ADMIN).
 */
function normalizeRoleForCheck(roleName: string): string {
  const r = roleName.trim().toLowerCase().replace(/\s+/g, '_');
  if (r === 'super_admin') return 'SUPER_ADMIN';
  if (r === 'admin') return 'ADMIN';
  if (r === 'manager') return 'MANAGER';
  if (r === 'affiliate') return 'AFFILIATE';
  if (r === 'advertiser') return 'ADVERTISER';
  return roleName.toUpperCase().replace(/\s+/g, '_');
}

// Role-based authorization
export const authorizeRoles = (allowedRoles: Role[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !(req.user as any).roles) {
      return next(ApiError.Forbidden('Insufficient role', 'auth.insufficient_role'));
    }

    const userRoles = (req.user as any).roles as string[];
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

// Resource Owner
export const authorizeResourceOwner = (getOwnerId: (req: Request) => string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return next(ApiError.Unauthorized());
    const ownerId = getOwnerId(req);

    // Check for ADMIN role by name or permission
    const isAdmin =
      (req.user as any).roles.includes('ADMIN') || (req.user as any).roles.includes('Super Admin');

    if (req.user.id !== ownerId && !isAdmin) {
      return next(ApiError.Forbidden('Not owner', 'auth.not_owner'));
    }
    next();
  };
};
