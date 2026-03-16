import prisma from '@config/db';
import i18n from '@config/i18n-compat';
import logger from '@config/winston';
import { BaseService } from '@core/base.service';
import { ApiError } from '@core/error.classes';
import { addPasswordResetEmailJob } from '@jobs/queue';
import { UserRole } from '@prisma/client';
import emailService from '@services/email.service';
import { RbacService } from '@services/rbac.service';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '@utils/jwt.util';

import { PasswordUtil } from '@utils/password.util';
import {
  generatePasswordResetToken,
  verifyPasswordResetToken,
  verifyUserVerificationToken,
} from '@utils/verification.util';
import slugify from 'slugify';
import type {
  AdvertiserRegisterBody,
  CompanyRegisterBody,
  ForgotPasswordBody,
  RegisterBody,
  ResetPasswordBody,
} from './auth.interface';
import { SendVerificationEmail } from './auth.utils';

export class AuthService extends BaseService {
  constructor() {
    super(prisma);
  }

  async register(userData: RegisterBody & { tenantId: string }) {
    let resolvedTenantId = userData.tenantId;

    if (userData.tenantId) {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        userData.tenantId,
      );
      if (!isUuid) {
        const tenant = await this.prisma.tenant.findUnique({ where: { slug: userData.tenantId } });
        if (tenant) {
          resolvedTenantId = tenant.id;
        } else {
          throw ApiError.BadRequest('Invalid Tenant', 'auth.invalid_tenant');
        }
      }
    }

    const existingUser = await this.prisma.user.findUnique({
      where: {
        tenantId_email: {
          tenantId: resolvedTenantId,
          email: userData.email,
        },
      },
    });

    if (existingUser) {
      throw ApiError.Conflict('Email already in use', 'auth.email_in_use');
    }

    const hashedPassword = await PasswordUtil.hashPassword(userData.password);

    // Determine Role and UserType
    const userTypeInput = (userData.userType as UserRole) || UserRole.AFFILIATE;
    let roleName = 'Affiliate';

    switch (userTypeInput) {
      case UserRole.ADVERTISER:
        roleName = 'Advertiser';
        break;
      case UserRole.ADMIN:
        roleName = 'Admin';
        break;
      case UserRole.SUPER_ADMIN:
        roleName = 'Super Admin';
        break;
      case UserRole.MANAGER:
        roleName = 'Manager';
        break;
      default:
        roleName = 'Affiliate';
    }

    // Find Role
    let role = await this.prisma.role.findFirst({
      where: { tenantId: resolvedTenantId, name: roleName },
    });

    if (!role) {
      role = await this.prisma.role.create({
        data: {
          name: roleName,
          tenantId: resolvedTenantId,
          permissions: {
            create:
              userTypeInput === UserRole.AFFILIATE
                ? [{ permissionId: 'offer.read' }, { permissionId: 'report.read' }]
                : [], // Add default permissions for other roles if needed
          },
        },
      });
    }

