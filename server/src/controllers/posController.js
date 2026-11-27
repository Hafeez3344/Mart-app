const prisma = require('../config/prisma');
const { generateSaleInvoiceNo, generateReturnNo } = require('../utils/idGenerator');

// -------------------------------------------------------------
// POS CHECKOUT & SALE PROCESSING
// -------------------------------------------------------------

const createSale = async (req, res) => {
  try {
    const {
      customerId,
      customerName,
      customerPhone,
      items,
      subtotal,
      discount,
      discountType,
      tax,
      netTotal,
      paidAmount,
      paymentMethod,
      notes,
      isParked,
      parkedName
    } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Cart items are required to process a sale.' });
    }

    const cashierId = req.user?.id || null;
    const cashierName = req.user?.name || 'Cashier';

    // If parking cart, save as parked sale without deducting stock
    if (isParked) {
      const invoiceNo = `PARK-${Date.now().toString().slice(-6)}`;
      const parkedSale = await prisma.sale.create({
        data: {
          invoiceNo,
          customerId: customerId || null,
          customerName: customerName || 'Walk-In Customer',
          customerPhone: customerPhone || null,
          subtotal: parseFloat(subtotal) || 0,
          discount: parseFloat(discount) || 0,
          discountType: discountType || 'FLAT',
          tax: parseFloat(tax) || 0,
          netTotal: parseFloat(netTotal) || 0,
          paidAmount: 0,
          changeDue: 0,
          paymentMethod: paymentMethod || 'CASH',
          status: 'PARKED',
          notes: notes || null,
          cashierId,
          cashierName,
          isParked: true,
          parkedName: parkedName || `Parked Cart (${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`,
          items: {
            create: items.map(item => ({
              productId: item.productId || null,
              productName: item.productName || item.name || 'Item',
              barcode: item.barcode || null,
              quantity: parseFloat(item.quantity) || 1,
              unit: item.unit || 'Pcs',
              unitCost: parseFloat(item.costPrice || item.unitCost) || 0,
              unitPrice: parseFloat(item.unitPrice || item.retailPrice) || 0,
              discount: parseFloat(item.discount) || 0,
              totalPrice: parseFloat(item.totalPrice) || 0
            }))
          }
        },
        include: { items: true }
      });

      return res.status(201).json({
        success: true,
        message: 'Cart parked successfully.',
        sale: parkedSale
      });
    }

    // Process Final Checkout
    const parsedSubtotal = parseFloat(subtotal) || 0;
    const parsedDiscount = parseFloat(discount) || 0;
    const parsedTax = parseFloat(tax) || 0;
    const parsedNetTotal = parseFloat(netTotal) || 0;
    const parsedPaid = parseFloat(paidAmount) || 0;
    const changeDue = Math.max(0, parsedPaid - parsedNetTotal);
    const invoiceNo = generateSaleInvoiceNo();

    // Determine sale status
    let status = 'PAID';
    if (parsedPaid < parsedNetTotal) {
      status = parsedPaid > 0 ? 'PARTIAL' : 'DUE';
    }

    // Execute atomic transaction: Create Sale + Items + Deduct Stock + Update Customer Credit (if Due)
    const result = await prisma.$transaction(async (tx) => {
      // 1. Deduct Stock for items that have a productId (handling Multi-Unit conversions: Carton, Pack/Box, Piece)
      for (const item of items) {
        if (item.productId) {
          const product = await tx.product.findUnique({ where: { id: item.productId } });
          if (product) {
            let unitMultiplier = 1;
            const itemUnit = (item.unit || '').toLowerCase();
            if (itemUnit.includes('carton') || itemUnit.includes('ctn')) {
              unitMultiplier = (product.piecesPerPack || 1) * (product.packsPerCarton || 1);
            } else if (itemUnit.includes('pack') || itemUnit.includes('box') || itemUnit.includes('dabbi')) {
              unitMultiplier = product.piecesPerPack || 1;
            }

            const deductionQty = (parseFloat(item.quantity) || 1) * unitMultiplier;
            const updatedStock = Math.max(0, product.stockQuantity - deductionQty);
            await tx.product.update({
              where: { id: item.productId },
              data: { stockQuantity: updatedStock }
            });
          }
        }
      }

      // 2. If Customer exists and there is an unpaid balance (Due / Credit)
      const dueBalance = parsedNetTotal - parsedPaid;
      if (customerId && dueBalance > 0) {
        await tx.customer.update({
          where: { id: customerId },
          data: {
            currentBalance: { increment: dueBalance }
          }
        });
      }

      // 3. Create Sale record
      const createdSale = await tx.sale.create({
        data: {
          invoiceNo,
          customerId: customerId || null,
          customerName: customerName?.trim() || 'Walk-In Customer',
          customerPhone: customerPhone?.trim() || null,
          subtotal: parsedSubtotal,
          discount: parsedDiscount,
          discountType: discountType || 'FLAT',
          tax: parsedTax,
          netTotal: parsedNetTotal,
          paidAmount: parsedPaid,
          changeDue,
          paymentMethod: paymentMethod || 'CASH',
          status,
          notes: notes?.trim() || null,
          cashierId,
          cashierName,
          isParked: false,
          items: {
            create: items.map(item => ({
              productId: item.productId || null,
              productName: item.productName || item.name || 'Product',
              barcode: item.barcode || null,
              quantity: parseFloat(item.quantity) || 1,
              unit: item.unit || 'Pcs',
              unitCost: parseFloat(item.costPrice || item.unitCost) || 0,
              unitPrice: parseFloat(item.unitPrice || item.retailPrice) || 0,
              discount: parseFloat(item.discount) || 0,
              totalPrice: parseFloat(item.totalPrice) || 0
            }))
          }
        },
        include: {
          items: true,
          customer: true
        }
      });

      return createdSale;
    });

    return res.status(201).json({
      success: true,
      message: 'Sale completed successfully.',
      sale: result
    });
  } catch (error) {
    console.error('createSale error:', error);
    return res.status(500).json({ success: false, message: 'Failed to process POS sale.' });
  }
};

