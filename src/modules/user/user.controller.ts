import { HTTP_STATUS } from '@config/constants';
import i18n from '@config/i18n-compat';
import { BaseController } from '@core/base.controller';
import { RbacService } from '@services/rbac.service';
import { GetAllOptions } from '@utils/pagination.util';
import type { Request, Response } from 'express';
import { UserService } from './user.service';
export class UserController extends BaseController {
  protected userService: UserService;

  constructor() {
    super(new UserService());
    this.userService = this.service as UserService;
  }

  getAllUsers = this.catchAsync(async (req: Request, res: Response) => {
    const { filters, search, pagination } = this.parseQuery(req);

    // Get current user's role and tenantId
    const currentUser = req.user;
    const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN';

    // If NOT Super Admin, automatically filter by their tenantId
    if (!isSuperAdmin && currentUser?.tenantId) {
      filters.tenantId = currentUser.tenantId;
    }

    const query: GetAllOptions = {
      filters,
      search,
      searchFields: ['email', 'name'],
      pagination,
    };
    const users = await this.userService.getAllUsers(query);
    this.sendResponse(res, {
      message: i18n.__('user.fetch_all_success'),
      statusCode: HTTP_STATUS.OK,
      data: users.data,
      meta: users.meta,
    });
  });

  getById = this.catchAsync(async (req: Request, res: Response) => {
    const user = await this.userService.findById(req.params.id as string);
    this.sendResponse(res, {
      message: i18n.__('user.fetch_success'),
      data: user,
    });
  });
  /**
   * Get current user's profile (/me)
   */
  getProfile = this.catchAsync(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const user = await this.userService.getCurrentUserProfile(userId);
    this.sendResponse(res, {
      message: i18n.__('user.profile_fetch_success'),
      data: user,
    });
  });

  /**
   * Update current user's profile (customer/vendor handled dynamically)
   */
  updateProfile = this.catchAsync(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const updateData = req.body;
    const updatedUser = await this.userService.updateUserProfile(userId, updateData);
    this.sendResponse(res, {
      message: i18n.__('user.profile_updated'),
      data: updatedUser,
    });
  });

  /**
   * Deactivate current user's profile (customer/vendor)
   */
  deactivateProfile = this.catchAsync(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const updatedUser = await this.userService.deactivateUser(userId);
    this.sendResponse(res, {
      message: i18n.__('user.profile_deactivated'),
      data: updatedUser,
    });
  });

  /**
   * Change user password
   */
  changePassword = this.catchAsync(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const { oldPassword, newPassword } = req.body;

    // Validation is already done by middleware
    const result = await this.userService.changePassword(userId, oldPassword, newPassword);
    this.sendResponse(res, {
      message: i18n.__('user.password_changed'),
      data: result,
    });
  });

  /**
   * Create customer/vendor dynamically depending on role and data
   */
  create = this.catchAsync(async (req: Request, res: Response) => {
    const userData = req.body;

    // Inject tenantId from current user context
    if (req.user?.tenantId) {
      userData.tenantId = req.user.tenantId;
    }

    const newUser = await this.userService.create(userData);
    this.sendResponse(res, {
      message: i18n.__('user.created'),
      data: newUser,
    });
  });

  /**
   * Update customer/vendor dynamically depending on role and data
   */
  update = this.catchAsync(async (req: Request, res: Response) => {
    const { id } = req.params;
    const updateData = req.body;
    const updatedUser = await this.userService.update(id as string, updateData);
    this.sendResponse(res, {
      message: i18n.__('user.updated'),
      data: updatedUser,
    });
  });

  getPermissions = this.catchAsync(async (req: Request, res: Response) => {
    const data = await RbacService.getUserPermissionAssignment(req.params.id as string);
    this.sendResponse(res, {
      message: i18n.__('role.fetch_success'),
      data,
    });
  });

  updatePermissions = this.catchAsync(async (req: Request, res: Response) => {
    const data = await RbacService.updateUserPermissions({
      actorId: req.user!.id,
      targetUserId: req.params.id as string,
      permissionNames: req.body.permissionNames || [],
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] as string | undefined,
    });

    this.sendResponse(res, {
      message: i18n.__('role.update_success'),
      data,
    });
  });

  /**
   * Vendor approve/reject (only for vendor)
   */

  /**
   * Soft delete user
   */
  softDelete = this.catchAsync(async (req: Request, res: Response) => {
    const { id } = req.params;
    await this.userService.softDelete(id as string);
    this.sendResponse(res, {
      message: i18n.__('user.deleted'),
      statusCode: HTTP_STATUS.NO_CONTENT,
      data: null,
    });
  });

  /**
   * Restore user
   */
  restore = this.catchAsync(async (req: Request, res: Response) => {
    const { id } = req.params;
    const restoredUser = await this.userService.restore(id as string);
    this.sendResponse(res, {
      message: i18n.__('user.restored'),
      data: restoredUser,
    });
  });

  /**
   * Hard delete user
   */
  hardDelete = this.catchAsync(async (req: Request, res: Response) => {
    const { id } = req.params;
    await this.userService.hardDelete(id as string);
    this.sendResponse(res, {
      message: i18n.__('user.permanently_deleted'),
      statusCode: HTTP_STATUS.NO_CONTENT,
      data: null,
    });
  });

  /**
   * Get all affiliates
   */
}
