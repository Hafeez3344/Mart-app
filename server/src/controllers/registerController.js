const prisma = require('../config/prisma');
const { generateShiftNo } = require('../utils/idGenerator');

const getCurrentShift = async (req, res) => {
  try {
    const cashierId = req.user?.id;
    if (!cashierId) {
      return res.status(401).json({ success: false, message: 'User not authenticated.' });
    }

    const shift = await prisma.registerShift.findFirst({
      where: {
        cashierId,
        status: 'OPEN'
      },
      include: {
        movements: { orderBy: { createdAt: 'desc' } }
      }
    });

    return res.status(200).json({ success: true, shift });
  } catch (error) {
    console.error('getCurrentShift error:', error);
    return res.status(500).json({ success: false, message: 'Failed to retrieve active shift.' });
  }
};

const openShift = async (req, res) => {
  try {
    const cashierId = req.user?.id;
    const cashierName = req.user?.name || 'Cashier';
    const { openingCash, notes } = req.body;

    // Check if cashier already has an open shift
    const existing = await prisma.registerShift.findFirst({
      where: { cashierId, status: 'OPEN' }
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'You already have an active open shift. Please close it before opening a new one.',
        shift: existing
      });
    }

    const shift = await prisma.registerShift.create({
      data: {
        shiftNo: generateShiftNo(),
        cashierId,
        cashierName,
        openingCash: parseFloat(openingCash) || 0,
        status: 'OPEN',
        notes: notes?.trim() || null,
        openedAt: new Date()
      }
    });

    return res.status(201).json({
      success: true,
      message: `Shift ${shift.shiftNo} opened successfully.`,
      shift
    });
  } catch (error) {
    console.error('openShift error:', error);
    return res.status(500).json({ success: false, message: 'Failed to open register shift.' });
  }
};

const recordCashMovement = async (req, res) => {
  try {
    const { shiftId, type, amount, reason } = req.body;

    if (!shiftId || !type || !amount || parseFloat(amount) <= 0) {
      return res.status(400).json({ success: false, message: 'Shift ID, type (CASH_IN/CASH_OUT), and positive amount required.' });
    }

    const shift = await prisma.registerShift.findUnique({ where: { id: shiftId } });
    if (!shift || shift.status !== 'OPEN') {
      return res.status(400).json({ success: false, message: 'Shift is not active or not found.' });
    }

    const parsedAmount = parseFloat(amount);

    const [updatedShift, movement] = await prisma.$transaction([
      prisma.registerShift.update({
        where: { id: shiftId },
        data: {
          [type === 'CASH_IN' ? 'cashIn' : 'cashOut']: { increment: parsedAmount }
        }
      }),
      prisma.cashMovement.create({
        data: {
          shiftId,
          type,
          amount: parsedAmount,
          reason: reason?.trim() || (type === 'CASH_IN' ? 'Drawer Cash In' : 'Petty Expense Cash Out'),
          performedBy: req.user?.name || 'Cashier'
        }
      })
    ]);

    return res.status(201).json({
      success: true,
      message: `${type === 'CASH_IN' ? 'Cash In' : 'Cash Out'} of ${parsedAmount} recorded.`,
      shift: updatedShift,
      movement
    });
  } catch (error) {
    console.error('recordCashMovement error:', error);
    return res.status(500).json({ success: false, message: 'Failed to record cash movement.' });
  }
};

const closeShift = async (req, res) => {
  try {
    const { shiftId, closingCash, notes } = req.body;

    if (!shiftId || closingCash === undefined) {
      return res.status(400).json({ success: false, message: 'Shift ID and counted closing cash are required.' });
    }

    const shift = await prisma.registerShift.findUnique({
      where: { id: shiftId },
      include: {
        sales: { where: { isParked: false } }
      }
    });

    if (!shift || shift.status !== 'OPEN') {
      return res.status(400).json({ success: false, message: 'Shift is not active.' });
    }

    // Compute totals from sales during this shift
    let cashSales = 0;
    let cardSales = 0;
    let onlineSales = 0;
    let creditSales = 0;

    for (const sale of shift.sales) {
      if (sale.paymentMethod === 'CASH') cashSales += sale.paidAmount;
      else if (sale.paymentMethod === 'CARD') cardSales += sale.paidAmount;
      else if (sale.paymentMethod === 'ONLINE') onlineSales += sale.paidAmount;
      else if (sale.paymentMethod === 'CREDIT') creditSales += sale.netTotal;
    }

    const expectedCash = shift.openingCash + cashSales + shift.cashIn - shift.cashOut;
    const actualCash = parseFloat(closingCash) || 0;
    const difference = actualCash - expectedCash;

    const closed = await prisma.registerShift.update({
      where: { id: shiftId },
      data: {
        closingCash: actualCash,
        expectedCash,
        difference,
        cashSales,
        cardSales,
        onlineSales,
        creditSales,
        status: 'CLOSED',
        closedAt: new Date(),
        notes: notes ? `${shift.notes ? shift.notes + ' | ' : ''}${notes}` : shift.notes
      }
    });

    return res.status(200).json({
      success: true,
      message: `Shift ${closed.shiftNo} closed. Difference: ${difference >= 0 ? '+' : ''}${difference}.`,
      shift: closed
    });
  } catch (error) {
    console.error('closeShift error:', error);
    return res.status(500).json({ success: false, message: 'Failed to close register shift.' });
  }
};

const getAllShifts = async (req, res) => {
  try {
    const shifts = await prisma.registerShift.findMany({
      orderBy: { openedAt: 'desc' },
      take: 50,
      include: { movements: true }
    });

    return res.status(200).json({ success: true, shifts });
  } catch (error) {
    console.error('getAllShifts error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch shifts.' });
  }
};

module.exports = {
  getCurrentShift,
  openShift,
  recordCashMovement,
  closeShift,
  getAllShifts
};

