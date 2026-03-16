/* eslint-disable @typescript-eslint/no-explicit-any */
import { HTTP_STATUS } from '@config/constants';
import i18n from '@config/i18n-compat';
import { BaseController } from '@core/base.controller';
import { ApiError } from '@core/error.classes';
import type { Request, RequestHandler, Response } from 'express';
import type { ZodObject } from 'zod';
import { validateFileContent } from '../../utils/file-validation.util';
import { FileService } from './file.service';

export class FileController extends BaseController {
  private fileService: FileService;

  constructor() {
    super(new FileService());
    this.fileService = this.service as FileService;
  }

  uploadFile = this.catchAsync(async (req: Request, res: Response) => {
    if (!req.user?.id) {
      throw ApiError.Forbidden('User not authenticated', 'user.not_authenticated');
    }
    if (!req.file) {
      throw ApiError.BadRequest('No file provided for upload', 'file.no_file');
    }

    // Validate file content (magic bytes)
    await validateFileContent(req.file.buffer, req.file.mimetype);

    const uploadedFile = await this.fileService.uploadFile(req.file);
    // Return the complete file object with ID as requested
    this.sendResponse(res, {
      message: i18n.__('file.upload_success'),
      statusCode: HTTP_STATUS.CREATED,
      data: uploadedFile,
    });
  });

  uploadMultipleFiles = this.catchAsync(async (req: Request, res: Response) => {
    if (!req.user?.id) {
      throw ApiError.Forbidden('User not authenticated', 'user.not_authenticated');
    }
    if (!req.files || (req.files as Express.Multer.File[]).length === 0) {
      throw ApiError.BadRequest('No files provided for upload', 'file.no_files');
    }

    const userId = req.user?.id;

    if (!userId) {
      return this.sendResponse(res, {
        success: false,
        message: 'User ID is required',
        statusCode: HTTP_STATUS.BAD_REQUEST,
      });
    }

    const { folder, visibility } = req.body;
    const folderStr = (folder as string) || 'general';
    const visibilityStr = (visibility as string) || 'public';
    const tenantId = (req.headers['x-tenant-id'] || req.headers['X-Tenant-Id']) as string;
    const files = req.files as Express.Multer.File[];

    // Validate all files first (parallel validation)
    await Promise.all(files.map((file) => validateFileContent(file.buffer, file.mimetype)));

    // Upload each file concurrently
    const uploadedFiles = await Promise.all(files.map((file) => this.fileService.uploadFile(file)));

    // Return the complete file objects with IDs as requested
    this.sendResponse(res, {
      message: i18n.__('file.upload_multiple_success'),
      statusCode: HTTP_STATUS.CREATED,
      data: uploadedFiles,
    });
  });

  getFileById = this.catchAsync(async (req: Request, res: Response) => {
    const file = await this.fileService.getFileById(req.params.id as string);
    this.sendResponse(res, {
      message: i18n.__('file.retrieve_success'),
      statusCode: HTTP_STATUS.OK,
      data: file,
    });
  });

  getAllFiles = this.catchAsync(async (req: Request, res: Response) => {
    const { filters, search, pagination } = this.parseQuery(req);
    const query = {
      filters,
      search,
      searchFields: ['filename', 'mimeType', 'url'],
      pagination,
    };
    const files = await this.fileService.getAllFiles(query);
    this.sendResponse(res, {
      message: i18n.__('file.retrieve_all_success'),
      statusCode: HTTP_STATUS.OK,
      data: files.data,
      meta: files.meta,
    });
  });

  downloadFile = this.catchAsync(async (req: Request, res: Response) => {
    const { stream, mimeType, filename } = await this.fileService.getFileStream(
      req.params.id as string,
    );
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    stream.pipe(res);
  });

  deleteFile = this.catchAsync(async (req: Request, res: Response) => {
    if (!req.user?.id) {
      throw ApiError.Forbidden('User not authenticated', 'user.not_authenticated');
    }
    await this.fileService.deleteFile(req.params.id as string);
    this.sendResponse(res, {
      message: i18n.__('file.delete_success'),
      statusCode: HTTP_STATUS.OK,
      data: null,
    });
  });

  validate(schema: ZodObject<any>, property: 'body' | 'params' | 'query'): RequestHandler {
    return (req, res, next) => {
      try {
        schema.parse(req[property]);
        next();
      } catch (err: any) {
        return this.sendResponse(res, {
          success: false,
          message: i18n.__('validation_failed'),
          statusCode: HTTP_STATUS.BAD_REQUEST,
          error: {
            message: err.message, // Providing a valid error property, presumably message or details
          },
        });
      }
    };
  }
}
