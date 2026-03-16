/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import prisma from '@config/db';
import logger from '@config/winston';
import { Logger } from 'winston';
import { ApiError } from './error.classes';

export abstract class BaseService<T = any> {
  protected prisma = prisma;
  protected model: any;
  protected Error = ApiError;
  protected logger: Logger;

  constructor(model: any) {
    this.model = model;
    this.logger = logger;
  }
}
