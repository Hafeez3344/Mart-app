const prisma = require('../config/prisma');
const bcrypt = require('bcryptjs');
const { generateEmployeeId } = require('../utils/idGenerator');

// 1. Get all staff members directory (Admin/Staff)
const getAllStaff = async (req, res) => {
  try {
    const staffMembers = await prisma.staff.findMany({
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
        department: true,
        salaryRecords: {
          take: 12,
          orderBy: { paymentDate: 'desc' }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return res.status(200).json({ success: true, count: staffMembers.length, staff: staffMembers, staffMembers });
  } catch (error) {
    console.error('getAllStaff error:', error);
    return res.status(500).json({ success: false, message: 'Failed to retrieve staff directory.' });
  }
};

// 2. Create Staff Member
const createStaff = async (req, res) => {
  try {
    const { name, email, password, role, designation, baseSalary, phone } = req.body;

    if (!name || !email || !password || !designation) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, password, and designation are required.'
      });
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'User account already exists with this email.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const employeeId = generateEmployeeId('STF');

    const user = await prisma.user.create({
      data: {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password: hashedPassword,
        role: role || 'STAFF'
      }
    });

    const parts = name.trim().split(' ');
    const firstName = parts[0];
    const lastName = parts.slice(1).join(' ') || '';

    const staff = await prisma.staff.create({
      data: {
        userId: user.id,
        employeeId,
        firstName,
        lastName,
        email: email.trim().toLowerCase(),
        phone: phone ? phone.trim() : null,
        designation: designation.trim(),
        baseSalary: baseSalary ? parseFloat(baseSalary) : 5000.00
      },
      include: {
        user: { select: { id: true, name: true, email: true, role: true } }
      }
    });

    return res.status(201).json({
      success: true,
      message: 'Staff profile created successfully',
      staff
    });
  } catch (error) {
    console.error('createStaff error:', error);
    return res.status(500).json({ success: false, message: 'Failed to create staff profile.' });
  }
};

// 3. Update Staff Profile
const updateStaff = async (req, res) => {
  try {
    const { id } = req.params;
    const { designation, baseSalary, phone, name, password, email, role } = req.body;

    const staff = await prisma.staff.findUnique({ where: { id } });
    if (!staff) {
      return res.status(404).json({ success: false, message: 'Staff profile not found.' });
    }

    if (staff.userId) {
      const userUpdateData = {};
      if (name) userUpdateData.name = name.trim();
      if (email) userUpdateData.email = email.trim().toLowerCase();
      if (role) userUpdateData.role = role;
      if (password && password.trim().length > 0) {
        userUpdateData.password = await bcrypt.hash(password.trim(), 10);
      }

      if (Object.keys(userUpdateData).length > 0) {
        await prisma.user.update({
          where: { id: staff.userId },
          data: userUpdateData
        });
      }
    }

    const updatedStaff = await prisma.staff.update({
      where: { id },
      data: {
        ...(designation && { designation: designation.trim() }),
        ...(baseSalary !== undefined && { baseSalary: parseFloat(baseSalary) }),
        ...(phone !== undefined && { phone: phone ? phone.trim() : null }),
        ...(email && { email: email.trim().toLowerCase() })
      },
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
        salaryRecords: {
          take: 5,
          orderBy: { paymentDate: 'desc' }
        }
      }
    });

    return res.status(200).json({
      success: true,
      message: 'Staff profile updated successfully',
      staff: updatedStaff
    });
  } catch (error) {
    console.error('updateStaff error:', error);
    return res.status(500).json({ success: false, message: 'Failed to update staff profile.' });
  }
};

// 4. Delete Staff Member
const deleteStaff = async (req, res) => {
  try {
    const { id } = req.params;

    const staff = await prisma.staff.findUnique({ where: { id } });
    if (!staff) {
      return res.status(404).json({ success: false, message: 'Staff profile not found.' });
    }

    await prisma.staff.delete({ where: { id } });

    if (staff.userId) {
      await prisma.user.delete({ where: { id: staff.userId } });
    }

    return res.status(200).json({ success: true, message: 'Staff profile deleted successfully.' });
  } catch (error) {
    console.error('deleteStaff error:', error);
    return res.status(500).json({ success: false, message: 'Failed to delete staff profile.' });
  }
};

