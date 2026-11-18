const prisma = require('../config/prisma');
const { parseMoney, parseBoolean } = require('../utils/validationUtils');
const { logAuditEvent } = require('../utils/auditLogger');

// Helper to generate sequential unique Expense Voucher No
const generateExpenseNo = async () => {
  const count = await prisma.expense.count();
  const year = new Date().getFullYear();
  const nextNum = (count + 1).toString().padStart(4, '0');
  return `EXP-${year}-${nextNum}`;
};

// 1. Get All Expenses with Search, Dynamic Date Filter, and Category Filter
const getAllExpenses = async (req, res) => {
  try {
    const {
      search,
      category,
      paymentMethod,
      startDate,
      endDate,
      period,
      page = 1,
      limit = 50,
      includeArchived
    } = req.query;

    const whereConditions = [];

    if (!parseBoolean(includeArchived, false)) {
      whereConditions.push({ isArchived: false });
    }

    // Category Filter
    if (category && category !== 'ALL') {
      whereConditions.push({ category });
    }

    // Payment Method Filter
    if (paymentMethod && paymentMethod !== 'ALL') {
      whereConditions.push({ paymentMethod });
    }

    // Dynamic Date Range Filter
    const now = new Date();
    if (period === 'today' || period === 'TODAY') {
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      whereConditions.push({ expenseDate: { gte: todayStart, lte: todayEnd } });
    } else if (period === 'yesterday' || period === 'YESTERDAY') {
      const yStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 0, 0, 0, 0);
      const yEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59, 999);
      whereConditions.push({ expenseDate: { gte: yStart, lte: yEnd } });
    } else if (period === 'week' || period === 'this_week' || period === 'WEEKLY') {
      const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7, 0, 0, 0, 0);
      whereConditions.push({ expenseDate: { gte: weekStart } });
    } else if (period === 'month' || period === 'this_month' || period === 'MONTHLY') {
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      whereConditions.push({ expenseDate: { gte: monthStart } });
    } else if (startDate && endDate) {
      const [sy, sm, sd] = startDate.split('-').map(Number);
      const [ey, em, ed] = endDate.split('-').map(Number);
      whereConditions.push({
        expenseDate: {
          gte: new Date(sy, sm - 1, sd, 0, 0, 0, 0),
          lte: new Date(ey, em - 1, ed, 23, 59, 59, 999)
        }
      });
    }

    // Search Filter (Voucher No, Title, Paid To, Reference No, Notes)
    if (search && search.trim()) {
      const q = search.trim();
      whereConditions.push({
        OR: [
          { expenseNo: { contains: q, mode: 'insensitive' } },
          { title: { contains: q, mode: 'insensitive' } },
          { paidTo: { contains: q, mode: 'insensitive' } },
          { referenceNo: { contains: q, mode: 'insensitive' } },
          { notes: { contains: q, mode: 'insensitive' } },
          { category: { contains: q, mode: 'insensitive' } },
          { recordedBy: { contains: q, mode: 'insensitive' } }
        ]
      });
    }

    const where = whereConditions.length > 0 ? { AND: whereConditions } : {};

    const pageNum = Math.max(parseInt(page) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit) || 50, 1), 100);
    const skip = (pageNum - 1) * limitNum;

    // Parallel fetch for expenses slice, filtered count, and KPI summary stats
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);

    const [
      expenses,
      filteredCount,
      allTotalAgg,
      todayTotalAgg,
      monthTotalAgg
    ] = await Promise.all([
      prisma.expense.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { expenseDate: 'desc' }
      }),
      prisma.expense.count({ where }),
      prisma.expense.aggregate({
        where,
        _sum: { amount: true }
      }),
      prisma.expense.aggregate({
        where: { expenseDate: { gte: todayStart, lte: todayEnd } },
        _sum: { amount: true },
        _count: true
      }),
      prisma.expense.aggregate({
        where: { expenseDate: { gte: monthStart } },
        _sum: { amount: true },
        _count: true
      })
    ]);

    const totalFilteredAmount = allTotalAgg._sum.amount || 0;
    const todayTotalAmount = todayTotalAgg._sum.amount || 0;
    const todayCount = todayTotalAgg._count || 0;
    const monthTotalAmount = monthTotalAgg._sum.amount || 0;
    const monthCount = monthTotalAgg._count || 0;

    return res.status(200).json({
      success: true,
      count: expenses.length,
      totalCount: filteredCount,
      totalPages: Math.ceil(filteredCount / limitNum) || 1,
      currentPage: pageNum,
      limit: limitNum,
      stats: {
        filteredTotal: totalFilteredAmount,
        todayTotal: todayTotalAmount,
        todayCount,
        monthTotal: monthTotalAmount,
        monthCount
      },
      expenses
    });
  } catch (error) {
    console.error('getAllExpenses error:', error);
    return res.status(500).json({ success: false, message: 'Failed to retrieve expenses.' });
  }
};

