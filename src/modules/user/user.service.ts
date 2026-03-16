/* eslint-disable @typescript-eslint/no-explicit-any */
import prisma from '@config/db';
import { BaseService } from '@core/base.service';
import { ApiError } from '@core/error.classes';
import { Prisma } from '@prisma/client';
import {
  calculatePagination,
  createPaginationMeta,
  GetAllOptions,
} from '@utils/pagination.util';
import { PasswordUtil } from '@utils/password.util';
import { sanitizeSearchInput } from '@utils/sanitize.util';
import { USER_ALLOWED_FILTERS } from './user.constants';

export class UserService extends BaseService {
  constructor() {
    super(prisma.user);
  }

  async findById(id: string) {
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        avatarFileId: true,
        status: true,
        deletedAt: true,
        createdAt: true,
        updatedAt: true,
        tenantId: true,
        emailVerified: true,
        userRoles: { include: { role: true } },
      },
    });

    if (!user) {
      throw ApiError.NotFound('User not found', 'user.not_found');
    }

    return {
      ...user,
      roles: user.userRoles.map((ur) => ur.role.name),
    };
  }

  async getAllUsers(options: GetAllOptions) {
    const { filters = {}, search, searchFields = [], pagination } = options;
    const { page, limit, skip, sortBy, sortOrder } = calculatePagination(pagination || {});

    const where: any = {};
    const { role, status, searchTerm, ...extraFilters } = filters;

    where.deletedAt = null;

    Object.keys(extraFilters).forEach((key) => {
      if ((USER_ALLOWED_FILTERS as readonly string[]).includes(key)) {
        where[key] = extraFilters[key];
      }
    });

    if (role !== undefined) {
      where.userRoles = {
        some: {
          role: {
            name: role,
          },
        },
      };
    }

    if (status !== undefined) {
      where.status = status;
    }

    if (searchTerm) {
      const sanitizedSearch = sanitizeSearchInput(searchTerm);
      if (sanitizedSearch) {
        where.OR = [
          { email: { contains: sanitizedSearch, mode: 'insensitive' } },
          { name: { contains: sanitizedSearch, mode: 'insensitive' } },
        ];
      }
    }

    if (search && searchFields.length > 0) {
      where.OR = [
        ...(where.OR || []),
        ...searchFields.map((field) => ({
          [field]: { contains: search, mode: 'insensitive' },
        })),
      ];
    }

    const orderBy: Prisma.UserOrderByWithRelationInput = {};
    if (sortBy) {
      orderBy[sortBy as keyof Prisma.UserOrderByWithRelationInput] = sortOrder || 'desc';
    } else {
      orderBy.createdAt = 'desc';
    }

    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        select: {
          id: true,
          email: true,
          name: true,
          phone: true,
          avatarFileId: true,
          status: true,
          emailVerified: true,
          deletedAt: true,
          createdAt: true,
          updatedAt: true,
          tenantId: true,
          userRoles: { include: { role: true } },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      meta: createPaginationMeta(total, page, limit),
      data: data.map((user) => ({
        ...user,
        roles: user.userRoles.map((ur) => ur.role.name),
      })),
    };
  }

  async create(
    userData: Prisma.UserCreateInput & {
      tenantId?: string;
      role?: string;
    },
  ) {
    const { role: roleName, ...rest } = userData as any;

    if (rest.password) {
      rest.passwordHash = await PasswordUtil.hashPassword(rest.password);
      delete rest.password;
    }

    let roleId: string | null = null;
    if (roleName) {
      let role = await prisma.role.findFirst({ where: { name: roleName } });
      if (!role) {
        role = await prisma.role.create({ data: { name: roleName } });
      }
      roleId = role.id;
    }

    const user = await prisma.user.create({
      data: {
        ...rest,
        userRoles: roleId
          ? {
              create: { roleId },
            }
          : undefined,
      },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        avatarFileId: true,
        status: true,
        deletedAt: true,
        createdAt: true,
        updatedAt: true,
        tenantId: true,
        emailVerified: true,
        userRoles: { include: { role: true } },
      },
    });

    return { ...user, roles: user.userRoles.map((ur) => ur.role.name) };
  }

  async update(
    id: string,
    data: Prisma.UserUpdateInput & {
      role?: string;
    },
  ) {
    const { role: _role, ...userData } = data as any;

    if (userData.password) {
      userData.passwordHash = await PasswordUtil.hashPassword(userData.password);
      delete userData.password;
    }

    const user = await prisma.user.update({
      where: { id },
      data: userData,
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        avatarFileId: true,
        status: true,
        deletedAt: true,
        createdAt: true,
        updatedAt: true,
        tenantId: true,
        emailVerified: true,
        userRoles: { include: { role: true } },
      },
    });

    return { ...user, roles: user.userRoles.map((ur) => ur.role.name) };
  }

  async softDelete(id: string) {
    return prisma.user.update({
      where: { id },
      data: { deletedAt: new Date(), status: 'INACTIVE' },
    });
  }

  async restore(id: string) {
    return prisma.user.update({
      where: { id },
      data: { deletedAt: null, status: 'ACTIVE' },
    });
  }

  async hardDelete(id: string) {
    await prisma.user.delete({ where: { id } });
    return true;
  }

  async deactivateUser(id: string) {
    return prisma.user.update({
      where: { id },
      data: { status: 'INACTIVE' },
    });
  }

  async updateUserProfile(userId: string, updateData: any) {
    return this.update(userId, updateData);
  }

  async getCurrentUserProfile(userId: string) {
    return this.findById(userId);
  }

  async changePassword(userId: string, oldPassword: string, newPassword: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, passwordHash: true, userRoles: { include: { role: true } } },
    });

    if (!user?.passwordHash) {
      throw ApiError.Unauthorized('Invalid user', 'auth.invalid_user');
    }

    const isMatch = await PasswordUtil.comparePasswords(oldPassword, user.passwordHash);
    if (!isMatch) {
      throw ApiError.Unauthorized('Invalid old password', 'auth.invalid_password');
    }

    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: await PasswordUtil.hashPassword(newPassword) },
    });

    return { id: user.id, roles: user.userRoles.map((ur) => ur.role.name) };
  }
}
