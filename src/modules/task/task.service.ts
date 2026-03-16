import prisma from '@config/db';
import { BaseService } from '@core/base.service';
import { ApiError } from '@core/error.classes';
import { Prisma, TaskPriority, TaskStatus } from '@prisma/client';
import { calculatePagination, createPaginationMeta, GetAllOptions } from '@utils/pagination.util';
import { sanitizeSearchInput } from '@utils/sanitize.util';
import { TASK_ALLOWED_FILTERS } from './task.interface';

export class TaskService extends BaseService {
  constructor() {
    super(prisma.task);
  }

  async getAllTasks(options: GetAllOptions) {
    const { filters = {}, search, pagination } = options;
    const { page, limit, skip, sortBy, sortOrder } = calculatePagination(pagination || {});

    const where: Prisma.TaskWhereInput = {};
    const { status, priority, assignedToId, searchTerm: _searchTerm, ...extraFilters } = filters;

    where.deletedAt = null;

    Object.keys(extraFilters).forEach((key) => {
      if ((TASK_ALLOWED_FILTERS as readonly string[]).includes(key)) {
        (where as any)[key] = extraFilters[key];
      }
    });

    if (status) where.status = status as TaskStatus;
    if (priority) where.priority = priority as TaskPriority;
    if (assignedToId) where.assignedToId = assignedToId;

    if (search) {
      const sanitized = sanitizeSearchInput(search);
      if (sanitized) {
        where.OR = [
          { title: { contains: sanitized, mode: 'insensitive' } },
          { description: { contains: sanitized, mode: 'insensitive' } },
        ];
      }
    }

    const orderBy: any = {};
    if (sortBy) {
      orderBy[sortBy] = sortOrder || 'desc';
    } else {
      orderBy.createdAt = 'desc';
    }

    const [data, total] = await Promise.all([
      prisma.task.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          assignedTo: {
            select: { id: true, name: true, email: true },
          },
          lead: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
      }),
      prisma.task.count({ where }),
    ]);

    return {
      meta: createPaginationMeta(total, page, limit),
      data,
    };
  }

  async findById(id: string) {
    const task = await prisma.task.findUnique({
      where: { id },
      include: {
        assignedTo: {
          select: { id: true, name: true, email: true },
        },
        lead: true,
      },
    });

    if (!task) {
      throw ApiError.NotFound('Task not found');
    }

    return task;
  }

  async create(data: any) {
    return prisma.task.create({
      data: {
        ...data,
        tenantId: 'default',
      },
      include: {
        assignedTo: {
          select: { id: true, name: true, email: true },
        },
      },
    });
  }

  async update(id: string, data: any) {
    return prisma.task.update({
      where: { id },
      data,
      include: {
        assignedTo: {
          select: { id: true, name: true, email: true },
        },
      },
    });
  }

  async softDelete(id: string) {
    return prisma.task.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
