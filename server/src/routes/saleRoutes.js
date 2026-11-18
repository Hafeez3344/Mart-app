const express = require('express');
const router = express.Router();
const posController = require('../controllers/posController');
const { authenticateToken } = require('../middleware/auth');

router.get('/', authenticateToken, posController.getAllSales);
router.get('/:invoiceNo', authenticateToken, posController.getSaleByInvoice);
router.post('/returns', authenticateToken, posController.processSaleReturn);

module.exports = router;

