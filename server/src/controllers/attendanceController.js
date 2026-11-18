const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Get monthly attendance records and calculated attendance summary for all staff
 * GET /api/staff/attendance?month=YYYY-MM&staffId=optional
 */
exports.getMonthlyAttendance = async (req, res) => {
  try {
    const targetMonth = req.query.month || new Date().toISOString().slice(0, 7); // e.g. "2026-09"
    const { staffId } = req.query;

    const [yearStr, monthStr] = targetMonth.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);

    // Calculate total days in this calendar month
    const daysInMonth = new Date(year, month, 0).getDate();

    // Fetch active staff list
    const staffWhere = { status: 'ACTIVE' };
    if (staffId) staffWhere.id = staffId;
    if (req.query.excludeAdmin === 'true') {
      staffWhere.user = {
        role: { not: 'ADMIN' }
      };
    }

    const staffMembers = await prisma.staff.findMany({
      where: staffWhere,
      select: {
        id: true,
        employeeId: true,
        firstName: true,
        lastName: true,
        email: true,
        designation: true,
        baseSalary: true,
        user: { select: { role: true, email: true } },
        department: { select: { name: true } }
      },
      orderBy: { firstName: 'asc' }
    });

    // Fetch attendance records matching the month prefix (e.g. "2026-09%")
    const attendanceRecords = await prisma.staffAttendance.findMany({
      where: {
        date: {
          startsWith: targetMonth
        },
        ...(staffId ? { staffId } : {})
      },
      orderBy: { date: 'asc' }
    });

    // Map records by `${staffId}_${date}` for fast lookup
    const recordMap = {};
    attendanceRecords.forEach(rec => {
      recordMap[`${rec.staffId}_${rec.date}`] = rec;
    });

    // Parse targetMonth (e.g. "2026-09") to find paid salaries for this month
    const [targetYearStr, targetMonthNumStr] = targetMonth.split('-');
    const targetYearNum = parseInt(targetYearStr, 10) || new Date().getFullYear();
    const monthIndex = (parseInt(targetMonthNumStr, 10) || 1) - 1;
    const MONTH_NAMES = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    const targetMonthName = MONTH_NAMES[monthIndex] || '';

    const paidSalaries = await prisma.salaryRecord.findMany({
      where: {
        year: targetYearNum,
        month: { equals: targetMonthName, mode: 'insensitive' }
      }
    });

    const paidSalaryMap = {};
    paidSalaries.forEach(sal => {
      paidSalaryMap[sal.staffId] = sal;
    });

    // Date boundaries for target month
    const targetMonthStart = `${targetMonth}-01`;
    const targetMonthEnd = new Date(targetYearNum, monthIndex + 1, 0, 23, 59, 59, 999);

    // Fetch active unrecovered advances issued on or before targetMonthEnd
    const advances = await prisma.staffAdvance.findMany({
      where: {
        status: { in: ['UNRECOVERED', 'PARTIAL'] },
        balance: { gt: 0 },
        paymentDate: { lte: targetMonthEnd },
        ...(staffId ? { staffId } : {})
      }
    });

    // Fetch all prior attendance before targetMonth for these staff
    const priorAttendance = await prisma.staffAttendance.findMany({
      where: {
        date: { lt: targetMonthStart },
        ...(staffId ? { staffId } : {})
      }
    });

    // Fetch all salary records to know which prior months were already disbursed
    const allSalaryRecords = await prisma.salaryRecord.findMany({
      where: staffId ? { staffId } : undefined,
      select: { staffId: true, month: true, year: true }
    });

    const paidMonthKeySet = new Set(allSalaryRecords.map(s => {
      const mIdx = MONTH_NAMES.findIndex(name => name.toLowerCase() === s.month?.toLowerCase());
      return `${s.staffId}_${s.year}-${String(mIdx + 1).padStart(2, '0')}`;
    }));

    // Group prior attendance by staffId and month
    const priorByStaffAndMonth = {};
    priorAttendance.forEach(a => {
      const m = a.date.slice(0, 7);
      const key = `${a.staffId}_${m}`;
      if (!priorByStaffAndMonth[key]) priorByStaffAndMonth[key] = [];
      priorByStaffAndMonth[key].push(a);
    });

    // Compute net starting advance for each staff member entering targetMonth
    const advanceMap = {};
    staffMembers.forEach(staff => {
      const staffAdvs = advances.filter(a => a.staffId === staff.id);
      let unabsorbed = staffAdvs.reduce((sum, a) => sum + (a.balance || 0), 0);

      // Check each prior month chronologically to subtract earned wages that absorbed advance
      const staffPriorMonthKeys = Object.keys(priorByStaffAndMonth)
        .filter(k => k.startsWith(`${staff.id}_`))
        .sort();

      for (const key of staffPriorMonthKeys) {
        if (unabsorbed <= 0) break;
        if (paidMonthKeySet.has(key)) {
          // Already paid via SalaryRecord, advance was already deducted from adv.balance in DB
          continue;
        }
        // Unpaid prior month: calculate earned wage
        const recs = priorByStaffAndMonth[key];
        let pDays = 0;
        recs.forEach(r => {
          if (r.status === 'P' || r.status === 'OFF' || r.status === 'L') pDays += 1;
          else if (r.status === 'HD') pDays += 0.5;
        });
        const dWage = (staff.baseSalary || 0) / 30;
        const earnedPrior = Math.round(pDays * dWage);
        const absorbed = Math.min(unabsorbed, earnedPrior);
        unabsorbed = Math.max(0, unabsorbed - absorbed);
      }

      advanceMap[staff.id] = unabsorbed;
    });

    // Compute metrics for each staff member
    const staffSummaries = staffMembers.map(staff => {
      let presentCount = 0;
      let halfDayCount = 0;
      let leaveCount = 0;
      let offCount = 0;
      let absentCount = 0;

      const dailyRecords = {};

      for (let day = 1; day <= daysInMonth; day++) {
        const dayStr = String(day).padStart(2, '0');
        const dateKey = `${targetMonth}-${dayStr}`;
        const rec = recordMap[`${staff.id}_${dateKey}`];

        if (rec) {
          dailyRecords[dayStr] = rec.status;
          if (rec.status === 'P') presentCount += 1;
          else if (rec.status === 'HD') halfDayCount += 1;
          else if (rec.status === 'L') leaveCount += 1;
          else if (rec.status === 'OFF') offCount += 1;
          else if (rec.status === 'A') absentCount += 1;
        } else {
          // Unmarked day
          dailyRecords[dayStr] = null;
        }
      }

      const baseSalary = staff.baseSalary || 0;
      const dailyWage = daysInMonth > 0 ? baseSalary / daysInMonth : 0;
      
      // Effective payable days: Full days (P + OFF + L) + 0.5 * Half-Days
      const payableDays = presentCount + offCount + leaveCount + (halfDayCount * 0.5);
      const earnedWage = Math.round(dailyWage * payableDays);

      const paidRecord = paidSalaryMap[staff.id] || null;
      const isPaid = !!paidRecord;

      // Starting Unrecovered / Previous Advance for targetMonth
      // If salary is already paid for targetMonth, advance was already settled in payout
      const prevAdvance = isPaid ? 0 : (advanceMap[staff.id] || 0);
      const payableAmount = isPaid ? 0 : (earnedWage - prevAdvance);
      // Real-time remaining advance: as attendance is earned, advance is offset
      const remainingAdvance = isPaid ? 0 : (payableAmount < 0 ? Math.abs(payableAmount) : 0);

      return {
        staffId: staff.id,
        employeeId: staff.employeeId,
        name: `${staff.firstName} ${staff.lastName}`.trim(),
        role: staff.user?.role || 'STAFF',
        email: staff.email || staff.user?.email || '',
        designation: staff.designation || 'Staff',
        department: staff.department?.name || 'General',
        baseSalary,
        daysInMonth,
        dailyWage: Math.round(dailyWage * 100) / 100,
        presentCount,
        halfDayCount,
        leaveCount,
        offCount,
        absentCount,
        payableDays,
        earnedWage,
        prevAdvance,
        remainingAdvance,
        payableAmount,
        isPaid,
        paidRecord,
        dailyRecords
      };
    });

    res.json({
      success: true,
      month: targetMonth,
      daysInMonth,
      staffCount: staffMembers.length,
      summaries: staffSummaries,
      records: attendanceRecords
    });
  } catch (error) {
    console.error('Error getting attendance:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Mark or update single staff attendance for a specific date
 * POST /api/staff/attendance
 */
exports.markAttendance = async (req, res) => {
  try {
    const { staffId, date, status, notes } = req.body;

    if (!staffId || !date || !status) {
      return res.status(400).json({ success: false, message: 'staffId, date, and status are required' });
    }

    const validStatuses = ['P', 'A', 'HD', 'L', 'OFF'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
    }

    const markedBy = req.user?.name || req.user?.email || 'Admin';

    const attendance = await prisma.staffAttendance.upsert({
      where: {
        staffId_date: {
          staffId,
          date
        }
      },
      update: {
        status,
        notes: notes !== undefined ? notes : null,
        markedBy
      },
      create: {
        staffId,
        date,
        status,
        notes: notes || null,
        markedBy
      }
    });

    res.json({
      success: true,
      message: 'Attendance recorded successfully',
      data: attendance
    });
  } catch (error) {
    console.error('Error marking attendance:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Bulk mark all active staff members with a status for a date (e.g. "Mark All Present Today")
 * POST /api/staff/attendance/bulk-mark
 */
exports.bulkMarkAttendance = async (req, res) => {
  try {
    const date = req.body.date || new Date().toISOString().slice(0, 10);
    const status = req.body.status || 'P';
    const markedBy = req.user?.name || req.user?.email || 'Admin';

    const activeStaff = await prisma.staff.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true }
    });

    const upserts = activeStaff.map(st =>
      prisma.staffAttendance.upsert({
        where: {
          staffId_date: {
            staffId: st.id,
            date
          }
        },
        update: {
          status,
          markedBy
        },
        create: {
          staffId: st.id,
          date,
          status,
          markedBy
        }
      })
    );

    await prisma.$transaction(upserts);

    res.json({
      success: true,
      message: `Marked ${activeStaff.length} staff members as '${status}' for date ${date}`,
      count: activeStaff.length,
      date,
      status
    });
  } catch (error) {
    console.error('Error bulk marking attendance:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};