// 5. Assign / Pay Monthly Salary to Staff Member (Integrated with Attendance & Advances)
const payStaffSalary = async (req, res) => {
  try {
    const { id } = req.params; // staffId
    const {
      month,
      year,
      basicSalary,
      totalDays,
      presentDays,
      absentDays,
      halfDays,
      leaveDays,
      offDays,
      earnedSalary,
      allowances = 0,
      deductions = 0,
      advanceDeducted = 0,
      paymentMethod = 'CASH',
      paymentDate,
      notes
    } = req.body;

    const staff = await prisma.staff.findUnique({
      where: { id },
      include: { user: true }
    });

    if (!staff) {
      return res.status(404).json({ success: false, message: 'Staff member record not found.' });
    }

    const currentYear = year ? parseInt(year) : new Date().getFullYear();
    const currentMonth = month || new Date().toLocaleString('en-US', { month: 'long' });

    const basic = basicSalary !== undefined ? parseFloat(basicSalary) : parseFloat(staff.baseSalary || 5000);
    const allow = parseFloat(allowances) || 0;
    const deduct = parseFloat(deductions) || 0;
    const advDeduct = parseFloat(advanceDeducted) || 0;
    const earned = earnedSalary !== undefined ? parseFloat(earnedSalary) : basic;

    // Net formula: Earned Pay (or Basic if no attendance) + Allowances - Deductions (including advances)
    const net = Math.max(0, (earned || basic) + allow - deduct);
    const payDate = paymentDate ? new Date(paymentDate) : new Date();
    const recordedBy = req.user?.name || req.user?.email || 'Administrator';

    // Concurrency-safe atomic transaction for payroll disbursement & advance deduction
    const salaryRecord = await prisma.$transaction(async (tx) => {
      // 1. Transactional advisory lock on staffId + month + year
      const lockKey = `salary_${staff.id}_${currentMonth}_${currentYear}`;
      await tx.$executeRawUnsafe('SELECT pg_advisory_xact_lock(hashtext($1))', lockKey);

      // 2. Prevent duplicate salary generation for the same staff member for the same month/year
      const existingSalary = await tx.salaryRecord.findFirst({
        where: {
          staffId: staff.id,
          month: currentMonth,
          year: currentYear
        }
      });

      if (existingSalary) {
        throw new Error(`Salary for ${staff.firstName} ${staff.lastName} for ${currentMonth} ${currentYear} has already been disbursed (Record #${existingSalary.id.slice(0, 8)}).`);
      }

      // 3. Recover advance balances FIFO if advanceDeducted > 0
      if (advDeduct > 0) {
        let remainingToRecover = advDeduct;
        const unrecoveredAdvances = await tx.staffAdvance.findMany({
          where: {
            staffId: staff.id,
            status: { in: ['UNRECOVERED', 'PARTIAL'] },
            balance: { gt: 0 }
          },
          orderBy: { createdAt: 'asc' }
        });

        for (const adv of unrecoveredAdvances) {
          if (remainingToRecover <= 0) break;
          const deductFromThis = Math.min(adv.balance, remainingToRecover);
          const newBalance = adv.balance - deductFromThis;
          const newRecovered = (adv.recovered || 0) + deductFromThis;
          const newStatus = newBalance <= 0 ? 'RECOVERED' : 'PARTIAL';

          await tx.staffAdvance.update({
            where: { id: adv.id },
            data: {
              balance: newBalance,
              recovered: newRecovered,
              status: newStatus
            }
          });

          remainingToRecover -= deductFromThis;
        }
      }

      // 4. Create the SalaryRecord atomically
      const createdRecord = await tx.salaryRecord.create({
        data: {
          staffId: staff.id,
          month: currentMonth,
          year: currentYear,
          basicSalary: basic,
          totalDays: totalDays !== undefined ? parseInt(totalDays) : 30,
          presentDays: presentDays !== undefined ? parseFloat(presentDays) : 30,
          absentDays: absentDays !== undefined ? parseFloat(absentDays) : 0,
          halfDays: halfDays !== undefined ? parseFloat(halfDays) : 0,
          leaveDays: leaveDays !== undefined ? parseFloat(leaveDays) : 0,
          offDays: offDays !== undefined ? parseFloat(offDays) : 0,
          earnedSalary: earned,
          allowances: allow,
          deductions: deduct,
          advanceDeducted: advDeduct,
          netSalary: net,
          paymentMethod: paymentMethod || 'CASH',
          paymentDate: payDate,
          status: 'PAID',
          notes: notes ? notes.trim() : null,
          recordedBy
        }
      });

      return createdRecord;
    });

    const staffFullName = `${staff.firstName} ${staff.lastName}`;

    return res.status(201).json({
      success: true,
      message: `Salary of Rs. ${net.toLocaleString()} for ${currentMonth} ${currentYear} disbursed successfully to ${staffFullName}!`,
      salaryRecord
    });
  } catch (error) {
    console.error('payStaffSalary error:', error);
    const isClientErr = error.message?.includes('already been disbursed') || error.message?.includes('not found');
    return res.status(isClientErr ? 400 : 500).json({ success: false, message: error.message || 'Failed to record staff salary payment.' });
  }
};

