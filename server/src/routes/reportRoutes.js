const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const { authenticateToken } = require('../middleware/auth');

router.get('/financial', authenticateToken, reportController.getFinancialReport);
router.get('/top-products', authenticateToken, reportController.getTopSellingProducts);
router.get('/stock-valuation', authenticateToken, reportController.getStockValuationReport);

module.exports = router;

