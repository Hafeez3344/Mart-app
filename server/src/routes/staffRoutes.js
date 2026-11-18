const express = require('express');
const router = express.Router();
const { optionalAuth, authorizeRoles } = require('../middleware/auth');
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

// Staff Attendance APIs
router.get('/attendance', optionalAuth, getMonthlyAttendance);
router.post('/attendance', optionalAuth, markAttendance);
router.post('/attendance/bulk-mark', optionalAuth, bulkMarkAttendance);

// Staff Advances & Loans APIs
router.get('/advances', optionalAuth, getAdvances);
router.get('/:id/advance-balance', optionalAuth, getStaffAdvanceBalance);
router.post('/:id/give-advance', optionalAuth, giveAdvance);
router.put('/advances/:id', optionalAuth, updateAdvance);
router.delete('/advances/:id', optionalAuth, deleteAdvance);

// Staff Profile (Protected for all logged-in staff)
router.get('/profile', optionalAuth, getStaffProfile);
router.get('/me', optionalAuth, getStaffProfile);

// Salary Disbursements, Attendance Summary & Payroll History
router.get('/salaries/all', optionalAuth, getAllSalaryRecords);
router.put('/salaries/:id', optionalAuth, updateSalaryRecord);
router.delete('/salaries/:id', optionalAuth, deleteSalaryRecord);
router.get('/:id/salary-summary', optionalAuth, getStaffSalarySummary);
router.post('/:id/pay-salary', optionalAuth, payStaffSalary);
router.post('/:id/salaries', optionalAuth, payStaffSalary);
router.put('/:id/assign-salary', optionalAuth, assignSalary);

// Staff Directory Management CRUD
router.get('/all', optionalAuth, getAllStaff);
router.post('/', optionalAuth, createStaff);
router.put('/:id', optionalAuth, updateStaff);
router.delete('/:id', optionalAuth, deleteStaff);

module.exports = router;

