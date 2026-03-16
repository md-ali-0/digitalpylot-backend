import prisma from '@config/db';

export class DashboardService {
  static async getStatistics() {
    const [
      totalUsers,
      totalLeads,
      totalTasks,
      completedTasks,
      leadStatusBreakdown,
      taskPriorityBreakdown,
    ] = await Promise.all([
      prisma.user.count({ where: { deletedAt: null } }),
      prisma.lead.count({ where: { deletedAt: null } }),
      prisma.task.count({ where: { deletedAt: null } }),
      prisma.task.count({ where: { status: 'DONE', deletedAt: null } }),
      prisma.lead.groupBy({
        by: ['status'],
        _count: true,
        where: { deletedAt: null },
      }),
      prisma.task.groupBy({
        by: ['priority'],
        _count: true,
        where: { deletedAt: null },
      }),
    ]);

    return {
      summary: {
        totalUsers,
        totalLeads,
        totalTasks,
        completedTasks,
        taskCompletionRate: totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0,
      },
      leadBreakdown: leadStatusBreakdown.reduce((acc: Record<string, number>, curr) => {
        acc[curr.status] = curr._count;
        return acc;
      }, {}),
      taskBreakdown: taskPriorityBreakdown.reduce((acc: Record<string, number>, curr) => {
        acc[curr.priority] = curr._count;
        return acc;
      }, {}),
    };
  }

  static async getMonthlyGrowth() {
    // Simple monthly lead growth for last 6 months
    const growth = await prisma.$queryRaw`
      SELECT 
        TO_CHAR(created_at, 'YYYY-MM') as month,
        COUNT(*) as count
      FROM leads
      WHERE deleted_at IS NULL
      AND created_at >= CURRENT_DATE - INTERVAL '6 months'
      GROUP BY month
      ORDER BY month ASC
    `;
    return growth;
  }
}
