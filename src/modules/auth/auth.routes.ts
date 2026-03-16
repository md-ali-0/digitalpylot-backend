import { authenticate } from '@middlewares/auth.middleware';
import { authRateLimiter } from '@middlewares/rate-limit.middleware';
import { validate } from '@middlewares/validation.middleware';
import { Router } from 'express';
import { AuthController } from './auth.controller';
import {
  advertiserRegisterSchema,
  companyRegisterSchema,
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resendVerificationSchema,
  resetPasswordSchema,
  verifyEmailSchema,
} from './auth.validation';

export class AuthRoutes {
  public router: Router;
  private authController: AuthController;

  constructor() {
    this.router = Router();
    this.authController = new AuthController();
    this.initializeRoutes();
  }

  private initializeRoutes() {
    this.router.post(
      '/register',
      authRateLimiter,
      validate(registerSchema),
      this.authController.register,
    );

    this.router.post(
      '/register/company',
      authRateLimiter,
      validate(companyRegisterSchema),
      this.authController.registerCompany,
    );

    this.router.post(
      '/register/advertiser',
      authRateLimiter,
      validate(advertiserRegisterSchema),
      this.authController.registerAdvertiser,
    );

    this.router.post('/login', authRateLimiter, validate(loginSchema), this.authController.login);
    this.router.post('/logout', authenticate, this.authController.logout);
    this.router.post('/refresh-token', authRateLimiter, this.authController.refreshToken);

    // Email verification routes
    this.router.post('/verify-email', validate(verifyEmailSchema), this.authController.verifyEmail);
    this.router.post(
      '/resend-verification',
      authRateLimiter,
      validate(resendVerificationSchema),
      this.authController.resendVerificationEmail,
    );

    // Password reset routes
    this.router.post(
      '/forgot-password',
      authRateLimiter,
      validate(forgotPasswordSchema),
      this.authController.forgotPassword,
    );
    this.router.post(
      '/reset-password',
      validate(resetPasswordSchema),
      this.authController.resetPassword,
    );
  }
}
