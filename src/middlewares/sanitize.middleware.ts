import { NextFunction, Request, Response } from 'express';
import xss from 'xss';

// Recursive function to sanitize objects
const sanitizeObject = (obj: any): any => {
  if (typeof obj === 'string') {
    return xss(obj);
  } else if (Array.isArray(obj)) {
    return obj.map(sanitizeObject);
  } else if (obj !== null && typeof obj === 'object') {
    const sanitizedObj: { [key: string]: any } = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        sanitizedObj[key] = sanitizeObject(obj[key]);
      }
    }
    return sanitizedObj;
  }
  return obj;
};

export const sanitizeMiddleware = (req: Request, res: Response, next: NextFunction) => {
  // Sanitize request body
  if (req.body) {
    req.body = sanitizeObject(req.body);
  }

  // Sanitize request query
  if (req.query) {
    req.query = sanitizeObject(req.query);
  }

  // Sanitize request params
  if (req.params) {
    req.params = sanitizeObject(req.params);
  }

  next();
};