    // Transaction to create User + Profile
    const [user, affiliate] = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          tenantId: resolvedTenantId,
          email: userData.email,
          name: userData.name,
          passwordHash: hashedPassword,
          status: 'PENDING',
          userType: userTypeInput,
          userRoles: {
            create: { roleId: role.id },
          },
        },
        include: { userRoles: { include: { role: true } } },
      });

      let affiliate = null;
      if (userTypeInput === UserRole.AFFILIATE) {
        affiliate = await tx.affiliate.create({
          data: {
            tenantId: resolvedTenantId,
            userId: user.id,
            status: 'PENDING',
            metadata: {
              website: userData.website,
              niche: userData.niche,
              trafficSource: userData.trafficSource,
              ...userData.additionalInfo,
            },
          },
        });
      }

      return [user, affiliate] as const;
    });

    // Verification Email
    const roles = user.userRoles.map((ur) => ur.role.name);
    await SendVerificationEmail(user, roles);

    return {
      user: { ...user, roles },
      accessToken: generateAccessToken({
        userId: user.id,
        email: user.email,
        roles: roles,
        tenantId: user.tenantId,
      }),
      refreshToken: generateRefreshToken({
        userId: user.id,
        tokenVersion: user.tokenVersion || 0,
        tenantId: user.tenantId,
      }),
      affiliate,
    };
  }

  async registerCompany(data: CompanyRegisterBody): Promise<any> {
    const existingUser = await this.prisma.user.findFirst({ where: { email: data.email } });
    if (existingUser) throw ApiError.Conflict('Email already in use', 'auth.email_in_use');

    const slug = data.subdomain || slugify(data.companyName, { lower: true });
    const existingTenant = await this.prisma.tenant.findUnique({ where: { slug } });
    if (existingTenant) {
      throw ApiError.Conflict(
        'Subdomain or company name is already taken. Please choose a different one.',
        'auth.subdomain_taken',
      );
    }

    // Default admin permissions (exclude platform-level ones)
    const adminPermissionIds = [
      'offer.read',
      'offer.create',
      'offer.update',
      'offer.delete',
      'report.read',
      'affiliate.read',
      'affiliate.approve',
      'advertiser.read',
      'advertiser.approve',
      'billing.read',
      'billing.manage',
    ];

    // Create Tenant, Roles, Admin User, and Trial Subscription
    const [tenant, user] = await this.prisma.$transaction(async (tx) => {
      // 1. Create Tenant
      const tenant = await tx.tenant.create({
        data: {
          name: data.companyName,
          slug,
          customDomain: data.subdomain ?? undefined,
          status: 'ACTIVE',
        },
      });

      // 2. Create Default Roles with Permissions
      const adminRole = await tx.role.create({
        data: {
          name: 'Admin',
          tenantId: tenant.id,
          permissions: {
            create: adminPermissionIds.map((p) => ({ permissionId: p })),
          },
        },
      });

      await tx.role.createMany({
        data: [
          { name: 'Manager', tenantId: tenant.id },
          { name: 'Affiliate', tenantId: tenant.id },
          { name: 'Advertiser', tenantId: tenant.id },
        ],
      });

      // Assign basic permissions to Manager role
      const managerRole = await tx.role.findFirst({
        where: { tenantId: tenant.id, name: 'Manager' },
      });
      if (managerRole) {
        await tx.rolePermission.createMany({
          data: [
            { roleId: managerRole.id, permissionId: 'offer.read' },
            { roleId: managerRole.id, permissionId: 'offer.create' },
            { roleId: managerRole.id, permissionId: 'offer.update' },
            { roleId: managerRole.id, permissionId: 'report.read' },
            { roleId: managerRole.id, permissionId: 'affiliate.read' },
            { roleId: managerRole.id, permissionId: 'affiliate.approve' },
          ],
        });
      }

      // Assign basic permissions to Affiliate role
      const affiliateRole = await tx.role.findFirst({
        where: { tenantId: tenant.id, name: 'Affiliate' },
      });
      if (affiliateRole) {
        await tx.rolePermission.createMany({
          data: [
            { roleId: affiliateRole.id, permissionId: 'offer.read' },
            { roleId: affiliateRole.id, permissionId: 'report.read' },
          ],
        });
      }

      // Assign basic permissions to Advertiser role
      const advertiserRole = await tx.role.findFirst({
        where: { tenantId: tenant.id, name: 'Advertiser' },
      });
      if (advertiserRole) {
        await tx.rolePermission.createMany({
          data: [
            { roleId: advertiserRole.id, permissionId: 'offer.read' },
            { roleId: advertiserRole.id, permissionId: 'offer.create' },
            { roleId: advertiserRole.id, permissionId: 'report.read' },
          ],
        });
      }

      // 3. Create Admin User (immediately active, email verified)
      const hashedPassword = await PasswordUtil.hashPassword(data.password);

      const user = await tx.user.create({
        data: {
          tenantId: tenant.id,
          email: data.email,
          name: data.name,
          passwordHash: hashedPassword,
          status: 'ACTIVE',
          emailVerified: true,
          userType: UserRole.ADMIN,
          userRoles: {
            create: { roleId: adminRole.id },
          },
        },
        include: { userRoles: { include: { role: true } } },
      });

      // 4. Auto-create Trial Subscription (14-day trial)
      const freePlan = await tx.subscriptionPlan.findUnique({
        where: { slug: 'free' },
      });

      if (freePlan) {
        const now = new Date();
        const trialEnd = new Date(now);
        trialEnd.setDate(trialEnd.getDate() + 14);
        const nextBilling = new Date(trialEnd);
        nextBilling.setMonth(nextBilling.getMonth() + 1);

        await tx.subscription.create({
          data: {
            tenantId: tenant.id,
            planId: freePlan.id,
            status: 'TRIALING',
            startDate: now,
            nextBillingDate: nextBilling,
            amount: freePlan.price,
            currency: freePlan.currency,
            billingCycle: freePlan.billingCycle,
            trialEndsAt: trialEnd,
          },
        });
      }

      return [tenant, user] as const;
    });

    const roles = user.userRoles.map((ur) => ur.role.name);

    return {
      message: 'Company registered successfully.',
      tenant,
      user: { ...user, roles },
      accessToken: generateAccessToken({
        userId: user.id,
        email: user.email,
        roles: roles,
        tenantId: user.tenantId,
      }),
      refreshToken: generateRefreshToken({
        userId: user.id,
        tokenVersion: user.tokenVersion || 0,
        tenantId: user.tenantId,
      }),
    };
  }

  async registerAdvertiser(data: AdvertiserRegisterBody & { tenantId: string }) {
    let resolvedTenantId = data.tenantId;

    if (data.tenantId) {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        data.tenantId,
      );
      if (!isUuid) {
        const tenant = await this.prisma.tenant.findUnique({ where: { slug: data.tenantId } });
        if (tenant) {
          resolvedTenantId = tenant.id;
        } else {
          throw ApiError.BadRequest('Invalid Tenant', 'auth.invalid_tenant');
        }
      }
    }

    const existingUser = await this.prisma.user.findUnique({
      where: {
        tenantId_email: {
          tenantId: resolvedTenantId,
          email: data.email,
        },
      },
    });

    if (existingUser) throw ApiError.Conflict('User already exists', 'auth.user_exists');

    const hashedPassword = await PasswordUtil.hashPassword(data.password);

    // Find Advertiser Role
    let advertiserRole = await this.prisma.role.findFirst({
      where: { tenantId: resolvedTenantId, name: 'Advertiser' },
    });
    if (!advertiserRole) {
      advertiserRole = await this.prisma.role.create({
        data: {
          name: 'Advertiser',
          tenantId: resolvedTenantId,
        },
      });
    }

    const [user, advertiser] = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          tenantId: resolvedTenantId,
          email: data.email,
          name: data.name,
          passwordHash: hashedPassword,
          status: 'ACTIVE',
          emailVerified: false,
          userType: UserRole.ADVERTISER,
          userRoles: {
            create: { roleId: advertiserRole.id },
          },
        },
        include: { userRoles: { include: { role: true } } },
      });

      const advertiser = await tx.advertiser.create({
        data: {
          tenantId: resolvedTenantId,
          userId: user.id,
          companyName: data.companyName,
          status: 'PENDING',
        },
      });
      return [user, advertiser] as const;
    });

    const roles = user.userRoles.map((ur) => ur.role.name);
    await SendVerificationEmail(user, roles);

    // Send Advertiser Application Received Email
    try {
      await emailService.sendAdvertiserApplicationReceived(
        user.email,
        user.name || 'Advertiser',
        advertiser.companyName,
      );
    } catch (error) {
      logger.error('Failed to send advertiser application email:', error);
    }

    return {
      user: { ...user, roles },
      advertiser,
      message: 'Advertiser registered. Please verify your email.',
      accessToken: generateAccessToken({
        userId: user.id,
        email: user.email,
        roles: roles,
        tenantId: user.tenantId,
      }),
      refreshToken: generateRefreshToken({
        userId: user.id,
        tokenVersion: user.tokenVersion || 0,
        tenantId: user.tenantId,
      }),
    };
  }

  async login(
    email: string,
    password: string,
    tenantId: string,
    ip: string,
    userAgent: string,
    platform?: string,
  ) {
    let resolvedTenantId = tenantId;

    // If tenantId is provided, resolve it (slug to UUID)
    if (tenantId) {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        tenantId,
      );
      if (!isUuid) {
        const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantId } });
        if (tenant) {
          resolvedTenantId = tenant.id;
        }
      }
    }

    // If no tenantId provided, try to find user by email across all tenants
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let user: any;
    if (!resolvedTenantId) {
      // Find user by email only (without tenant constraint)
      const users = await this.prisma.user.findMany({
        where: { email },
        include: {
          affiliateProfile: true,
          advertiserProfile: true,
          userRoles: { include: { role: true } },
        },
      });

      if (users.length === 1) {
        // Only one user with this email, use it
        user = users[0];
        resolvedTenantId = user.tenantId;
      } else if (users.length > 1) {
        // Multiple users with same email in different tenants
        logger.warn(
          `Multiple users found for email: ${email}. Please specify tenant. Found in tenants: ${users.map((u) => u.tenantId).join(', ')}`,
        );
        throw ApiError.BadRequest(
          'Multiple accounts found. Please specify tenant.',
          'auth.multiple_accounts',
        );
      }
      // If users.length === 0, user will remain undefined and handled below
    } else {
      // Tenant is specified, find user with tenant constraint
      user = await this.prisma.user.findUnique({
        where: {
          tenantId_email: { tenantId: resolvedTenantId, email },
        },
        include: {
          affiliateProfile: true,
          advertiserProfile: true,
          userRoles: { include: { role: true } },
        },
      });
    }

    if (!user) {
      logger.warn(
        `Login failed: User not found for email: ${email} and tenant: ${tenantId} (resolved: ${resolvedTenantId})`,
      );
    }

    const logHistory = async (status: boolean) => {
      if (user) {
        await this.prisma.loginHistory.create({
          data: {
            tenantId: user.tenantId,
            userId: user.id,
            ipAddress: ip,
            userAgent: userAgent,
            isSuccessful: status,
          },
        });
      }
    };

    if (!user || user.deletedAt) {
      await logHistory(false);
      throw ApiError.Unauthorized('Invalid credentials', 'auth.invalid_credentials');
    }

    if (!user.passwordHash) {
      await logHistory(false);
      throw ApiError.InternalServerError('Password not set for user', 'internal_server_error');
    }

    const isPasswordValid = await PasswordUtil.comparePasswords(password, user.passwordHash);
    if (!isPasswordValid) {
      await logHistory(false);
      throw ApiError.Unauthorized('Invalid credentials', 'auth.invalid_credentials');
    }

    // Platform-based access control: aff-saas (admin) only allows SUPER_ADMIN
    if (platform === 'admin' && user.userType !== 'SUPER_ADMIN') {
      await logHistory(false);
      throw ApiError.Forbidden(
        'Access denied. Only platform administrators can access the admin panel.',
        'auth.admin_access_denied',
      );
    }

    // Client app should not allow SUPER_ADMIN to login (they use aff-saas)
    if (platform === 'client' && user.userType === 'SUPER_ADMIN') {
      await logHistory(false);
      throw ApiError.Forbidden('Please use the admin panel to login.', 'auth.use_admin_panel');
    }

    if (user.status === 'PENDING')
      throw ApiError.Forbidden('Account pending approval', 'auth.account_pending');
    if (user.status !== 'ACTIVE')
      throw ApiError.Forbidden('Account inactive', 'auth.account_inactive');
    if (!user.emailVerified)
      throw ApiError.Forbidden('Email not verified', 'auth.email_not_verified');

    await logHistory(true);

    const roles = user.userRoles.map((ur: any) => ur.role.name);
    const resolvedPermissions = await RbacService.resolveEffectivePermissions(user.id);

    const accessToken = generateAccessToken({
      userId: user.id,
      email: user.email,
      roles: roles,
      tenantId: user.tenantId,
      permissions: resolvedPermissions.permissions,
    });

    const refreshToken = generateRefreshToken({
      userId: user.id,
      tokenVersion: user.tokenVersion || 0,
      tenantId: user.tenantId,
    });

    const isAffiliate = roles.includes('AFFILIATE') || roles.includes('Affiliate');
    const isAdvertiser = roles.includes('ADVERTISER') || roles.includes('Advertiser');

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        roles: roles,
        permissions: resolvedPermissions.permissions,
        tenantId: user.tenantId,
        status: user.status,
      },
      profile: isAffiliate ? user.affiliateProfile : isAdvertiser ? user.advertiserProfile : null,
      affiliate: user.affiliateProfile,
      advertiser: user.advertiserProfile,
    };
  }

  async verifyEmail(token: string) {
    const verificationPayload = verifyUserVerificationToken(token);

    const user = await this.prisma.user.findUnique({
      where: { id: verificationPayload.userId },
      include: { userRoles: { include: { role: true } } },
    });

    if (!user) {
      throw ApiError.NotFound('User not found', 'user.not_found');
    }

    const roles = user.userRoles.map((ur) => ur.role.name);
    const isAdvertiser = roles.includes('ADVERTISER') || roles.includes('Advertiser');
    const isAffiliate = roles.includes('AFFILIATE') || roles.includes('Affiliate');

    if (user.emailVerified) {
      return {
        message: 'Email is already verified.',
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          roles: roles,
          status: user.status,
          emailVerified: user.emailVerified,
        },
      };
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
      },
    });

    let advertiserData = null;
    if (isAdvertiser) {
      const advertiser = await this.prisma.advertiser.findUnique({
        where: { userId: user.id },
      });

      if (advertiser) {
        advertiserData = {
          id: advertiser.id,
          companyName: advertiser.companyName,
          status: advertiser.status,
        };
      }
    }

    if (isAffiliate) {
      try {
        await emailService.sendAffiliateApplicationReceived(user.email, user.name || 'Affiliate');
      } catch (error) {
        logger.error('Failed to send affiliate application email:', error);
      }
    }

    return {
      message: i18n.__('auth.email_verified_success'),
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        roles: roles,
        status: user.status,
        emailVerified: user.emailVerified,
      },
      advertiser: advertiserData,
    };
  }

  async resendVerificationEmail(email: string, tenantId?: string) {
    let resolvedTenantId: string | undefined;
    if (tenantId) {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        tenantId,
      );
      if (isUuid) {
        resolvedTenantId = tenantId;
      } else {
        const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantId } });
        if (tenant) resolvedTenantId = tenant.id;
      }
    }

    let user;
    if (resolvedTenantId) {
      user = await this.prisma.user.findUnique({
        where: { tenantId_email: { tenantId: resolvedTenantId, email } },
        include: { userRoles: { include: { role: true } } },
      });
    } else {
      const users = await this.prisma.user.findMany({
        where: { email },
        include: { userRoles: { include: { role: true } } },
      });
      if (users.length === 0) {
        throw ApiError.NotFound('User not found', 'user.not_found');
      }
      if (users.length > 1) {
        throw ApiError.BadRequest(
          'Multiple accounts found for this email. Please specify tenant (e.g. x-tenant-id header or tenantId in body).',
          'auth.multiple_accounts',
        );
      }
      user = users[0];
    }

    if (!user) {
      throw ApiError.NotFound('User not found', 'user.not_found');
    }

    if (user.emailVerified) {
      throw ApiError.BadRequest('Email is already verified', 'auth.email_already_verified');
    }

    const roles = user.userRoles.map((ur) => ur.role.name);
    await SendVerificationEmail(user, roles);

    return {
      message: i18n.__('auth.verification_email_sent_success'),
    };
  }

  async forgotPassword({ email, tenantId }: ForgotPasswordBody) {
    let resolvedTenantId: string | undefined;
    if (tenantId) {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        tenantId,
      );
      if (isUuid) {
        resolvedTenantId = tenantId;
      } else {
        const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantId } });
        if (tenant) resolvedTenantId = tenant.id;
      }
    }

    let user;
    if (resolvedTenantId) {
      user = await this.prisma.user.findUnique({
        where: { tenantId_email: { tenantId: resolvedTenantId, email } },
      });
    } else {
      const users = await this.prisma.user.findMany({ where: { email } });
      if (users.length === 0) {
        generatePasswordResetToken({
          userId: 'dummy-user-id',
          email,
          type: 'password-reset',
        });
        return {
          message:
            'If your email exists in our system, you will receive a password reset link shortly.',
        };
      }
      if (users.length > 1) {
        throw ApiError.BadRequest(
          'Multiple accounts found for this email. Please specify tenant (e.g. x-tenant-id header or tenantId in body).',
          'auth.multiple_accounts',
        );
      }
      user = users[0];
    }

    if (!user) {
      generatePasswordResetToken({
        userId: 'dummy-user-id',
        email,
        type: 'password-reset',
      });
      return {
        message:
          'If your email exists in our system, you will receive a password reset link shortly.',
      };
    }

    const resetToken = generatePasswordResetToken({
      userId: user.id,
      email: user.email,
      type: 'password-reset',
    });

    try {
      await addPasswordResetEmailJob(user.email, user.name || 'User', resetToken);
    } catch (error) {
      logger.error('Failed to queue password reset email:', error);
    }

    return {
      message:
        'If your email exists in our system, you will receive a password reset link shortly.',
    };
  }

  async resetPassword({ token, password }: ResetPasswordBody) {
    const resetPayload = verifyPasswordResetToken(token);

    const user = await this.prisma.user.findUnique({
      where: { id: resetPayload.userId },
    });

    if (!user) {
      throw ApiError.NotFound('User not found', 'user.not_found');
    }

    const hashedPassword = await PasswordUtil.hashPassword(password);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: hashedPassword },
    });

    return {
      message: i18n.__('auth.password_reset_success'),
    };
  }

  async refreshAccessToken(refreshToken: string) {
    try {
      const decoded = verifyRefreshToken(refreshToken);
      const user = await this.prisma.user.findUnique({
        where: { id: decoded.userId },
        include: { userRoles: { include: { role: true } } },
      });

      if (!user || user.deletedAt)
        throw ApiError.Unauthorized('Invalid refresh token', 'invalid_refresh_token');

      if (decoded.tokenVersion !== (user.tokenVersion ?? 0))
        throw ApiError.Unauthorized('Refresh token revoked', 'auth.refresh_token_revoked');

      const roles = user.userRoles.map((ur) => ur.role.name);
      const resolvedPermissions = await RbacService.resolveEffectivePermissions(user.id);

      const newAccessToken = generateAccessToken({
        userId: user.id,
        email: user.email,
        roles: roles,
        tenantId: user.tenantId,
        permissions: resolvedPermissions.permissions,
      });

      const newRefreshToken = generateRefreshToken({
        userId: user.id,
        tokenVersion: user.tokenVersion || 0,
        tenantId: user.tenantId,
      });

      return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          roles,
          permissions: resolvedPermissions.permissions,
          tenantId: user.tenantId,
          status: user.status,
        },
      };
    } catch {
      throw ApiError.Unauthorized('Invalid refresh token', 'invalid_refresh_token');
    }
  }
}