// -------------------------------------------------------------
// PARKED / HELD BILLS
// -------------------------------------------------------------

const getParkedSales = async (req, res) => {
  try {
    const parked = await prisma.sale.findMany({
      where: { isParked: true },
      include: { items: true },
      orderBy: { createdAt: 'desc' }
    });

    return res.status(200).json({ success: true, count: parked.length, parked });
  } catch (error) {
    console.error('getParkedSales error:', error);
    return res.status(500).json({ success: false, message: 'Failed to retrieve parked sales.' });
  }
};

const deleteParkedSale = async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.sale.delete({ where: { id } });
    return res.status(200).json({ success: true, message: 'Parked cart removed.' });
  } catch (error) {
    console.error('deleteParkedSale error:', error);
    return res.status(500).json({ success: false, message: 'Failed to delete parked cart.' });
  }
};

// -------------------------------------------------------------
// SALES HISTORY & INVOICE MANAGEMENT
// -------------------------------------------------------------

const getAllSales = async (req, res) => {
  try {
    const { search, paymentMethod, status, startDate, endDate, page = 1, limit = 50 } = req.query;

    const where = { isParked: false };

    if (search && search.trim()) {
      const q = search.trim();
      where.OR = [
        { invoiceNo: { contains: q, mode: 'insensitive' } },
        { customerName: { contains: q, mode: 'insensitive' } },
        { customerPhone: { contains: q, mode: 'insensitive' } },
        { cashierName: { contains: q, mode: 'insensitive' } }
      ];
    }

    if (paymentMethod && paymentMethod !== 'ALL') {
      where.paymentMethod = paymentMethod;
    }

    if (status && status !== 'ALL') {
      where.status = status;
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        where.createdAt.lte = end;
      }
    }

    const [total, sales] = await Promise.all([
      prisma.sale.count({ where }),
      prisma.sale.findMany({
        where,
        include: {
          items: true,
          customer: { select: { id: true, name: true, phone: true } }
        },
        orderBy: { createdAt: 'desc' },
        skip: (parseInt(page) - 1) * parseInt(limit),
        take: parseInt(limit)
      })
    ]);

    return res.status(200).json({
      success: true,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / parseInt(limit)),
      sales
    });
  } catch (error) {
    console.error('getAllSales error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch sales history.' });
  }
};