// 5b. Get Detailed Salary & Attendance Calculation Summary for a Staff Member
const getStaffSalarySummary = async (req, res) => {
  try {
    const { id } = req.params; // staffId
    const targetMonth = req.query.month || new Date().toISOString().slice(0, 7); // e.g. "2026-09"

    const staff = await prisma.staff.findUnique({
      where: { id },
      include: {
        department: { select: { name: true } }
      }
    });

    if (!staff) {
      return res.status(404).json({ success: false, message: 'Staff member record not found.' });
    }

    const [yearStr, monthStr] = targetMonth.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);
    const daysInMonth = new Date(year, month, 0).getDate();

    // Month name in English (e.g. "September")
    const dateObj = new Date(year, month - 1, 1);
    const monthName = dateObj.toLocaleString('en-US', { month: 'long' });

    // Fetch attendance records for this staff in this month
    const attendanceRecords = await prisma.staffAttendance.findMany({
      where: {
        staffId: staff.id,
        date: { startsWith: targetMonth }
      }
    });

    let presentDays = 0;
    let halfDays = 0;
    let leaveDays = 0;
    let offDays = 0;
    let absentDays = 0;

    attendanceRecords.forEach(rec => {
      if (rec.status === 'P') presentDays += 1;
      else if (rec.status === 'HD') halfDays += 1;
      else if (rec.status === 'L') leaveDays += 1;
      else if (rec.status === 'OFF') offDays += 1;
      else if (rec.status === 'A') absentDays += 1;
    });

    const baseSalary = staff.baseSalary || 0;
    const dailyWage = daysInMonth > 0 ? baseSalary / daysInMonth : 0;
    const payableDays = presentDays + offDays + leaveDays + (halfDays * 0.5);
    const earnedSalary = Math.round(dailyWage * payableDays);

    // Active unrecovered advances
    const activeAdvances = await prisma.staffAdvance.findMany({
      where: {
        staffId: staff.id,
        status: { in: ['UNRECOVERED', 'PARTIAL'] },
        balance: { gt: 0 }
      },
      orderBy: { createdAt: 'asc' }
    });

    const unrecoveredAdvance = activeAdvances.reduce((sum, a) => sum + (a.balance || 0), 0);

    // Check if salary for this month/year was already disbursed
    const existingSalary = await prisma.salaryRecord.findFirst({
      where: {
        staffId: staff.id,
        month: monthName,
        year
      }
    });

    return res.status(200).json({
      success: true,
      staffId: staff.id,
      staffName: `${staff.firstName} ${staff.lastName}`.trim(),
      designation: staff.designation,
      department: staff.department?.name || 'General',
      targetMonth,
      monthName,
      year,
      daysInMonth,
      attendanceMarkedCount: attendanceRecords.length,
      presentDays,
      halfDays,
      leaveDays,
      offDays,
      absentDays,
      payableDays,
      dailyWage: Math.round(dailyWage * 100) / 100,
      baseSalary,
      earnedSalary,
      unrecoveredAdvance,
      isAlreadyPaid: !!existingSalary,
      existingSalaryRecord: existingSalary || null
    });
  } catch (error) {
    console.error('getStaffSalarySummary error:', error);
    return res.status(500).json({ success: false, message: 'Failed to calculate salary summary.' });
  }
};

