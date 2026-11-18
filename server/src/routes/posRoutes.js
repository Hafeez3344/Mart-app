const express = require('express');
const router = express.Router();
const posController = require('../controllers/posController');
const productController = require('../controllers/productController');
const { authenticateToken } = require('../middleware/auth');

// Live barcode lookup
router.get('/scan/:barcode', productController.getProductByBarcode);

// Cart checkout & hold/parked
router.post('/checkout', authenticateToken, posController.createSale);
router.get('/parked', authenticateToken, posController.getParkedSales);
router.delete('/parked/:id', authenticateToken, posController.deleteParkedSale);

// Summary & Returns
router.get('/daily-summary', authenticateToken, posController.getDailySummary);
router.post('/returns', authenticateToken, posController.processSaleReturn);

module.exports = router;