const getSaleByInvoice = async (req, res) => {
  try {
    const { invoiceNo } = req.params;
    const sale = await prisma.sale.findUnique({
      where: { invoiceNo },
      include: {
        items: true,
        customer: true,
        returns: { include: { items: true } }
      }
    });

    if (!sale) {
      return res.status(404).json({ success: false, message: `Sale '${invoiceNo}' not found.` });
    }

    return res.status(200).json({ success: true, sale });
  } catch (error) {
    console.error('getSaleByInvoice error:', error);
    return res.status(500).json({ success: false, message: 'Failed to load sale details.' });
  }
};

// -------------------------------------------------------------
// SALES RETURNS & REFUNDS
// -------------------------------------------------------------

const processSaleReturn = async (req, res) => {
  try {
    const { saleId, invoiceNo, items, totalRefund, refundMethod, reason } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Return items are required.' });
    }

    const returnNo = generateReturnNo();
    const cashierName = req.user?.name || 'Cashier';

    const result = await prisma.$transaction(async (tx) => {
      // 1. Restock returned items
      for (const item of items) {
        if (item.productId) {
          await tx.product.update({
            where: { id: item.productId },
            data: {
              stockQuantity: { increment: parseFloat(item.quantity) || 1 }
            }
          });
        }
      }

      // 2. Create SaleReturn record
      const saleReturn = await tx.saleReturn.create({
        data: {
          returnNo,
          saleId: saleId || null,
          invoiceNo: invoiceNo || 'MANUAL-RETURN',
          totalRefund: parseFloat(totalRefund) || 0,
          refundMethod: refundMethod || 'CASH',
          reason: reason?.trim() || 'Customer Return',
          returnedBy: cashierName,
          items: {
            create: items.map(item => ({
              productId: item.productId || null,
              productName: item.productName || 'Item',
              quantity: parseFloat(item.quantity) || 1,
              unitPrice: parseFloat(item.unitPrice) || 0,
              refundAmount: parseFloat(item.refundAmount) || 0
            }))
          }
        },
        include: { items: true }
      });

      // 3. Mark original sale as RETURNED if applicable
      if (saleId) {
        await tx.sale.update({
          where: { id: saleId },
          data: { status: 'RETURNED' }
        });
      }

      return saleReturn;
    });

    return res.status(201).json({
      success: true,
      message: 'Sales return processed and stock restored.',
      saleReturn: result
    });
  } catch (error) {
    console.error('processSaleReturn error:', error);
    return res.status(500).json({ success: false, message: 'Failed to process sales return.' });
  }
};

// -------------------------------------------------------------
// DASHBOARD & DAILY SUMMARY
// -------------------------------------------------------------

const getDailySummary = async (req, res) => {
  try {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const todaySales = await prisma.sale.findMany({
      where: {
        isParked: false,
        createdAt: { gte: startOfDay, lte: endOfDay }
      },
      include: { items: true }
    });

    const totalRevenue = todaySales.reduce((acc, s) => acc + s.netTotal, 0);
    const totalTransactions = todaySales.length;

    let totalCogs = 0;
    let cashSales = 0;
    let cardSales = 0;
    let onlineSales = 0;
    let creditSales = 0;

    for (const sale of todaySales) {
      if (sale.paymentMethod === 'CASH') cashSales += sale.paidAmount;
      else if (sale.paymentMethod === 'CARD') cardSales += sale.paidAmount;
      else if (sale.paymentMethod === 'ONLINE') onlineSales += sale.paidAmount;
      else if (sale.paymentMethod === 'CREDIT') creditSales += sale.netTotal;

      for (const item of sale.items) {
        totalCogs += (item.unitCost * item.quantity);
      }
    }

    const grossProfit = totalRevenue - totalCogs;

    // Today's expenses
    const todayExpenses = await prisma.expense.findMany({
      where: { date: { gte: startOfDay, lte: endOfDay } }
    });
    const totalExpenses = todayExpenses.reduce((acc, e) => acc + e.amount, 0);
    const netProfit = grossProfit - totalExpenses;

    return res.status(200).json({
      success: true,
      summary: {
        totalRevenue,
        totalTransactions,
        grossProfit,
        totalExpenses,
        netProfit,
        cashSales,
        cardSales,
        onlineSales,
        creditSales
      }
    });
  } catch (error) {
    console.error('getDailySummary error:', error);
    return res.status(500).json({ success: false, message: 'Failed to compute daily summary.' });
  }
};

module.exports = {
  createSale,
  getParkedSales,
  deleteParkedSale,
  getAllSales,
  getSaleByInvoice,
  processSaleReturn,
  getDailySummary
};

