import i18next from '@config/i18n';
import type { RequestHandler } from 'express';
import type { TFunction } from 'i18next';
import middleware from 'i18next-http-middleware';

declare global {
  namespace Express {
    interface Request {
      t: TFunction;
      lng: string;
    }
  }
}

export const i18nMiddleware = middleware.handle(i18next) as unknown as RequestHandler;
