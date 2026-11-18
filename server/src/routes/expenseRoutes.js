const express = require('express');
const router = express.Router();
const { optionalAuth } = require('../middleware/auth');
const {
  getAllExpenses,
  createExpense,
  updateExpense,
  deleteExpense,
  getExpenseStats
} = require('../controllers/expenseController');

router.get('/', optionalAuth, getAllExpenses);
router.get('/stats', optionalAuth, getExpenseStats);
router.post('/', optionalAuth, createExpense);
router.put('/:id', optionalAuth, updateExpense);
router.delete('/:id', optionalAuth, deleteExpense);

module.exports = router;
