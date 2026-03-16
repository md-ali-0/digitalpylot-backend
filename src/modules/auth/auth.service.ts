import prisma from '@config/db';
import i18n from '@config/i18n-compat';
import { BaseService } from '@core/base.service';
import { ApiError } from '@core/error.classes';
import { UserRole } from '@prisma/client';
import { RbacService } from '@services/rbac.service';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} from '@utils/jwt.util';
import { PasswordUtil } from '@utils/password.util';
import {
  generatePasswordResetToken,
  verifyPasswordResetToken,
  verifyUserVerificationToken,
} from '@utils/verification.util';
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

  private async ensureRole(name: string) {
    const existing = await this.prisma.role.findFirst({ where: { name } });
    if (existing) {
      return existing;
    }

    return this.prisma.role.create({ data: { name } });
  }

  private mapUserTypeToRole(userType?: string) {
    return userType?.toUpperCase() === 'ADMIN' ? 'Admin' : 'User';
  }

  async register(userData: RegisterBody & { tenantId: string }) {
    const existingUser = await this.prisma.user.findFirst({
      where: { email: userData.email, tenantId: userData.tenantId },
    });

    if (existingUser) {
      throw ApiError.Conflict('Email already in use', 'auth.email_in_use');
    }

    const passwordHash = await PasswordUtil.hashPassword(userData.password);
    const role = await this.ensureRole(this.mapUserTypeToRole(userData.userType));

    const user = await this.prisma.user.create({
      data: {
        email: userData.email,
        name: userData.name,
        passwordHash,
        tenantId: userData.tenantId,
        userType: userData.userType?.toUpperCase() === 'ADMIN' ? UserRole.ADMIN : UserRole.USER,
        status: 'PENDING',
        userRoles: {
          create: { roleId: role.id },
        },
      },
      include: { userRoles: { include: { role: true } } },
    });

    const roles = user.userRoles.map((ur) => ur.role.name);
    const resolvedPermissions = await RbacService.resolveEffectivePermissions(user.id);
    await SendVerificationEmail(user, roles);

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        roles,
        permissions: resolvedPermissions.permissions,
        status: user.status,
        tenantId: user.tenantId,
      },
      accessToken: generateAccessToken({
        userId: user.id,
        email: user.email,
        roles,
        tenantId: user.tenantId,
        permissions: resolvedPermissions.permissions,
      }),
      refreshToken: generateRefreshToken({
        userId: user.id,
        tokenVersion: user.tokenVersion,
        tenantId: user.tenantId,
      }),
      affiliate: null,
    };
  }

  async registerCompany(data: CompanyRegisterBody) {
    return this.register({
      email: data.email,
      name: data.name,
      password: data.password,
      tenantId: data.subdomain || 'default',
      userType: 'ADMIN',
    });
  }

  async registerAdvertiser(data: AdvertiserRegisterBody & { tenantId: string }) {
    return this.register({
      email: data.email,
      name: data.name,
      password: data.password,
      tenantId: data.tenantId,
      userType: 'USER',
    });
  }

  async login(
    email: string,
    password: string,
    tenantId: string,
    ip: string,
    userAgent: string,
    platform?: string,
  ) {
    const user = await this.prisma.user.findFirst({
      where: tenantId ? { email, tenantId } : { email },
      include: { userRoles: { include: { role: true } } },
    });

    if (!user || user.deletedAt) {
      throw ApiError.Unauthorized('Invalid credentials', 'auth.invalid_credentials');
    }

    const isPasswordValid = await PasswordUtil.comparePasswords(password, user.passwordHash);
    if (!isPasswordValid) {
      throw ApiError.Unauthorized('Invalid credentials', 'auth.invalid_credentials');
    }

    if (user.status === 'PENDING') {
      throw ApiError.Forbidden('Account pending approval', 'auth.account_pending');
    }
    if (user.status !== 'ACTIVE') {
      throw ApiError.Forbidden('Account inactive', 'auth.account_inactive');
    }

    const roles = user.userRoles.map((ur) => ur.role.name);
    const resolvedPermissions = await RbacService.resolveEffectivePermissions(user.id);

    await RbacService.createAuditLog({
      tenantId: user.tenantId,
      userId: user.id,
      action: 'USER_LOGIN',
      resourceType: 'User',
      resourceId: user.id,
      changes: { platform },
      ipAddress: ip,
      userAgent,
    });

    return {
      accessToken: generateAccessToken({
        userId: user.id,
        email: user.email,
        roles,
        tenantId: user.tenantId,
        permissions: resolvedPermissions.permissions,
      }),
      refreshToken: generateRefreshToken({
        userId: user.id,
        tokenVersion: user.tokenVersion,
        tenantId: user.tenantId,
      }),
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        roles,
        permissions: resolvedPermissions.permissions,
        tenantId: user.tenantId,
        status: user.status,
      },
      profile: null,
      affiliate: null,
      advertiser: null,
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

    await this.prisma.user.update({
      where: { id: user.id },
      data: { emailVerified: true, status: user.status === 'PENDING' ? 'ACTIVE' : user.status },
    });

    return {
      message: i18n.__('auth.email_verified_success'),
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        roles: user.userRoles.map((ur) => ur.role.name),
        status: user.status,
        emailVerified: true,
      },
      advertiser: null,
    };
  }

  async resendVerificationEmail(email: string, tenantId?: string) {
    const user = await this.prisma.user.findFirst({
      where: tenantId ? { email, tenantId } : { email },
      include: { userRoles: { include: { role: true } } },
    });

    if (!user) {
      throw ApiError.NotFound('User not found', 'user.not_found');
    }

    const roles = user.userRoles.map((ur) => ur.role.name);
    await SendVerificationEmail(user, roles);

    return {
      message: i18n.__('auth.verification_email_sent_success'),
    };
  }

  async forgotPassword({ email, tenantId }: ForgotPasswordBody) {
    const user = await this.prisma.user.findFirst({
      where: tenantId ? { email, tenantId } : { email },
    });

    if (user) {
      generatePasswordResetToken({
        userId: user.id,
        email: user.email,
        type: 'password-reset',
      });
    }

    return {
      message:
        'If your email exists in our system, you will receive a password reset link shortly.',
    };
  }

  async resetPassword({ token, password }: ResetPasswordBody) {
    const resetPayload = verifyPasswordResetToken(token);
    const user = await this.prisma.user.findUnique({ where: { id: resetPayload.userId } });

    if (!user) {
      throw ApiError.NotFound('User not found', 'user.not_found');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await PasswordUtil.hashPassword(password) },
    });

    return {
      message: i18n.__('auth.password_reset_success'),
    };
  }

  async refreshAccessToken(refreshToken: string) {
    const decoded = verifyRefreshToken(refreshToken);
    const user = await this.prisma.user.findUnique({
      where: { id: decoded.userId },
      include: { userRoles: { include: { role: true } } },
    });

    if (!user || user.deletedAt) {
      throw ApiError.Unauthorized('Invalid refresh token', 'invalid_refresh_token');
    }

    if (decoded.tokenVersion !== (user.tokenVersion ?? 0)) {
      throw ApiError.Unauthorized('Refresh token revoked', 'auth.refresh_token_revoked');
    }

    const roles = user.userRoles.map((ur) => ur.role.name);
    const resolvedPermissions = await RbacService.resolveEffectivePermissions(user.id);

    return {
      accessToken: generateAccessToken({
        userId: user.id,
        email: user.email,
        roles,
        tenantId: user.tenantId,
        permissions: resolvedPermissions.permissions,
      }),
      refreshToken: generateRefreshToken({
        userId: user.id,
        tokenVersion: user.tokenVersion ?? 0,
        tenantId: user.tenantId,
      }),
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
  }
}
