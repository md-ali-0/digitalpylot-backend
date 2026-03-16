import prisma from '@config/db';
import { BaseService } from '@core/base.service';
import { ApiError } from '@core/error.classes';
import { LeadStatus, Prisma } from '@prisma/client';
import { calculatePagination, createPaginationMeta, GetAllOptions } from '@utils/pagination.util';
import { sanitizeSearchInput } from '@utils/sanitize.util';
import { LEAD_ALLOWED_FILTERS } from './lead.interface';

export class LeadService extends BaseService {
  constructor() {
    super(prisma.lead);
  }

  async getAllLeads(options: GetAllOptions) {
    const { filters = {}, pagination, search } = options;
    const { page, limit, skip, sortBy, sortOrder } = calculatePagination(pagination || {});

    const where: Prisma.LeadWhereInput = {};
    const { status, assignedToId, searchTerm: _searchTerm, ...extraFilters } = filters;

    where.deletedAt = null;

    Object.keys(extraFilters).forEach((key) => {
      if ((LEAD_ALLOWED_FILTERS as readonly string[]).includes(key)) {
        (where as any)[key] = extraFilters[key];
      }
    });

    if (status) where.status = status as LeadStatus;
    if (assignedToId) where.assignedToId = assignedToId;

    if (search) {
      const sanitized = sanitizeSearchInput(search);
      if (sanitized) {
        where.OR = [
          { firstName: { contains: sanitized, mode: 'insensitive' } },
          { lastName: { contains: sanitized, mode: 'insensitive' } },
          { email: { contains: sanitized, mode: 'insensitive' } },
          { company: { contains: sanitized, mode: 'insensitive' } },
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
      prisma.lead.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          assignedTo: {
            select: { id: true, name: true, email: true },
          },
        },
      }),
      prisma.lead.count({ where }),
    ]);

    return {
      meta: createPaginationMeta(total, page, limit),
      data,
    };
  }

  async findById(id: string) {
    const lead = await prisma.lead.findUnique({
      where: { id },
      include: {
        assignedTo: {
          select: { id: true, name: true, email: true },
        },
        tasks: true,
      },
    });

    if (!lead) {
      throw ApiError.NotFound('Lead not found');
    }

    return lead;
  }

  async create(data: any) {
    return prisma.lead.create({
      data: {
        ...data,
        tenantId: 'default', // Default for single-tenant logic
      },
      include: {
        assignedTo: {
          select: { id: true, name: true, email: true },
        },
      },
    });
  }

  async update(id: string, data: any) {
    return prisma.lead.update({
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
    return prisma.lead.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
