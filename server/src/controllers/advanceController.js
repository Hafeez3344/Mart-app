const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Get all staff advance / loan records
 * GET /api/staff/advances
 */
exports.getAdvances = async (req, res) => {
  try {
    const { staffId, status } = req.query;

    const where = {};
    if (staffId) where.staffId = staffId;
    if (status && status !== 'ALL') where.status = status;

    const advances = await prisma.staffAdvance.findMany({
      where,
      include: {
        staff: {
          select: {
            id: true,
            employeeId: true,
            firstName: true,
            lastName: true,
            designation: true,
            baseSalary: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const totalIssued = advances.reduce((sum, a) => sum + (a.amount || 0), 0);
    const totalRecovered = advances.reduce((sum, a) => sum + (a.recovered || 0), 0);
    const totalUnrecovered = advances.reduce((sum, a) => sum + (a.balance || 0), 0);

    res.json({
      success: true,
      data: advances,
      stats: {
        totalIssued,
        totalRecovered,
        totalUnrecovered
      }
    });
  } catch (error) {
    console.error('Error fetching staff advances:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Get remaining unrecovered advance balance for a specific staff member
 * GET /api/staff/:id/advance-balance
 */
exports.getStaffAdvanceBalance = async (req, res) => {
  try {
    const staffId = req.params.id;

    const unrecoveredAdvances = await prisma.staffAdvance.findMany({
      where: {
        staffId,
        status: { in: ['UNRECOVERED', 'PARTIAL'] },
        balance: { gt: 0 }
      },
      orderBy: { createdAt: 'asc' }
    });

    const totalBalance = unrecoveredAdvances.reduce((sum, a) => sum + a.balance, 0);

    res.json({
      success: true,
      staffId,
      unrecoveredBalance: totalBalance,
      advances: unrecoveredAdvances
    });
  } catch (error) {
    console.error('Error fetching advance balance:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Issue a new cash/bank advance to a staff member
 * POST /api/staff/:id/give-advance
 */
exports.giveAdvance = async (req, res) => {
  try {
    const staffId = req.params.id;
    const { amount, paymentMethod, paymentDate, reason } = req.body;

    const advanceAmount = parseFloat(amount);
    if (!advanceAmount || advanceAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Please enter a valid advance amount greater than 0' });
    }

    const staff = await prisma.staff.findUnique({
      where: { id: staffId }
    });

    if (!staff) {
      return res.status(404).json({ success: false, message: 'Staff member not found' });
    }

    // Generate unique advance reference number
    const count = await prisma.staffAdvance.count();
    const advanceNo = `ADV-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;

    const recordedBy = req.user?.name || req.user?.email || 'Admin';

    const advance = await prisma.staffAdvance.create({
      data: {
        advanceNo,
        staffId,
        amount: advanceAmount,
        recovered: 0,
        balance: advanceAmount,
        paymentMethod: paymentMethod || 'CASH',
        paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
        reason: reason || 'Staff Advance Request',
        status: 'UNRECOVERED',
        recordedBy
      }
    });

    res.json({
      success: true,
      message: `Advance of Rs. ${advanceAmount.toLocaleString()} issued successfully (${advanceNo})`,
      data: advance
    });
  } catch (error) {
    console.error('Error issuing advance:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Update an existing staff advance record
 * PUT /api/staff/advances/:id
 */
exports.updateAdvance = async (req, res) => {
  try {
    const advanceId = req.params.id;
    const { amount, paymentDate, paymentMethod, reason } = req.body;

    const adv = await prisma.staffAdvance.findUnique({
      where: { id: advanceId }
    });

    if (!adv) {
      return res.status(404).json({ success: false, message: 'Advance record not found' });
    }

    let updateData = {};
    if (paymentDate) updateData.paymentDate = new Date(paymentDate);
    if (paymentMethod) updateData.paymentMethod = paymentMethod;
    if (reason !== undefined) updateData.reason = reason;

    if (amount !== undefined) {
      const newAmount = parseFloat(amount);
      if (isNaN(newAmount) || newAmount <= 0) {
        return res.status(400).json({ success: false, message: 'Please enter a valid amount' });
      }
      if (newAmount < (adv.recovered || 0)) {
        return res.status(400).json({
          success: false,
          message: `Cannot reduce advance below already recovered amount (Rs. ${(adv.recovered || 0).toLocaleString()})`
        });
      }
      updateData.amount = newAmount;
      updateData.balance = newAmount - (adv.recovered || 0);
      updateData.status = updateData.balance <= 0 ? 'RECOVERED' : (adv.recovered > 0 ? 'PARTIAL' : 'UNRECOVERED');
    }

    const updated = await prisma.staffAdvance.update({
      where: { id: advanceId },
      data: updateData,
      include: {
        staff: {
          select: {
            id: true,
            employeeId: true,
            firstName: true,
            lastName: true,
            designation: true,
            baseSalary: true
          }
        }
      }
    });

    res.json({
      success: true,
      message: 'Advance record updated successfully',
      data: updated
    });
  } catch (error) {
    console.error('Error updating advance:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Delete or cancel an advance
 * DELETE /api/staff/advances/:id
 */
exports.deleteAdvance = async (req, res) => {
  try {
    const advanceId = req.params.id;

    const adv = await prisma.staffAdvance.findUnique({
      where: { id: advanceId }
    });

    if (!adv) {
      return res.status(404).json({ success: false, message: 'Advance record not found' });
    }

    await prisma.staffAdvance.delete({
      where: { id: advanceId }
    });

    res.json({
      success: true,
      message: `Advance record ${adv.advanceNo} deleted successfully`
    });
  } catch (error) {
    console.error('Error deleting advance:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

