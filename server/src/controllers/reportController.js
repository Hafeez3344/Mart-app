const prisma = require('../config/prisma');

const getFinancialReport = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();
    end.setHours(23, 59, 59, 999);

    const [sales, expenses, returns] = await Promise.all([
      prisma.sale.findMany({
        where: {
          isParked: false,
          createdAt: { gte: start, lte: end }
        },
        include: { items: true }
      }),
      prisma.expense.findMany({
        where: {
          date: { gte: start, lte: end }
        }
      }),
      prisma.saleReturn.findMany({
        where: {
          createdAt: { gte: start, lte: end }
        }
      })
    ]);

    let grossSales = 0;
    let totalDiscount = 0;
    let netSales = 0;
    let totalCogs = 0;

    for (const sale of sales) {
      grossSales += sale.subtotal;
      totalDiscount += sale.discount;
      netSales += sale.netTotal;

      for (const item of sale.items) {
        totalCogs += (item.unitCost * item.quantity);
      }
    }

    const totalRefunds = returns.reduce((acc, r) => acc + r.totalRefund, 0);
    const adjustedSales = netSales - totalRefunds;
    const grossProfit = adjustedSales - totalCogs;
    const totalExpenses = expenses.reduce((acc, e) => acc + e.amount, 0);
    const netProfit = grossProfit - totalExpenses;
    const profitMargin = adjustedSales > 0 ? ((netProfit / adjustedSales) * 100).toFixed(2) : 0;

    return res.status(200).json({
      success: true,
      period: { start, end },
      summary: {
        totalTransactions: sales.length,
        grossSales,
        totalDiscount,
        netSales,
        totalRefunds,
        adjustedSales,
        totalCogs,
        grossProfit,
        totalExpenses,
        netProfit,
        profitMargin: parseFloat(profitMargin)
      }
    });
  } catch (error) {
    console.error('getFinancialReport error:', error);
    return res.status(500).json({ success: false, message: 'Failed to generate financial report.' });
  }
};

const getTopSellingProducts = async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    const saleItems = await prisma.saleItem.groupBy({
      by: ['productId', 'productName'],
      _sum: {
        quantity: true,
        totalPrice: true
      },
      orderBy: {
        _sum: {
          quantity: 'desc'
        }
      },
      take: parseInt(limit)
    });

    const formatted = saleItems.map(item => ({
      productId: item.productId,
      productName: item.productName,
      totalQuantitySold: item._sum.quantity || 0,
      totalRevenue: item._sum.totalPrice || 0
    }));

    return res.status(200).json({ success: true, topProducts: formatted });
  } catch (error) {
    console.error('getTopSellingProducts error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch top selling products.' });
  }
};

const getStockValuationReport = async (req, res) => {
  try {
    const products = await prisma.product.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        category: true,
        stockQuantity: true,
        costPrice: true,
        retailPrice: true
      }
    });

    let totalItems = 0;
    let totalStockUnits = 0;
    let totalCostValuation = 0;
    let totalRetailValuation = 0;

    for (const p of products) {
      totalItems += 1;
      totalStockUnits += p.stockQuantity;
      totalCostValuation += (p.stockQuantity * p.costPrice);
      totalRetailValuation += (p.stockQuantity * p.retailPrice);
    }

    const projectedProfit = totalRetailValuation - totalCostValuation;

    return res.status(200).json({
      success: true,
      valuation: {
        totalItems,
        totalStockUnits,
        totalCostValuation,
        totalRetailValuation,
        projectedProfit
      }
    });
  } catch (error) {
    console.error('getStockValuationReport error:', error);
    return res.status(500).json({ success: false, message: 'Failed to generate stock valuation.' });
  }
};

module.exports = {
  getFinancialReport,
  getTopSellingProducts,
  getStockValuationReport
};

