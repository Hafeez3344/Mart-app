const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

router.get('/financial', authenticateToken, authorizeRoles('ADMIN', 'ACCOUNTANT'), reportController.getFinancialReport);
router.get('/top-products', authenticateToken, authorizeRoles('ADMIN', 'MANAGER'), reportController.getTopSellingProducts);
router.get('/stock-valuation', authenticateToken, authorizeRoles('ADMIN', 'MANAGER', 'ACCOUNTANT'), reportController.getStockValuationReport);

module.exports = router;