// 2. Create New Hospital Expense / Petty Cash Entry
const createExpense = async (req, res) => {
  try {
    const {
      title,
      category,
      amount,
      paymentMethod,
      paidTo,
      referenceNo,
      expenseDate,
      notes
    } = req.body;

    const finalTitle = (title && title.trim()) ? title.trim() : (category || 'General Hospital Expense');

    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) {
      return res.status(400).json({ success: false, message: 'Please enter a valid expense amount greater than 0.' });
    }

    const expenseNo = await generateExpenseNo();
    const recordedBy = req.user?.name || 'Front Desk Staff';

    let parsedExpenseDate = new Date();
    if (expenseDate) {
      if (typeof expenseDate === 'string' && expenseDate.length === 10) {
        const [y, m, d] = expenseDate.split('-').map(Number);
        parsedExpenseDate = new Date(y, m - 1, d, 12, 0, 0, 0);
      } else {
        parsedExpenseDate = new Date(expenseDate);
      }
    }

    const newExpense = await prisma.expense.create({
      data: {
        expenseNo,
        title: finalTitle,
        category: category || 'Miscellaneous',
        amount: amt,
        paymentMethod: paymentMethod || 'CASH',
        paidTo: paidTo ? paidTo.trim() : null,
        referenceNo: referenceNo ? referenceNo.trim() : null,
        expenseDate: parsedExpenseDate,
        recordedBy,
        notes: notes ? notes.trim() : null
      }
    });

    return res.status(201).json({
      success: true,
      message: `Expense voucher ${expenseNo} recorded successfully!`,
      expense: newExpense
    });
  } catch (error) {
    console.error('createExpense error:', error);
    return res.status(500).json({ success: false, message: 'Failed to create expense record.' });
  }
};

// 3. Update Existing Expense Record
const updateExpense = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title,
      category,
      amount,
      paymentMethod,
      paidTo,
      referenceNo,
      expenseDate,
      notes
    } = req.body;

    const existing = await prisma.expense.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Expense record not found.' });
    }

    const updateData = {};
    if (title && title.trim()) updateData.title = title.trim();
    if (category) updateData.category = category;
    if (amount !== undefined) {
      const amt = parseFloat(amount);
      if (!isNaN(amt) && amt >= 0) updateData.amount = amt;
    }
    if (paymentMethod) updateData.paymentMethod = paymentMethod;
    if (paidTo !== undefined) updateData.paidTo = paidTo ? paidTo.trim() : null;
    if (referenceNo !== undefined) updateData.referenceNo = referenceNo ? referenceNo.trim() : null;
    if (expenseDate) updateData.expenseDate = new Date(expenseDate);
    if (notes !== undefined) updateData.notes = notes ? notes.trim() : null;

    const updated = await prisma.expense.update({
      where: { id },
      data: updateData
    });

    return res.status(200).json({
      success: true,
      message: 'Expense record updated successfully',
      expense: updated
    });
  } catch (error) {
    console.error('updateExpense error:', error);
    return res.status(500).json({ success: false, message: 'Failed to update expense record.' });
  }
};

// 4. Delete / Archive Expense (Preserves financial accounting audit log)
const deleteExpense = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body || {};

    const existing = await prisma.expense.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Expense record not found.' });
    }

    const exp = await prisma.expense.update({
      where: { id },
      data: {
        isArchived: true,
        archivedAt: new Date(),
        archivedReason: reason || 'Archived via administrative expense action'
      }
    });

    await logAuditEvent({
      action: 'EXPENSE_ARCHIVED',
      entity: 'Expense',
      entityId: id,
      details: { expenseNo: existing.expenseNo, category: existing.category, amount: existing.amount, reason },
      req
    });

    return res.status(200).json({
      success: true,
      message: `Expense voucher ${existing.expenseNo} safely archived without losing financial accounting history.`,
      expense: exp
    });
  } catch (error) {
    console.error('deleteExpense error:', error);
    return res.status(500).json({ success: false, message: 'Failed to archive expense record.' });
  }
};

// 5. Category Breakdown & Financial Stats
const getExpenseStats = async (req, res) => {
  try {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);

    const [categoriesAgg, todayAgg, monthAgg, totalAgg] = await Promise.all([
      prisma.expense.groupBy({
        by: ['category'],
        _sum: { amount: true },
        _count: true,
        orderBy: {
          _sum: {
            amount: 'desc'
          }
        }
      }),
      prisma.expense.aggregate({
        where: { expenseDate: { gte: todayStart } },
        _sum: { amount: true },
        _count: true
      }),
      prisma.expense.aggregate({
        where: { expenseDate: { gte: monthStart } },
        _sum: { amount: true },
        _count: true
      }),
      prisma.expense.aggregate({
        _sum: { amount: true },
        _count: true
      })
    ]);

    return res.status(200).json({
      success: true,
      stats: {
        totalAmount: totalAgg._sum.amount || 0,
        totalCount: totalAgg._count || 0,
        todayAmount: todayAgg._sum.amount || 0,
        todayCount: todayAgg._count || 0,
        monthAmount: monthAgg._sum.amount || 0,
        monthCount: monthAgg._count || 0,
        categories: categoriesAgg.map(c => ({
          category: c.category,
          totalAmount: c._sum.amount || 0,
          count: c._count || 0
        }))
      }
    });
  } catch (error) {
    console.error('getExpenseStats error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch expense analytics.' });
  }
};

module.exports = {
  getAllExpenses,
  createExpense,
  updateExpense,
  deleteExpense,
  getExpenseStats
};
