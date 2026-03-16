/* eslint-disable @typescript-eslint/no-explicit-any */
import { calculatePagination, createPaginationMeta, GetAllOptions } from '@utils/pagination.util';
import { sanitizeSearchInput } from '@utils/sanitize.util';
import prisma from '../../config/db';
import { FILE_ALLOWED_FILTERS, FILE_ALLOWED_SORT_FIELDS } from './file.constants';

import env from '@config/env';
import logger from '@config/winston';
import { BaseService } from '@core/base.service';
import { Prisma } from '@prisma/client';
import { CloudinaryStorageService } from '@utils/storage/cloudinary.storage';
import { LocalStorageService } from '@utils/storage/local.storage';
import { R2StorageService } from '@utils/storage/r2.storage';
import { S3StorageService } from '@utils/storage/s3.storage';
import type { IStorageService } from '@utils/storage/storage.interface';

export class FileService extends BaseService {
  private storageService: IStorageService;

  constructor() {
    super(prisma.file);
    switch (env.STORAGE_TYPE) {
      case 'S3':
        this.storageService = new S3StorageService();
        break;
      case 'CLOUDINARY':
        this.storageService = new CloudinaryStorageService();
        break;
      case 'R2':
        this.storageService = new R2StorageService();
        break;
      case 'LOCAL':
      default:
        this.storageService = new LocalStorageService();
        break;
    }
    logger.info(`Using storage type: ${env.STORAGE_TYPE || 'LOCAL'}`);
  }

