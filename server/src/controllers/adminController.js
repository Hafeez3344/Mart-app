const prisma = require('../config/prisma');

/**
 * Mart Admin Live Dashboard Analytics Endpoint
 * 100% Real PostgreSQL Data with Aggregations for Mart POS
 */
const getAdminDashboardStats = async (req, res) => {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    // 7-Day Trend Ranges
    const dayRanges = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dStart = new Date(d);
      dStart.setHours(0, 0, 0, 0);
      const dEnd = new Date(d);
      dEnd.setHours(23, 59, 59, 999);
      const dayLabel = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
      dayRanges.push({ dayLabel, dStart, dEnd });
    }

    const [
      totalProducts,
      lowStockCount,
      outOfStockCount,
      totalCustomers,
      totalSuppliers,
      todaySales,
      recentSales,
      customerDuesAgg,
      weeklySalesTrends
    ] = await Promise.all([
      prisma.product.count({ where: { isActive: true } }),
      prisma.product.count({ where: { isActive: true, stockQuantity: { gt: 0, lte: 10 } } }),
      prisma.product.count({ where: { isActive: true, stockQuantity: { lte: 0 } } }),
      prisma.customer.count({ where: { isActive: true } }),
      prisma.supplier.count(),
      prisma.sale.findMany({
        where: {
          isParked: false,
          createdAt: { gte: todayStart, lte: todayEnd }
        },
        include: { items: true }
      }),
      prisma.sale.findMany({
        where: { isParked: false },
        orderBy: { createdAt: 'desc' },
        take: 8,
        include: { items: true }
      }),
      prisma.customer.aggregate({
        where: { currentBalance: { gt: 0 }, isActive: true },
        _sum: { currentBalance: true }
      }),
      Promise.all(dayRanges.map(async (dr) => {
        const sales = await prisma.sale.findMany({
          where: { isParked: false, createdAt: { gte: dr.dStart, lte: dr.dEnd } },
          select: { netTotal: true }
        });
        const revenue = sales.reduce((sum, s) => sum + s.netTotal, 0);
        return {
          day: dr.dayLabel,
          revenue,
          orders: sales.length
        };
      }))
    ]);

    let todayRevenue = 0;
    let todayCogs = 0;
    let cashSales = 0;
    let cardSales = 0;
    let onlineSales = 0;
    let creditSales = 0;

    for (const sale of todaySales) {
      todayRevenue += sale.netTotal;
      if (sale.paymentMethod === 'CASH') cashSales += sale.paidAmount;
      else if (sale.paymentMethod === 'CARD') cardSales += sale.paidAmount;
      else if (sale.paymentMethod === 'ONLINE') onlineSales += sale.paidAmount;
      else if (sale.paymentMethod === 'CREDIT') creditSales += sale.netTotal;

      for (const item of sale.items) {
        todayCogs += (item.unitCost * item.quantity);
      }
    }

    const todayGrossProfit = todayRevenue - todayCogs;

    return res.status(200).json({
      success: true,
      stats: {
        totalRevenueToday: todayRevenue,
        ordersTodayCount: todaySales.length,
        grossProfitToday: todayGrossProfit,
        totalProducts,
        lowStockCount,
        outOfStockCount,
        totalCustomers,
        totalSuppliers,
        totalCustomerDues: customerDuesAgg._sum.currentBalance || 0,
        paymentBreakdown: {
          cash: cashSales,
          card: cardSales,
          online: onlineSales,
          credit: creditSales
        },
        weeklyTrends: weeklySalesTrends,
        recentSales
      }
    });
  } catch (error) {
    console.error('getAdminDashboardStats error:', error);
    return res.status(500).json({ success: false, message: 'Failed to compute mart dashboard stats.' });
  }
};

module.exports = {
  getAdminDashboardStats
};
