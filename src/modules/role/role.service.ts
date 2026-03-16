import prisma from '@config/db';
import { BaseService } from '@core/base.service';
import { ApiError } from '@core/error.classes';
import { CreateRoleBody, UpdateRoleBody } from './role.interface';

export class RoleService extends BaseService {
  constructor() {
    super(prisma.role);
  }

  async createRole(_tenantId: string, data: CreateRoleBody) {
    const existing = await this.prisma.role.findFirst({
      where: { name: { equals: data.name, mode: 'insensitive' } },
    });

    if (existing) {
      throw ApiError.Conflict('Role already exists with this name', 'role.exists');
    }

    const role = await this.prisma.role.create({
      data: {
        name: data.name,
        permissions: {
          create: data.permissionIds.map((permissionId) => ({ permissionId })),
        },
      },
      include: {
        permissions: { include: { permission: true } },
        _count: { select: { users: true } },
      },
    });

    return {
      ...role,
      permissions: role.permissions.map((permission) => permission.permission.id),
      usersCount: role._count.users,
    };
  }

  async getRoles(_tenantId: string) {
    const roles = await this.prisma.role.findMany({
      include: {
        permissions: { include: { permission: true } },
        _count: { select: { users: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return roles.map((role) => ({
      ...role,
      permissions: role.permissions.map((permission) => permission.permission.id),
      usersCount: role._count.users,
    }));
  }

  async getRoleById(_tenantId: string, roleId: string) {
    const role = await this.prisma.role.findUnique({
      where: { id: roleId },
      include: {
        permissions: { include: { permission: true } },
        _count: { select: { users: true } },
      },
    });

    if (!role) {
      throw ApiError.NotFound('Role not found', 'role.not_found');
    }

    return {
      ...role,
      permissions: role.permissions.map((permission) => permission.permission.id),
      usersCount: role._count.users,
    };
  }

  async updateRole(_tenantId: string, roleId: string, data: UpdateRoleBody) {
    const role = await this.prisma.role.findUnique({ where: { id: roleId } });
    if (!role) {
      throw ApiError.NotFound('Role not found', 'role.not_found');
    }

    if (data.name && data.name !== role.name) {
      const existing = await this.prisma.role.findFirst({
        where: {
          name: { equals: data.name, mode: 'insensitive' },
          id: { not: roleId },
        },
      });
      if (existing) {
        throw ApiError.Conflict('Role name already exists', 'role.exists');
      }
    }

    if (data.permissionIds) {
      await this.prisma.rolePermission.deleteMany({ where: { roleId } });
    }

    const updatedRole = await this.prisma.role.update({
      where: { id: roleId },
      data: {
        ...(data.name ? { name: data.name } : {}),
        ...(data.permissionIds
          ? {
              permissions: {
                create: data.permissionIds.map((permissionId) => ({ permissionId })),
              },
            }
          : {}),
      },
      include: {
        permissions: { include: { permission: true } },
        _count: { select: { users: true } },
      },
    });

    return {
      ...updatedRole,
      permissions: updatedRole.permissions.map((permission) => permission.permission.id),
      usersCount: updatedRole._count.users,
    };
  }

  async deleteRole(_tenantId: string, roleId: string) {
    const role = await this.prisma.role.findUnique({
      where: { id: roleId },
      include: { _count: { select: { users: true } } },
    });

    if (!role) {
      throw ApiError.NotFound('Role not found', 'role.not_found');
    }

    if (role._count.users > 0) {
      throw ApiError.BadRequest('Cannot delete role assigned to users', 'role.has_users');
    }

    await this.prisma.role.delete({ where: { id: roleId } });
    return true;
  }
}
