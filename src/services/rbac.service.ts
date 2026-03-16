import prisma from '@config/db';
import { RBAC_PERMISSION_DEFINITIONS, RBAC_PERMISSION_NAMES } from '@constants/rbac.constants';
import { ApiError } from '@core/error.classes';
import { randomUUID } from 'crypto';

type EffectivePermissionContext = {
  directPermissions: string[];
  permissions: string[];
  roles: string[];
};

let ensureTablesPromise: Promise<void> | null = null;

async function ensureRbacTables() {
  if (!ensureTablesPromise) {
    ensureTablesPromise = (async () => {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS user_permission_grants (
          user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          permission_name TEXT NOT NULL,
          granted_by TEXT,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (user_id, permission_name)
        )
      `);

      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS audit_logs (
          id TEXT NOT NULL PRIMARY KEY,
          tenant_id TEXT NOT NULL,
          user_id TEXT,
          action TEXT NOT NULL,
          resource_type TEXT NOT NULL,
          resource_id TEXT,
          changes JSONB,
          ip_address TEXT,
          user_agent TEXT,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `);
    })();
  }

  await ensureTablesPromise;
}

export class RbacService {
  static async ensureInfrastructure() {
    await ensureRbacTables();
  }

  static getPermissionCatalog() {
    return RBAC_PERMISSION_DEFINITIONS;
  }

  static validatePermissionNames(permissionNames: string[]) {
    const invalid = permissionNames.filter(
      (permission) => !RBAC_PERMISSION_NAMES.includes(permission),
    );
    if (invalid.length > 0) {
      throw ApiError.BadRequest(`Invalid permissions: ${invalid.join(', ')}`, 'rbac.invalid_permissions');
    }
  }

  static async resolveEffectivePermissions(userId: string): Promise<EffectivePermissionContext> {
    await ensureRbacTables();

    const user = await prisma.user.findUnique({
      where: { id: userId },
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
      throw ApiError.NotFound('User not found', 'user.not_found');
    }

    const directRows = await prisma.$queryRaw<Array<{ permission_name: string }>>`
      SELECT permission_name
      FROM user_permission_grants
      WHERE user_id = ${userId}
    `;

    const permissionSet = new Set<string>();
    const roles = user.userRoles.map((assignment) => assignment.role.name);

    user.userRoles.forEach((assignment) => {
      assignment.role.permissions.forEach((permissionAssignment) => {
        const atom = permissionAssignment.permission.name || permissionAssignment.permission.id;
        if (atom) {
          permissionSet.add(atom);
        }
      });
    });

    directRows.forEach((row) => permissionSet.add(row.permission_name));

    return {
      roles,
      directPermissions: directRows.map((row) => row.permission_name),
      permissions: Array.from(permissionSet).sort(),
    };
  }

  static async getUserPermissionAssignment(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        tenantId: true,
        userRoles: { include: { role: true } },
      },
    });

    if (!user) {
      throw ApiError.NotFound('User not found', 'user.not_found');
    }

    const resolved = await this.resolveEffectivePermissions(userId);

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        tenantId: user.tenantId,
        roles: user.userRoles.map((assignment) => assignment.role.name),
      },
      directPermissions: resolved.directPermissions,
      effectivePermissions: resolved.permissions,
      grantablePermissions: RBAC_PERMISSION_DEFINITIONS,
    };
  }

  static async updateUserPermissions(params: {
    actorId: string;
    targetUserId: string;
    permissionNames: string[];
    ipAddress?: string;
    userAgent?: string;
  }) {
    await ensureRbacTables();
    this.validatePermissionNames(params.permissionNames);

    const actorPermissions = await this.resolveEffectivePermissions(params.actorId);
    const actorCanManagePermissions = actorPermissions.permissions.includes('permissions:manage');
    if (!actorCanManagePermissions) {
      throw ApiError.Forbidden(
        'You do not have permission to manage permission grants',
        'rbac.permissions_manage_required',
      );
    }

    const exceeding = params.permissionNames.filter(
      (permission) => !actorPermissions.permissions.includes(permission),
    );
    if (exceeding.length > 0) {
      throw ApiError.Forbidden(
        `Grant ceiling exceeded for: ${exceeding.join(', ')}`,
        'rbac.grant_ceiling_exceeded',
      );
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: params.targetUserId },
      select: { id: true, tenantId: true, email: true, name: true },
    });

    if (!targetUser) {
      throw ApiError.NotFound('User not found', 'user.not_found');
    }

    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        DELETE FROM user_permission_grants
        WHERE user_id = ${params.targetUserId}
      `;

      for (const permissionName of params.permissionNames) {
        await tx.$executeRaw`
          INSERT INTO user_permission_grants (user_id, permission_name, granted_by)
          VALUES (${params.targetUserId}, ${permissionName}, ${params.actorId})
        `;
      }
    });

    await this.createAuditLog({
      tenantId: targetUser.tenantId,
      userId: params.actorId,
      action: 'USER_PERMISSION_UPDATED',
      resourceType: 'UserPermissionGrant',
      resourceId: targetUser.id,
      changes: {
        targetUserId: targetUser.id,
        targetEmail: targetUser.email,
        directPermissions: params.permissionNames,
      },
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
    });

    return this.getUserPermissionAssignment(params.targetUserId);
  }

  static async createAuditLog(params: {
    tenantId: string;
    userId?: string;
    action: string;
    resourceType: string;
    resourceId?: string;
    changes?: unknown;
    ipAddress?: string;
    userAgent?: string;
  }) {
    await ensureRbacTables();

    await prisma.$executeRaw`
      INSERT INTO audit_logs (
        id,
        tenant_id,
        user_id,
        action,
        resource_type,
        resource_id,
        changes,
        ip_address,
        user_agent
      ) VALUES (
        ${randomUUID()},
        ${params.tenantId},
        ${params.userId ?? null},
        ${params.action},
        ${params.resourceType},
        ${params.resourceId ?? null},
        CAST(${params.changes ? JSON.stringify(params.changes) : null} AS jsonb),
        ${params.ipAddress ?? null},
        ${params.userAgent ?? null}
      )
    `;
  }

  static async listAuditLogs(tenantId?: string) {
    await ensureRbacTables();

    const rows = tenantId
      ? await prisma.$queryRaw<
          Array<{
            id: string;
            tenant_id: string;
            user_id: string | null;
            action: string;
            resource_type: string;
            resource_id: string | null;
            changes: unknown;
            ip_address: string | null;
            user_agent: string | null;
            created_at: Date;
          }>
        >`
          SELECT id, tenant_id, user_id, action, resource_type, resource_id, changes, ip_address, user_agent, created_at
          FROM audit_logs
          WHERE tenant_id = ${tenantId}
          ORDER BY created_at DESC
          LIMIT 200
        `
      : await prisma.$queryRaw<
          Array<{
            id: string;
            tenant_id: string;
            user_id: string | null;
            action: string;
            resource_type: string;
            resource_id: string | null;
            changes: unknown;
            ip_address: string | null;
            user_agent: string | null;
            created_at: Date;
          }>
        >`
          SELECT id, tenant_id, user_id, action, resource_type, resource_id, changes, ip_address, user_agent, created_at
          FROM audit_logs
          ORDER BY created_at DESC
          LIMIT 200
        `;

    return rows.map((row) => ({
      id: row.id,
      tenantId: row.tenant_id,
      userId: row.user_id,
      action: row.action,
      resourceType: row.resource_type,
      resourceId: row.resource_id,
      changes: row.changes,
      ipAddress: row.ip_address,
      userAgent: row.user_agent,
      createdAt: row.created_at,
    }));
  }
}
