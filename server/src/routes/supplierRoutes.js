const express = require('express');
const router = express.Router();
const supplierController = require('../controllers/supplierController');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

router.use(authenticateToken);
router.use(authorizeRoles('ADMIN', 'MANAGER', 'STOCK_KEEPER', 'ACCOUNTANT'));

router.get('/', supplierController.getAllSuppliers);
router.get('/:id', supplierController.getSupplierById);
router.post('/', supplierController.createSupplier);
router.put('/:id', supplierController.updateSupplier);
router.delete('/:id', authorizeRoles('ADMIN'), supplierController.deleteSupplier);

// Purchase Stock-In Invoices
router.post('/purchases', supplierController.createPurchaseInvoice);

// Supplier Payments
router.post('/payments', authorizeRoles('ADMIN', 'ACCOUNTANT'), supplierController.recordSupplierPayment);

module.exports = router;

