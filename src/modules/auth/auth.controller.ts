import { HTTP_STATUS } from '@config/constants';
import env from '@config/env';
import i18n from '@config/i18n-compat';
import { BaseController } from '@core/base.controller';
import { User } from '@prisma/client';
import { generateAccessToken, generateRefreshToken } from '@utils/jwt.util';
import type { NextFunction, Request, Response } from 'express';
import type {
  AccessTokenPayload,
  AdvertiserRegisterInput,
  CompanyRegisterInput,
  ForgotPasswordInput,
  LoginInput,
  RegisterInput,
  ResendVerificationInput,
  ResetPasswordInput,
  VerifyEmailInput,
} from './auth.interface';
import { AuthService } from './auth.service';

export class AuthController extends BaseController {
  private authService: AuthService;

  constructor() {
    const authService = new AuthService();
    super(authService);
    this.authService = authService;
  }

  register = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { body }: RegisterInput = req;
      const tenantId = req.headers['x-tenant-id'] as string;

      const { user, accessToken, refreshToken, affiliate } = await this.authService.register({
        ...body,
        tenantId,
      });

      this.sendResponse(res, {
        message: i18n.__('auth.register_success'),
        data: { user, accessToken, refreshToken, affiliate },
      });
    } catch (error) {
      next(error);
    }
  };

  registerCompany = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { body }: CompanyRegisterInput = req;
      const result = await this.authService.registerCompany(body);
      this.sendResponse(res, {
        message: result.message,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  registerAdvertiser = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { body }: AdvertiserRegisterInput = req;
      const tenantId = req.headers['x-tenant-id'] as string;
      const result = await this.authService.registerAdvertiser({ ...body, tenantId });
      this.sendResponse(res, {
        message: result.message,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  verifyEmail = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { body }: VerifyEmailInput = req;
      const result = await this.authService.verifyEmail(body.token);

      this.sendResponse(res, {
        message: result.message,
        data: {
          user: result.user,
          vendor: result.advertiser,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  resendVerificationEmail = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { body }: ResendVerificationInput = req;
      const tenantId = (req.headers['x-tenant-id'] as string) || body.tenantId;
      const result = await this.authService.resendVerificationEmail(body.email, tenantId);

      this.sendResponse(res, {
        message: result.message,
      });
    } catch (error) {
      next(error);
    }
  };

  forgotPassword = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { body }: ForgotPasswordInput = req;
      const tenantId = (req.headers['x-tenant-id'] as string) || body.tenantId;
      const result = await this.authService.forgotPassword({ email: body.email, tenantId });

      this.sendResponse(res, {
        message: result.message,
      });
    } catch (error) {
      next(error);
    }
  };

  resetPassword = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { body }: ResetPasswordInput = req;
      const result = await this.authService.resetPassword(body);

      this.sendResponse(res, {
        message: result.message,
      });
    } catch (error) {
      next(error);
    }
  };

  login = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { body }: LoginInput = req;
      const { email, password, tenantId: bodyTenantId, platform } = body;
      const tenantId = (req.headers['x-tenant-id'] as string) || bodyTenantId || '';
      const ip = req.ip || '0.0.0.0';
      const userAgent = (req.headers['user-agent'] as string) || 'Unknown';

      const { user, accessToken, refreshToken, profile, affiliate, advertiser } =
        await this.authService.login(email, password, tenantId, ip, userAgent, platform);

      res.cookie('accessToken', accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 15 * 60 * 1000,
      });

      res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      this.sendResponse(res, {
        message: i18n.__('auth.login_success'),
        data: { user, accessToken, refreshToken, profile, affiliate, advertiser },
      });
    } catch (error) {
      next(error);
    }
  };

  logout = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.clearCookie('accessToken');
      res.clearCookie('refreshToken');

      this.sendResponse(res, {
        message: i18n.__('auth.logout_success'),
      });
    } catch (error) {
      next(error);
    }
  };

  refreshToken = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const refreshToken = req.cookies.refreshToken;
      if (!refreshToken) {
        return this.sendResponse(res, {
          success: false,
          message: i18n.__('auth.refresh_token_missing'),
          statusCode: HTTP_STATUS.BAD_REQUEST,
          error: {
            path: req.path,
            message: i18n.__('auth.refresh_token_missing'),
          },
        });
      }

      const { accessToken, refreshToken: newRefreshToken } =
        await this.authService.refreshAccessToken(refreshToken);

      res.cookie('accessToken', accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 15 * 60 * 1000,
      });

      res.cookie('refreshToken', newRefreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      this.sendResponse(res, {
        message: i18n.__('auth.token_refresh_success'),
      });
    } catch (error) {
      next(error);
    }
  };

  oauthCallback = async (req: Request, res: Response, next: NextFunction) => {
    try {
      // req.user is populated by Passport after successful authentication
      const user = req.user as User | undefined;

      if (!user || user.deletedAt) {
        return this.sendResponse(res, {
          success: false,
          message: i18n.__('auth.oauth_failed'),
          statusCode: HTTP_STATUS.UNAUTHORIZED,
        });
      }

      // Generate tokens
      // Assumes user from passport has 'roles' or we need to fetch them if passport only populated 'role'
      // user.role is removed. user should have userRoles loaded.
      // If oauth strategy wasn't updated, this might blow up.
      // Safe fallback:
      const roles = (user as any).userRoles
        ? (user as any).userRoles.map((ur: any) => ur.role.name)
        : [];

      const payload: AccessTokenPayload = {
        userId: user.id,
        email: user.email,
        roles: roles,
        tenantId: user.tenantId,
      };
      const accessToken = generateAccessToken(payload);

      const refreshToken = generateRefreshToken({
        userId: user.id,
        tenantId: user.tenantId,
        tokenVersion: user.tokenVersion || 0,
      });

      // Set cookies
      // res.cookie('accessToken', accessToken, {
      //   httpOnly: true,
      //   secure: process.env.NODE_ENV === 'production',
      //   sameSite: 'lax',
      //   maxAge: 15 * 60 * 1000,
      // });

      // res.cookie('refreshToken', refreshToken, {
      //   httpOnly: true,
      //   secure: process.env.NODE_ENV === 'production',
      //   sameSite: 'lax',
      //   maxAge: 7 * 24 * 60 * 60 * 1000,
      // });

      // Redirect to frontend with tokens or send JSON response
      if (req.headers['accept'] && req.headers['accept'].includes('application/json')) {
        // API request, send JSON response
        this.sendResponse(res, {
          message: i18n.__('auth.oauth_success'),
          data: { user, accessToken, refreshToken },
        });
      } else {
        // Browser request, redirect to frontend callback page
        const clientUrl =
          process.env.NODE_ENV === 'production' ? env.CLIENT_URL_PROD : env.CLIENT_URL;

        const redirectUrl = `${clientUrl}/auth/callback?access_token=${accessToken}&refresh_token=${refreshToken}`;

        res.redirect(redirectUrl);
      }
    } catch (error) {
      next(error);
    }
  };
}