  async getAllFiles(options: GetAllOptions) {
    const { filters = {}, search, searchFields = [], pagination } = options;

    const { page, limit, skip, sortBy, sortOrder } = calculatePagination(pagination || {});

    const where: Prisma.FileWhereInput & { [key: string]: unknown } = {};
    const { mimeType, provider, searchTerm, ...extraFilters } = filters;

    // ✅ Apply only allowed general filters
    Object.keys(extraFilters).forEach((key) => {
      if (FILE_ALLOWED_FILTERS.includes(key as any)) {
        where[key] = extraFilters[key];
      }
    });

    if (mimeType) where.mimeType = mimeType;
    if (provider) where.provider = provider;

    if (searchTerm) {
      const sanitizedSearch = sanitizeSearchInput(searchTerm);
      if (sanitizedSearch) {
        where.OR = [
          { filename: { contains: sanitizedSearch, mode: 'insensitive' } },
          { mimeType: { contains: sanitizedSearch, mode: 'insensitive' } },
          { url: { contains: sanitizedSearch, mode: 'insensitive' } },
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

    // ✅ Sorting
    const orderBy: Record<string, 'asc' | 'desc'> = {};
    if (sortBy && FILE_ALLOWED_SORT_FIELDS.includes(sortBy as any)) {
      orderBy[sortBy] = sortOrder || 'desc';
    } else {
      orderBy.createdAt = 'desc';
    }

    // ✅ Fetch data + count concurrently
    const [data, total] = await Promise.all([
      this.prisma.file.findMany({
        where,
        skip,
        take: limit,
        orderBy,
      }),
      this.prisma.file.count({ where }),
    ]);

    // ✅ Pagination Meta
    const meta = createPaginationMeta(total, page, limit);

    // Map data to include file_type field explicitly
    const mappedData = data.map((file) => ({
      id: file.id,
      url: file.url,
      filename: file.filename,
      mimeType: file.mimeType,
      size: Number(file.size), // Convert BigInt to Number
      extension: file.extension,
      file_type: (file as any).file_type, // temporary if file_type is missing in type
      checksum: file.checksum,
      visibility: file.visibility,
      provider: file.provider,
      path: file.path,
      createdAt: file.createdAt,
      updatedAt: file.updatedAt,
    }));

    return {
      meta,
      data: mappedData,
    };
  }

  /**
   * Upload file and create DB record
   */
  async uploadFile(file: Express.Multer.File): Promise<any> {
    // Keeping any for now to facilitate file_type addition
    if (!file) {
      throw this.Error.BadRequest('No file provided for upload.', 'file.no_file');
    }

    // 1️⃣ Upload to storage service
    const storageResult = await this.storageService.uploadFile(file);

    try {
      // 2️⃣ Save record in DB
      const newFile = await prisma.file.create({
        data: {
          ...storageResult,
        },
      });

      // Return the complete file object with all properties
      return {
        id: newFile.id,
        url: newFile.url,
        filename: newFile.filename,
        mimeType: newFile.mimeType,
        size: Number(newFile.size), // Convert BigInt to Number
        extension: newFile.extension,
        file_type: (newFile as any).file_type, // Add file_type field
        checksum: newFile.checksum,
        visibility: newFile.visibility,
        provider: newFile.provider,
        path: newFile.path,
        createdAt: newFile.createdAt,
        updatedAt: newFile.updatedAt,
      };
    } catch (error: any) {
      // Handle unique constraint error on URL
      if (error.code === 'P2002' && error.meta?.target?.includes('url')) {
        // URL already exists, try to find the existing file
        const existingFile = await prisma.file.findFirst({
          where: {
            url: storageResult.url,
          },
        });

        if (existingFile) {
          logger.info(
            `File already exists in database: ${existingFile.filename} (ID: ${existingFile.id})`,
          );
          return {
            id: existingFile.id,
            url: existingFile.url,
            filename: existingFile.filename,
            mimeType: existingFile.mimeType,
            size: Number(existingFile.size), // Convert BigInt to Number
            extension: existingFile.extension,
            file_type: (existingFile as any).file_type, // Add file_type field
            checksum: existingFile.checksum,
            visibility: existingFile.visibility,
            provider: existingFile.provider,
            path: existingFile.path,
            createdAt: existingFile.createdAt,
            updatedAt: existingFile.updatedAt,
          };
        }
      }

      // Re-throw the error if it's not a unique constraint error or if we can't find the existing file
      throw error;
    }
  }

  /**
   * Fetch a file record by ID
   */
  async getFileById(id: string): Promise<any> {
    const file = await prisma.file.findUnique({ where: { id } });
    if (!file) {
      throw this.Error.NotFound('File not found.', 'file.not_found');
    }

    // Return file object with all properties including file_type
    return {
      id: file.id,
      url: file.url,
      filename: file.filename,
      mimeType: file.mimeType,
      size: Number(file.size), // Convert BigInt to Number
      extension: file.extension,
      file_type: (file as any).file_type, // Add file_type field
      checksum: file.checksum,
      visibility: file.visibility,
      provider: file.provider,
      path: file.path,
      createdAt: file.createdAt,
      updatedAt: file.updatedAt,
    };
  }

  /**
   * Get a file stream from storage
   */
  async getFileStream(
    id: string,
  ): Promise<{ stream: NodeJS.ReadableStream; mimeType: string; filename: string }> {
    const file = await prisma.file.findUnique({ where: { id } });
    if (!file) {
      throw this.Error.NotFound('File not found.', 'file.not_found');
    }

    // For local storage, we need to create a custom implementation
    if (file.provider === 'LOCAL') {
      const fs = await import('fs');
      const path = await import('path');

      // Check if path exists
      if (!file.path) {
        throw this.Error.NotFound('File path not found in database.', 'file.path_not_found');
      }

      // Convert relative path to absolute path for file system operations
      const absolutePath = path.join(__dirname, '../../..', file.path);

      if (!fs.existsSync(absolutePath)) {
        throw this.Error.NotFound('File not found on disk.', 'file.not_found_local');
      }

      const stream = fs.createReadStream(absolutePath);
      return { stream, mimeType: file.mimeType, filename: file.filename };
    }

    // For Cloudinary and other providers, we still need to implement proper handling
    // For now, we'll throw an error indicating this needs to be implemented
    throw this.Error.InternalServerError(
      `getFileStream not implemented for provider: ${file.provider}`,
      'file.stream_not_implemented',
    );
  }

  /**
   * Delete a file (both DB + storage)
   */
  async deleteFile(id: string): Promise<void> {
    const file = await prisma.file.findUnique({ where: { id } });
    if (!file) {
      throw this.Error.NotFound('File not found.', 'file.not_found');
    }

    // For local storage, delete the file from disk
    if (file.provider === 'LOCAL') {
      const fs = await import('fs');
      const path = await import('path');

      // Check if path exists
      if (!file.path) {
        logger.warn(`File path not found in database for file ID: ${file.id}`);
        return;
      }

      // Convert relative path to absolute path for file system operations
      const absolutePath = path.join(__dirname, '../../..', file.path);

      if (fs.existsSync(absolutePath)) {
        await fs.promises.unlink(absolutePath);
        logger.info(`File deleted from local storage: ${file.filename} (ID: ${file.id})`);
      }
    }

    // For Cloudinary, delete the file from Cloudinary storage
    if (file.provider === 'CLOUDINARY') {
      try {
        // For Cloudinary, the path field contains the public ID needed for deletion
        if (file.path) {
          await this.storageService.deleteFile(file.path);
          logger.info(`File deleted from Cloudinary: ${file.filename} (ID: ${file.id})`);
        } else {
          logger.warn(`Cloudinary file path (public ID) not found for file ID: ${file.id}`);
        }
      } catch (error: any) {
        logger.error(`Error deleting file from Cloudinary: ${error.message}`, error);
        // We still delete the database record even if Cloudinary deletion fails
      }
    }

    // Delete from DB
    await prisma.file.delete({ where: { id } });
  }
}