// Assign or update base monthly salary directly
const assignSalary = async (req, res) => {
  try {
    const { id } = req.params;
    const { baseSalary, designation } = req.body;

    const parsedSalary = parseFloat(baseSalary);
    if (isNaN(parsedSalary) || parsedSalary < 0) {
      return res.status(400).json({ success: false, message: 'Please enter a valid salary amount.' });
    }

    const updated = await prisma.staff.update({
      where: { id },
      data: {
        baseSalary: parsedSalary,
        ...(designation && { designation: designation.trim() })
      },
      include: {
        user: { select: { id: true, name: true, email: true, role: true } }
      }
    });

    return res.status(200).json({
      success: true,
      message: `Base salary for ${updated.firstName} ${updated.lastName} updated to Rs. ${parsedSalary.toLocaleString()}`,
      staff: updated
    });
  } catch (error) {
    console.error('assignSalary error:', error);
    return res.status(500).json({ success: false, message: 'Failed to assign staff salary.' });
  }
};

// 6. Get Logged-in Staff Member's Profile & Salaries
const getStaffProfile = async (req, res) => {
  try {
    const userId = req.user.id;

    // 1. Try to find direct staff record
    let staff = await prisma.staff.findUnique({
      where: { userId },
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
        department: true,
        salaryRecords: {
          orderBy: { paymentDate: 'desc' }
        }
      }
    });

    // 2. If user is logged in as STAFF or DOCTOR or FRONT_DESK but no staff row yet, check or create stub
    if (!staff) {
      const userRecord = await prisma.user.findUnique({ where: { id: userId } });
      if (userRecord) {
        const parts = (userRecord.name || 'Staff User').split(' ');
        const firstName = parts[0];
        const lastName = parts.slice(1).join(' ') || '';
        const employeeId = generateEmployeeId(userRecord.role === 'FRONT_DESK' ? 'FD' : 'STF');

        staff = await prisma.staff.create({
          data: {
            userId: userRecord.id,
            employeeId,
            firstName,
            lastName,
            email: userRecord.email,
            designation: userRecord.role === 'FRONT_DESK' ? 'Front Desk Executive' : 'Senior Staff Member',
            baseSalary: 45000.00
          },
          include: {
            user: { select: { id: true, name: true, email: true, role: true } },
            department: true,
            salaryRecords: true
          }
        }).catch(() => null);
      }
    }

    if (!staff) {
      return res.status(404).json({ success: false, message: 'Staff record not found for this user account.' });
    }

    const basic = staff.baseSalary || 45000;
    const allowances = 5000;
    const deductions = 1500;
    const netSalary = basic + allowances - deductions;

    return res.status(200).json({
      success: true,
      staff: {
        id: staff.id,
        employeeId: staff.employeeId,
        name: `${staff.firstName} ${staff.lastName}`,
        email: staff.email,
        phone: staff.phone || 'N/A',
        role: req.user.role,
        designation: staff.designation,
        department: staff.department?.name || 'Hospital Administration',
        joiningDate: staff.joiningDate,
        status: staff.status
      },
      salarySummary: {
        baseSalary: basic,
        allowances,
        deductions,
        netSalary
      },
      salaryRecords: staff.salaryRecords || []
    });
  } catch (error) {
    console.error('getStaffProfile error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch staff profile details.' });
  }
};

// 7. Get All Salary Disbursement Ledger (For Admin & Frontdesk)
const getAllSalaryRecords = async (req, res) => {
  try {
    const { month, year, staffId } = req.query;
    const where = {};
    if (month && month !== 'ALL') where.month = month;
    if (year && year !== 'ALL') where.year = parseInt(year);
    if (staffId) where.staffId = staffId;

    const records = await prisma.salaryRecord.findMany({
      where,
      include: {
        staff: {
          include: { department: true }
        }
      },
      orderBy: { paymentDate: 'desc' }
    });

    const totalPaid = records.reduce((sum, r) => sum + (r.netSalary || 0), 0);

    return res.status(200).json({
      success: true,
      count: records.length,
      totalPaid,
      salaryRecords: records
    });
  } catch (error) {
    console.error('getAllSalaryRecords error:', error);
    return res.status(500).json({ success: false, message: 'Failed to retrieve salary records.' });
  }
};

