import prisma from '@config/db';

export class ReportService {
  static async getLeadPerformance() {
    const leadsBySource = await prisma.lead.groupBy({
      by: ['source'],
      _count: true,
      where: { deletedAt: null },
    });

    const leadsByStatus = await prisma.lead.groupBy({
      by: ['status'],
      _count: true,
      where: { deletedAt: null },
    });

    return {
      bySource: leadsBySource.reduce((acc: any, curr) => {
        acc[curr.source || 'Unknown'] = curr._count;
        return acc;
      }, {}),
      byStatus: leadsByStatus.reduce((acc: any, curr) => {
        acc[curr.status] = curr._count;
        return acc;
      }, {}),
    };
  }

  static async getTaskAnalytics() {
    const tasksByStatus = await prisma.task.groupBy({
      by: ['status'],
      _count: true,
      where: { deletedAt: null },
    });

    const tasksByPriority = await prisma.task.groupBy({
      by: ['priority'],
      _count: true,
      where: { deletedAt: null },
    });

    return {
      byStatus: tasksByStatus.reduce((acc: any, curr) => {
        acc[curr.status] = curr._count;
        return acc;
      }, {}),
      byPriority: tasksByPriority.reduce((acc: any, curr) => {
        acc[curr.priority] = curr._count;
        return acc;
      }, {}),
    };
  }
}
