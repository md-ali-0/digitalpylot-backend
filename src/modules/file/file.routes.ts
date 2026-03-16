/* eslint-disable @typescript-eslint/no-explicit-any */
import { authenticate, authorizeRoles } from '@middlewares/auth.middleware';
import { upload } from '@middlewares/multer.middleware';
import { validate } from '@middlewares/validation.middleware';
import { Router } from 'express';
import { FileController } from './file.controller';
import { fileIdSchema, fileQuerySchema } from './file.validation';

export class FileRoutes {
  public router: Router;
  private fileController: FileController;

  constructor() {
    this.router = Router();
    this.fileController = new FileController();
    this.initializeRoutes();
  }

  private initializeRoutes() {
    this.router.get(
      '/',
      authenticate,
      authorizeRoles(['ADMIN', 'MANAGER', 'ADVERTISER']),
      validate(fileQuerySchema),
      // cacheMiddleware(60),
      this.fileController.getAllFiles,
    );
    this.router.post(
      '/upload',
      authenticate,
      // Allow all authenticated users to upload files
      upload.single('file') as any,
      this.fileController.uploadFile,
    );

    this.router.post(
      '/upload-multiple',
      authenticate,
      // Allow all authenticated users to upload multiple files
      upload.array('files') as any,
      this.fileController.uploadMultipleFiles,
    );
    this.router.get(
      '/:id',
      authenticate, // Or make public if files are meant to be public
      authorizeRoles(['ADMIN']),
      validate(fileIdSchema),
      // cacheMiddleware(60),
      this.fileController.getFileById,
    );
    this.router.get(
      '/:id/download',
      authenticate, // Or make public
      authorizeRoles(['ADMIN']),
      validate(fileIdSchema),
      this.fileController.downloadFile,
    );
    this.router.delete(
      '/:id',
      authenticate,
      authorizeRoles(['ADMIN']),
      validate(fileIdSchema),
      this.fileController.deleteFile,
    );
  }

  public getRouter(): Router {
    return this.router;
  }
}
