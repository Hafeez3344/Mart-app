const express = require('express');
const router = express.Router();
const supplierController = require('../controllers/supplierController');
const { authenticateToken } = require('../middleware/auth');

router.get('/', authenticateToken, supplierController.getAllSuppliers);
router.get('/:id', authenticateToken, supplierController.getSupplierById);
router.post('/', authenticateToken, supplierController.createSupplier);
router.put('/:id', authenticateToken, supplierController.updateSupplier);
router.delete('/:id', authenticateToken, supplierController.deleteSupplier);

// Purchase Stock-In Invoices
router.post('/purchases', authenticateToken, supplierController.createPurchaseInvoice);

// Supplier Payments
router.post('/payments', authenticateToken, supplierController.recordSupplierPayment);

module.exports = router;

