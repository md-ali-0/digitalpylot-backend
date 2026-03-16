import prisma from '@config/db';
import { BaseService } from '@core/base.service';
import { ApiError } from '@core/error.classes';
import { Prisma } from '@prisma/client';
import { CreateRoleBody, UpdateRoleBody } from './role.interface';

export class RoleService extends BaseService {
  constructor() {
    super(prisma.role);
  }

  // Create Role
  async createRole(tenantId: string, data: CreateRoleBody) {
    // Check if role name exists in tenant
    const existing = await this.prisma.role.findFirst({
      where: { tenantId, name: { equals: data.name, mode: 'insensitive' } },
    });

    if (existing) {
      throw ApiError.Conflict('Role already exists with this name', 'role.exists');
    }

    const role = await this.prisma.role.create({
      data: {
        name: data.name,
        tenantId,
        permissions: {
          create: data.permissionIds.map((permId) => ({
            permissionId: permId,
          })),
        },
      },
      include: {
        permissions: { include: { permission: true } },
      },
    });

    return {
      ...role,
      permissions: role.permissions.map((p) => p.permission.id),
    };
  }

  // List Roles
  async getRoles(tenantId: string) {
    const roles = await this.prisma.role.findMany({
      where: { tenantId },
      include: {
        permissions: { include: { permission: true } },
        _count: { select: { users: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return roles.map((role) => ({
      ...role,
      permissions: role.permissions.map((p) => p.permission.id),
      usersCount: role._count.users,
    }));
  }

  async getRoleById(tenantId: string, roleId: string) {
    const role = await this.prisma.role.findUnique({
      where: { id: roleId },
      include: {
        permissions: { include: { permission: true } },
      },
    });

    if (!role || role.tenantId !== tenantId) {
      throw ApiError.NotFound('Role not found', 'role.not_found');
    }

    return {
      ...role,
      permissions: role.permissions.map((p) => p.permission.id),
    };
  }

  async updateRole(tenantId: string, roleId: string, data: UpdateRoleBody) {
    const role = await this.prisma.role.findUnique({ where: { id: roleId } });
    if (!role || role.tenantId !== tenantId) {
      throw ApiError.NotFound('Role not found', 'role.not_found');
    }

    // If updating name, check uniqueness
    if (data.name && data.name !== role.name) {
      const existing = await this.prisma.role.findFirst({
        where: { tenantId, name: { equals: data.name, mode: 'insensitive' }, id: { not: roleId } },
      });
      if (existing) {
        throw ApiError.Conflict('Role name already exists', 'role.exists');
      }
    }

    // Update Role
    const updateData: Prisma.RoleUpdateInput = {};
    if (data.name) updateData.name = data.name;

    // Update Permissions if provided
    if (data.permissionIds) {
      // Delete existing permissions
      // Then create new ones
      // Prisma update doesn't have "replace" for many-to-many easily with explicit relation table
      // We can delete all RolePermissions for this role and re-insert

      await this.prisma.rolePermission.deleteMany({
        where: { roleId },
      });

      updateData.permissions = {
        create: data.permissionIds.map((pid) => ({ permissionId: pid })),
      };
    }

    const updatedRole = await this.prisma.role.update({
      where: { id: roleId },
      data: updateData,
      include: {
        permissions: { include: { permission: true } },
      },
    });

    return {
      ...updatedRole,
      permissions: updatedRole.permissions.map((p) => p.permission.id),
    };
  }

  async deleteRole(tenantId: string, roleId: string) {
    const role = await this.prisma.role.findUnique({
      where: { id: roleId },
      include: { _count: { select: { users: true } } },
    });

    if (!role || role.tenantId !== tenantId) {
      throw ApiError.NotFound('Role not found', 'role.not_found');
    }

    if (role._count.users > 0) {
      throw ApiError.BadRequest('Cannot delete role assigned to users', 'role.has_users');
    }

    await this.prisma.role.delete({ where: { id: roleId } });

    return true;
  }
}
