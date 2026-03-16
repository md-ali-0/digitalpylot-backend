import logger from '@config/winston';
import { RbacService } from './rbac.service';

interface AuditLogData {
  userId: string;
  tenantId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Audit logging service for tracking important user actions
 */
export class AuditLogService {
  /**
   * Log an audit event
   */
  static async log(data: AuditLogData): Promise<void> {
    try {
      logger.info('Audit log', {
        userId: data.userId,
        action: data.action,
        resourceType: data.resourceType,
        resourceId: data.resourceId,
        metadata: data.metadata,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        tenantId: data.tenantId, // Added tenantId to logger
        timestamp: new Date().toISOString(),
      });

      // Store in database
      await RbacService.createAuditLog({
        userId: data.userId,
        tenantId: data.tenantId || 'SYSTEM',
        action: data.action,
        resourceType: data.resourceType,
        resourceId: data.resourceId,
        changes: data.metadata,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
      });
    } catch (error) {
      logger.error('Failed to create audit log', {
        error: error instanceof Error ? error.message : 'Unknown error',
        data,
      });
    }
  }

  /**
   * Log product creation
   */
  static async logProductCreated(
    userId: string,
    tenantId: string,
    productId: string,
    productName: string,
    ipAddress?: string,
  ): Promise<void> {
    await this.log({
      userId,
      tenantId,
      action: 'PRODUCT_CREATED',
      resourceType: 'Product',
      resourceId: productId,
      metadata: { productName },
      ipAddress,
    });
  }

  /**
   * Log product update
   */
  static async logProductUpdated(
    userId: string,
    tenantId: string,
    productId: string,
    changes: Record<string, unknown>,
    ipAddress?: string,
  ): Promise<void> {
    await this.log({
      userId,
      tenantId,
      action: 'PRODUCT_UPDATED',
      resourceType: 'Product',
      resourceId: productId,
      metadata: { changes },
      ipAddress,
    });
  }

  /**
   * Log order creation
   */
  static async logOrderCreated(
    userId: string,
    tenantId: string,
    orderId: string,
    amount: number,
    ipAddress?: string,
  ): Promise<void> {
    await this.log({
      userId,
      tenantId,
      action: 'ORDER_CREATED',
      resourceType: 'Order',
      resourceId: orderId,
      metadata: { amount },
      ipAddress,
    });
  }

  /**
   * Log user login
   */
  static async logUserLogin(
    userId: string,
    tenantId: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    await this.log({
      userId,
      tenantId,
      action: 'USER_LOGIN',
      resourceType: 'User',
      resourceId: userId,
      ipAddress,
      userAgent,
    });
  }

  /**
   * Log failed login attempt
   */
  static async logFailedLogin(email: string, ipAddress?: string): Promise<void> {
    logger.warn('Failed login attempt', {
      email,
      ipAddress,
      timestamp: new Date().toISOString(),
    });
  }
}
