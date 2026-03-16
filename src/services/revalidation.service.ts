/* eslint-disable @typescript-eslint/no-explicit-any */
import env from '@config/env';
import logger from '@config/winston';
import axios from 'axios';

/**
 * Revalidation Service
 * Calls frontend revalidation APIs after data updates
 */
export class RevalidationService {
  private static readonly FRONTEND_URL =
    process.env.NODE_ENV === 'production' ? env.CLIENT_URL_PROD : env.CLIENT_URL;
  private static readonly REVALIDATION_SECRET_KEY = process.env.REVALIDATION_SECRET_KEY;

  /**
   * Revalidate category pages
   * Called after category create/update/delete
   */
  static async revalidateCategories(options?: {
    paths?: string[];
    tags?: string[];
  }): Promise<void> {
    if (!this.REVALIDATION_SECRET_KEY) {
      logger.warn('⚠️ REVALIDATION_SECRET_KEY not configured, skipping category revalidation');
      return;
    }

    try {
      const response = await axios.post(
        `${this.FRONTEND_URL}/api/category-revalid`,
        {
          paths: options?.paths || ['/', '/categories'],
          tags: options?.tags || ['categories', 'categories_tree'],
        },
        {
          headers: {
            Authorization: `Bearer ${this.REVALIDATION_SECRET_KEY}`,
            'Content-Type': 'application/json',
          },
          timeout: 10000, // 10 seconds timeout
        },
      );

      if (response.data.success) {
        logger.log('✅ Category revalidation successful:', response.data.revalidated);
      } else {
        logger.error('❌ Category revalidation failed:', response.data.error);
      }
    } catch (error) {
      logger.error(
        '❌ Error calling category revalidation API:',
        error instanceof Error ? error.message : error,
      );
      // Don't throw error - revalidation failure shouldn't break the main operation
    }
  }

  /**
   * Revalidate meta data pages
   * Called after meta data update
   */
  static async revalidateMetaData(options?: {
    paths?: string[];
    tags?: string[];
    pageType?: string;
  }): Promise<void> {
    if (!this.REVALIDATION_SECRET_KEY) {
      logger.warn('⚠️ REVALIDATION_SECRET_KEY not configured, skipping meta data revalidation');
      return;
    }

    try {
      const response = await axios.post(
        `${this.FRONTEND_URL}/api/meta-data-relvalid`,
        {
          paths: options?.paths || ['/'],
          tags: options?.tags || ['metadata'],
          pageType: options?.pageType,
        },
        {
          headers: {
            'x-api-key': this.REVALIDATION_SECRET_KEY,
            'Content-Type': 'application/json',
          },
          timeout: 10000,
        },
      );

      if (response.data.success) {
        logger.log('✅ Meta data revalidation successful:', response.data.revalidated);
      } else {
        logger.error('❌ Meta data revalidation failed:', response.data.error);
      }
    } catch (error) {
      logger.error(
        '❌ Error calling meta data revalidation API:',
        error instanceof Error ? error.message : error,
      );
    }
  }

  /**
   * Revalidate site-wide data
   * Called after site settings, logo, footer, contact info update
   */
  static async revalidateSiteData(options?: {
    paths?: string[];
    tags?: string[];
    dataType?: string;
  }): Promise<void> {
    if (!this.REVALIDATION_SECRET_KEY) {
      logger.warn('⚠️ REVALIDATION_SECRET_KEY not configured, skipping site data revalidation');
      return;
    }

    try {
      const response = await axios.post(
        `${this.FRONTEND_URL}/api/site-data-revalid`,
        {
          paths: options?.paths,
          tags: options?.tags || ['site-data'],
          dataType: options?.dataType,
        },
        {
          headers: {
            'x-api-key': this.REVALIDATION_SECRET_KEY,
            'Content-Type': 'application/json',
          },
          timeout: 10000,
        },
      );

      if (response.data.success) {
        logger.log('✅ Site data revalidation successful:', response.data.revalidated);
      } else {
        logger.error('❌ Site data revalidation failed:', response.data.error);
      }
    } catch (error) {
      logger.error(
        '❌ Error calling site data revalidation API:',
        error instanceof Error ? error.message : error,
      );
    }
  }

  /**
   * Generic revalidation method
   * For custom revalidation needs
   */
  static async revalidate(endpoint: string, data?: any): Promise<void> {
    if (!this.REVALIDATION_SECRET_KEY) {
      logger.warn('⚠️ REVALIDATION_SECRET_KEY not configured, skipping revalidation');
      return;
    }

    try {
      const response = await axios.post(`${this.FRONTEND_URL}/api/${endpoint}`, data || {}, {
        headers: {
          'x-api-key': this.REVALIDATION_SECRET_KEY,
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      });

      if (response.data.success) {
        logger.log(`✅ Revalidation successful for ${endpoint}:`, response.data.revalidated);
      } else {
        logger.error(`❌ Revalidation failed for ${endpoint}:`, response.data.error);
      }
    } catch (error) {
      logger.error(
        `❌ Error calling ${endpoint} revalidation API:`,
        error instanceof Error ? error.message : error,
      );
    }
  }

  /**
   * Revalidate banners
   */
  static async revalidateBanners(): Promise<void> {
    return this.revalidate('banner-revalid', {
      tags: ['banners'],
    });
  }
}