// 8. Update Salary Record
const updateSalaryRecord = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      basicSalary,
      earnedSalary,
      allowances,
      deductions,
      netSalary,
      paymentMethod,
      paymentDate,
      notes,
      month,
      year
    } = req.body;

    const existing = await prisma.salaryRecord.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Salary record not found.' });
    }

    const updated = await prisma.salaryRecord.update({
      where: { id },
      data: {
        ...(basicSalary !== undefined ? { basicSalary: parseFloat(basicSalary) } : {}),
        ...(earnedSalary !== undefined ? { earnedSalary: parseFloat(earnedSalary) } : {}),
        ...(allowances !== undefined ? { allowances: parseFloat(allowances) } : {}),
        ...(deductions !== undefined ? { deductions: parseFloat(deductions) } : {}),
        ...(netSalary !== undefined ? { netSalary: parseFloat(netSalary) } : {}),
        ...(paymentMethod ? { paymentMethod } : {}),
        ...(paymentDate ? { paymentDate: new Date(paymentDate) } : {}),
        ...(notes !== undefined ? { notes: notes ? notes.trim() : null } : {}),
        ...(month ? { month } : {}),
        ...(year ? { year: parseInt(year) } : {})
      },
      include: {
        staff: {
          include: { department: true }
        }
      }
    });

    return res.status(200).json({
      success: true,
      message: 'Salary record updated successfully.',
      salaryRecord: updated
    });
  } catch (error) {
    console.error('updateSalaryRecord error:', error);
    return res.status(500).json({ success: false, message: 'Failed to update salary record.' });
  }
};

// 9. Delete Salary Record (with automatic advance recovery reversal)
const deleteSalaryRecord = async (req, res) => {
  try {
    const { id } = req.params;

    const record = await prisma.salaryRecord.findUnique({
      where: { id },
      include: { staff: true }
    });

    if (!record) {
      return res.status(404).json({ success: false, message: 'Salary record not found.' });
    }

    // If this salary deducted an advance, reverse the recovery back to StaffAdvance
    const advDeducted = parseFloat(record.advanceDeducted) || 0;
    if (advDeducted > 0) {
      let toRestore = advDeducted;
      const recoveredAdvances = await prisma.staffAdvance.findMany({
        where: {
          staffId: record.staffId,
          recovered: { gt: 0 }
        },
        orderBy: { updatedAt: 'desc' }
      });

      for (const adv of recoveredAdvances) {
        if (toRestore <= 0) break;
        const restoreAmount = Math.min(adv.recovered, toRestore);
        const newRecovered = Math.max(0, adv.recovered - restoreAmount);
        const newBalance = adv.balance + restoreAmount;
        const newStatus = newRecovered === 0 ? 'UNRECOVERED' : 'PARTIAL';

        await prisma.staffAdvance.update({
          where: { id: adv.id },
          data: {
            recovered: newRecovered,
            balance: newBalance,
            status: newStatus
          }
        });
        toRestore -= restoreAmount;
      }
    }

    // Delete the salary record
    await prisma.salaryRecord.delete({
      where: { id }
    });

    return res.status(200).json({
      success: true,
      message: `Salary record for ${record.month} ${record.year} deleted successfully${advDeducted > 0 ? ` (Rs. ${advDeducted.toLocaleString()} advance restored to balance)` : ''}.`
    });
  } catch (error) {
    console.error('deleteSalaryRecord error:', error);
    return res.status(500).json({ success: false, message: 'Failed to delete salary record.' });
  }
};

module.exports = {
  getAllStaff,
  createStaff,
  updateStaff,
  deleteStaff,
  payStaffSalary,
  getStaffSalarySummary,
  assignSalary,
  getStaffProfile,
  getAllSalaryRecords,
  updateSalaryRecord,
  deleteSalaryRecord
};
