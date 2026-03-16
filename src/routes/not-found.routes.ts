import { ApiError } from '@core/error.classes';
import { NextFunction, Request, Response, Router } from 'express';

export class NotFoundRoutes {
  public router: Router;

  constructor() {
    this.router = Router();
    this.initializeRoutes();
  }

  private initializeRoutes() {
    // Handle all undefined routes - Express catch-all
    this.router.use(this.handleNotFound);
  }

  private handleNotFound = (req: Request, res: Response, next: NextFunction) => {
    // Use i18n for localized error messages
    const message = req.t
      ? req.t('error.route_not_found', { url: req.originalUrl })
      : `Route ${req.originalUrl} not found`;

    next(ApiError.NotFound(message, 'error.route_not_found', { url: req.originalUrl }));
  };

  public getRouter(): Router {
    return this.router;
  }
}
