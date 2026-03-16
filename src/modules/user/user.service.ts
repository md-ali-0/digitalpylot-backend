/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import prisma from '@config/db';
import { BaseService } from '@core/base.service';
import { ApiError } from '@core/error.classes';
import { CommissionType, Prisma } from '@prisma/client';
import { calculatePagination, createPaginationMeta, GetAllOptions } from '@utils/pagination.util';
import { PasswordUtil } from '@utils/password.util';
import { sanitizeSearchInput } from '@utils/sanitize.util';
import { NotificationService } from '../notification/notification.service';
import { USER_ALLOWED_FILTERS } from './user.constants';

const notificationService = new NotificationService();

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
        userRoles: {
          include: { role: true },
        },
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

    if (filters.isDeleted === 'true' || filters.isDeleted === true) {
      where.deletedAt = { not: null };
    } else if (filters.delete === 'YES') {
      // Include both deleted and non-deleted records
    } else {
      where.deletedAt = null;
    }

    const {
      role,
      status,
      emailVerified,
      searchTerm,
      isDeleted: _isDeleted,
      ...extraFilters
    } = filters;

    Object.keys(extraFilters).forEach((key) => {
      if ((USER_ALLOWED_FILTERS as readonly string[]).includes(key)) {
        where[key] = extraFilters[key];
      }
    });

    // ✅ Role filter (Dynamic)
    if (role !== undefined) {
      where.userRoles = {
        some: {
          role: {
            name: role,
          },
        },
      };
    }

    // ✅ Status filter
    if (status !== undefined) where.status = status;

    // ✅ Search term
    if (searchTerm) {
      const sanitizedSearch = sanitizeSearchInput(searchTerm);
      if (sanitizedSearch) {
        where.OR = [
          { email: { contains: sanitizedSearch, mode: 'insensitive' } },
          { name: { contains: sanitizedSearch, mode: 'insensitive' } },
        ];
      }
    }

    // ✅ General search
    if (search && searchFields.length > 0) {
      where.OR = [
        ...(where.OR || []),
        ...searchFields.map((field) => ({
          [field]: { contains: search, mode: 'insensitive' },
        })),
      ];
    }

    // ✅ Sorting
    const orderBy: Prisma.UserOrderByWithRelationInput = {};
    if (sortBy) {
      orderBy[sortBy as keyof Prisma.UserOrderByWithRelationInput] = sortOrder || 'desc';
    } else {
      orderBy.createdAt = 'desc';
    }

    // ✅ Fetch data + count
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
          userRoles: { include: { role: true } },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    // ✅ Pagination Meta
    const meta = createPaginationMeta(total, page, limit);

    // Map roles to flat array
    const mappedData = data.map((u) => ({
      ...u,
      roles: u.userRoles.map((ur) => ur.role.name),
    }));

    return {
      meta,
      data: mappedData,
    };
  }

  async create(
    userData: Prisma.UserCreateInput & {
      businessName?: string;
      businessPhone?: string;
      businessEmail?: string;
      businessWebsite?: string;
      businessDescription?: string;
      businessAddress?: string;
      tenantId?: string;
      role?: string;
      // Manager specific fields
      monthlyTarget?: number;
      commissionType?: string;
      commissionValue?: number;
      region?: string;
      country?: string;
    },
  ) {
    const {
      businessName,
      businessPhone,
      businessEmail,
      businessWebsite,
      businessDescription,
      businessAddress,
      role: roleName,
      ...userDataOnly
    } = userData;

    if (userDataOnly.passwordHash) {
      // ...
    } else if ((userDataOnly as any).password) {
      userDataOnly.passwordHash = await PasswordUtil.hashPassword((userDataOnly as any).password);
      delete (userDataOnly as any).password;
    }

    // Logic to resolve/create Role
    let roleId = null;
    if (roleName && userData.tenantId) {
      let role = await prisma.role.findFirst({
        where: { tenantId: userData.tenantId, name: roleName },
      });
      if (!role) {
        role = await prisma.role.create({
          data: {
            name: roleName,
            tenantId: userData.tenantId!,
          },
        });
      }
      roleId = role.id;
    }

    const createData: any = { ...userDataOnly };
    if (userData.tenantId) {
      createData.tenantId = userData.tenantId;
    }
    if (roleId) {
      createData.userRoles = {
        create: { roleId },
      };
    }

    const user = await prisma.user.create({
      data: createData,
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
        userRoles: { include: { role: true } },
      },
    });

    // Check role by name to trigger side effects
    const roles = user.userRoles.map((ur) => ur.role.name);
    const isManager = roles.includes('MANAGER') || roles.includes('Manager');
    const isAdvertiser = roles.includes('ADVERTISER') || roles.includes('Advertiser');
    const isAffiliate = roles.includes('AFFILIATE') || roles.includes('Affiliate');

    if (isAdvertiser && businessName) {
      // ... (existing advertiser logic)
    }

    if (isManager) {
      // Create manager profile with defaults or provided values
      const managerData: any = {
        userId: user.id,
        tenantId: user.tenantId,
      };
      if (userData.monthlyTarget) managerData.monthlyTarget = userData.monthlyTarget;
      if (userData.commissionType) managerData.commissionType = userData.commissionType;
      if (userData.commissionValue) managerData.commissionValue = userData.commissionValue;
      if (userData.region) managerData.region = userData.region;
      if (userData.country) managerData.country = userData.country;

      const manager = await prisma.manager.create({
        data: managerData,
      });

      return { ...user, roles, manager };
    }

    if (isAffiliate) {
      // ... (existing affiliate logic)
    }

    return { ...user, roles };
  }

  async update(
    id: string,
    data: Prisma.UserUpdateInput & {
      businessName?: string;
      role?: string;
      monthlyTarget?: number;
      commissionType?: 'FIXED' | 'PERCENTAGE';
      commissionValue?: number;
      region?: string;
      country?: string;
    },
  ) {
    if ((data as any).avatarFile && typeof (data as any).avatarFile === 'string') {
      (data as any).avatarFileId = (data as any).avatarFile;
      delete (data as any).avatarFile;
    }

    const {
      businessName,
      role,
      monthlyTarget,
      commissionType,
      commissionValue,
      region,
      country,
      ...userData
    } = data;

    if ((userData as any).password) {
      userData.passwordHash = await PasswordUtil.hashPassword((userData as any).password);
      delete (userData as any).password;
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
        userRoles: { include: { role: true } },
      },
    });

    if (!user) {
      throw ApiError.NotFound('User not found', 'user.not_found');
    }

    const roles = user.userRoles.map((ur) => ur.role.name);
    const isAdvertiser = roles.includes('ADVERTISER') || roles.includes('Advertiser');
    const isManager = roles.includes('MANAGER') || roles.includes('Manager');

    if (isAdvertiser && businessName) {
      // ... (existing advertiser update logic)
    }

    if (isManager) {
      const manager = await prisma.manager.findUnique({ where: { userId: id } });
      if (manager) {
        const updateManagerData: any = {};
        if (monthlyTarget !== undefined) updateManagerData.monthlyTarget = monthlyTarget;
        if (commissionType) updateManagerData.commissionType = commissionType;
        if (commissionValue !== undefined) updateManagerData.commissionValue = commissionValue;
        if (region !== undefined) updateManagerData.region = region;
        if (country !== undefined) updateManagerData.country = country;

        if (Object.keys(updateManagerData).length > 0) {
          await prisma.manager.update({
            where: { id: manager.id },
            data: updateManagerData,
          });
        }

        return {
          ...user,
          roles,
          manager: await prisma.manager.findUnique({ where: { id: manager.id } }),
        };
      } else {
        // If manager profile doesn't exist but user is manager (e.g. old data), create it
        const manager = await prisma.manager.create({
          data: {
            userId: id,
            tenantId: user.tenantId,
            monthlyTarget: monthlyTarget || 0,
            commissionType: commissionType || CommissionType.PERCENTAGE,
            commissionValue: commissionValue || 0,
            region,
            country,
          },
        });
        return { ...user, roles, manager };
      }
    }

    return { ...user, roles };
  }

  async softDelete(id: string) {
    const user = await prisma.user.update({
      where: { id },
      data: { deletedAt: new Date(), status: 'INACTIVE' },
    });
    return user;
  }

  async restore(id: string) {
    const user = await prisma.user.update({
      where: { id },
      data: { deletedAt: null, status: 'ACTIVE' },
    });
    return user;
  }

  async hardDelete(id: string) {
    await prisma.user.delete({
      where: { id },
    });
    return true;
  }

  async deactivateUser(id: string) {
    const user = await prisma.user.update({
      where: { id },
      data: { status: 'INACTIVE' },
    });
    return user;
  }

  async updateUserProfile(userId: string, updateData: any) {
    return await this.update(userId, updateData);
  }

  async getCurrentUserProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
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
        userRoles: { include: { role: true } },
        advertiserProfile: {
          select: {
            companyName: true,
          },
        },
        affiliateProfile: true,
      },
    });

    if (!user) {
      throw ApiError.NotFound('User not found', 'user.not_found');
    }

    const roles = user.userRoles.map((ur) => ur.role.name);
    const profiles: any = {};

    if (user.advertiserProfile) {
      profiles.advertiser = user.advertiserProfile;
    }
    if (user.affiliateProfile) {
      profiles.affiliate = user.affiliateProfile;
    }

    const userWithProfiles: any = { ...user, roles, ...profiles };

    const isAdvertiser = roles.includes('ADVERTISER') || roles.includes('Advertiser');
    const isAffiliate = roles.includes('AFFILIATE') || roles.includes('Affiliate');

    if (isAdvertiser && userWithProfiles.advertiserProfile) {
      userWithProfiles.businessName = userWithProfiles.advertiserProfile.companyName;
    } else if (isAffiliate && userWithProfiles.affiliateProfile) {
      userWithProfiles.customerInfo = userWithProfiles.affiliateProfile;
    }

    return userWithProfiles;
  }

  async changePassword(userId: string, oldPassword: string, newPassword: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, passwordHash: true },
    });

    if (!user || !user.passwordHash) {
      throw ApiError.Unauthorized('Invalid user', 'auth.invalid_user');
    }

    const isMatch = await PasswordUtil.comparePasswords(oldPassword, user.passwordHash);
    if (!isMatch) {
      throw ApiError.Unauthorized('Invalid old password', 'auth.invalid_password');
    }

    const hashedPassword = await PasswordUtil.hashPassword(newPassword);

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: hashedPassword },
      select: {
        id: true,
        userRoles: { include: { role: true } },
      },
    });

    return { ...updatedUser, roles: updatedUser.userRoles.map((ur) => ur.role.name) };
  }
}
