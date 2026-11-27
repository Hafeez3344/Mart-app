const express = require('express');
const router = express.Router();
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const {
  getAllExpenses,
  createExpense,
  updateExpense,
  deleteExpense,
  getExpenseStats
} = require('../controllers/expenseController');

router.use(authenticateToken);
router.use(authorizeRoles('ADMIN', 'MANAGER', 'ACCOUNTANT'));

router.get('/', getAllExpenses);
router.get('/stats', getExpenseStats);
router.post('/', createExpense);
router.put('/:id', updateExpense);
router.delete('/:id', deleteExpense);

module.exports = router;
