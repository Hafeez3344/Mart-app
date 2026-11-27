const express = require('express');
const router = express.Router();
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const {
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
} = require('../controllers/staffController');

const {
  getMonthlyAttendance,
  markAttendance,
  bulkMarkAttendance
} = require('../controllers/attendanceController');

const {
  getAdvances,
  getStaffAdvanceBalance,
  giveAdvance,
  updateAdvance,
  deleteAdvance
} = require('../controllers/advanceController');

// All staff routes require authentication
router.use(authenticateToken);

// Staff Attendance APIs (Admin & Manager)
router.get('/attendance', authorizeRoles('ADMIN', 'MANAGER'), getMonthlyAttendance);
router.post('/attendance', authorizeRoles('ADMIN', 'MANAGER'), markAttendance);
router.post('/attendance/bulk-mark', authorizeRoles('ADMIN', 'MANAGER'), bulkMarkAttendance);

// Staff Advances & Loans APIs (Admin Only)
router.get('/advances', authorizeRoles('ADMIN'), getAdvances);
router.get('/:id/advance-balance', authorizeRoles('ADMIN'), getStaffAdvanceBalance);
router.post('/:id/give-advance', authorizeRoles('ADMIN'), giveAdvance);
router.put('/advances/:id', authorizeRoles('ADMIN'), updateAdvance);
router.delete('/advances/:id', authorizeRoles('ADMIN'), deleteAdvance);

// Staff Profile (Protected for self profile)
router.get('/profile', getStaffProfile);
router.get('/me', getStaffProfile);

// Salary Disbursements, Attendance Summary & Payroll History (Admin Only)
router.get('/salaries/all', authorizeRoles('ADMIN'), getAllSalaryRecords);
router.put('/salaries/:id', authorizeRoles('ADMIN'), updateSalaryRecord);
router.delete('/salaries/:id', authorizeRoles('ADMIN'), deleteSalaryRecord);
router.get('/:id/salary-summary', authorizeRoles('ADMIN'), getStaffSalarySummary);
router.post('/:id/pay-salary', authorizeRoles('ADMIN'), payStaffSalary);
router.post('/:id/salaries', authorizeRoles('ADMIN'), payStaffSalary);
router.put('/:id/assign-salary', authorizeRoles('ADMIN'), assignSalary);

// Staff Directory Management CRUD (Admin Only)
router.get('/all', authorizeRoles('ADMIN', 'MANAGER'), getAllStaff);
router.post('/', authorizeRoles('ADMIN'), createStaff);
router.put('/:id', authorizeRoles('ADMIN'), updateStaff);
router.delete('/:id', authorizeRoles('ADMIN'), deleteStaff);

module.exports = router;

