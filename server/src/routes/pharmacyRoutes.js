const express = require('express');
const router = express.Router();
const {
  getAllCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  getAllPackagingUnits,
  createPackagingUnit,
  updatePackagingUnit,
  deletePackagingUnit,
  getAllMedicines,
  getMedicineByBarcode,
  createMedicine,
  updateMedicine,
  deleteMedicine,
  getAllSuppliers,
  createSupplier,
  softDeleteSupplier,
  createSupplierPurchase,
  updateSupplierPurchase,
  deleteSupplierPurchase,
  recordSupplierPayment,
  updateSupplierPayment,
  deleteSupplierPayment,
  createPharmacySale,
  updatePharmacySale,
  getAllSales,
  getSaleById,
  getGlobalDueKpi,
  getCustomerDueSummary,
  softDeleteCustomerDue,
  recordIndividualDuePayment,
  recordFifoPayment,
  getPaymentHistory,
  editCustomerPayment,
  processPharmacyReturn,
  getAllReturns,
  getCustomerLedgers,
  getPharmacyDashboardSummary
} = require('../controllers/pharmacyController');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

router.use(authenticateToken);

// Dashboard Summary
router.get('/summary', getPharmacyDashboardSummary);

// Category Management
router.get('/categories', getAllCategories);
router.post('/categories', authorizeRoles('ADMIN', 'PHARMACY', 'STAFF'), createCategory);
router.put('/categories/:id', authorizeRoles('ADMIN', 'PHARMACY', 'STAFF'), updateCategory);
router.delete('/categories/:id', authorizeRoles('ADMIN', 'PHARMACY'), deleteCategory);

// Packaging Units Management
router.get('/units', getAllPackagingUnits);
router.post('/units', authorizeRoles('ADMIN', 'PHARMACY', 'STAFF'), createPackagingUnit);
router.put('/units/:id', authorizeRoles('ADMIN', 'PHARMACY', 'STAFF'), updatePackagingUnit);
router.delete('/units/:id', authorizeRoles('ADMIN', 'PHARMACY'), deletePackagingUnit);

// Medicines Inventory & Barcode Scan
router.get('/medicines', getAllMedicines);
router.get('/medicines/barcode/:barcode', getMedicineByBarcode);
router.post('/medicines', authorizeRoles('ADMIN', 'PHARMACY', 'STAFF'), createMedicine);
router.put('/medicines/:id', authorizeRoles('ADMIN', 'PHARMACY', 'STAFF'), updateMedicine);
router.delete('/medicines/:id', authorizeRoles('ADMIN', 'PHARMACY'), deleteMedicine);

// POS Sales & Billing
router.get('/sales', getAllSales);
router.get('/sales/:id', getSaleById);
router.post('/sales', authorizeRoles('ADMIN', 'PHARMACY', 'STAFF', 'FRONT_DESK', 'ACCOUNTANT'), createPharmacySale);
router.put('/sales/:id', authorizeRoles('ADMIN', 'PHARMACY', 'STAFF', 'FRONT_DESK', 'ACCOUNTANT'), updatePharmacySale);

// Customer Dues, FIFO Payment & Payment History
router.get('/dues/kpi', getGlobalDueKpi);
router.get('/dues/summary', getCustomerDueSummary);
router.delete('/dues/customer/:id', authorizeRoles('ADMIN', 'PHARMACY', 'ACCOUNTANT'), softDeleteCustomerDue);
router.get('/dues/payments', getPaymentHistory);
router.post('/dues/record-payment', recordIndividualDuePayment);
router.post('/dues/fifo-payment', recordFifoPayment);
router.put('/dues/payments/:paymentId', editCustomerPayment);

// Sales Returns / Refunds (Restocks Inventory)
router.get('/returns', getAllReturns);
router.post('/returns', authorizeRoles('ADMIN', 'PHARMACY', 'ACCOUNTANT'), processPharmacyReturn);

// Suppliers & Purchase Ledgers / Payments
router.get('/suppliers', getAllSuppliers);
router.post('/suppliers', authorizeRoles('ADMIN', 'PHARMACY', 'ACCOUNTANT'), createSupplier);
router.delete('/suppliers/:id', authorizeRoles('ADMIN', 'PHARMACY'), softDeleteSupplier);
router.post('/suppliers/purchases', authorizeRoles('ADMIN', 'PHARMACY', 'ACCOUNTANT'), createSupplierPurchase);
router.put('/suppliers/purchases/:id', authorizeRoles('ADMIN', 'PHARMACY', 'ACCOUNTANT'), updateSupplierPurchase);
router.delete('/suppliers/purchases/:id', authorizeRoles('ADMIN', 'PHARMACY', 'ACCOUNTANT'), deleteSupplierPurchase);
router.post('/suppliers/payment', authorizeRoles('ADMIN', 'PHARMACY', 'ACCOUNTANT'), recordSupplierPayment);
router.put('/suppliers/payments/:id', authorizeRoles('ADMIN', 'PHARMACY', 'ACCOUNTANT'), updateSupplierPayment);
router.delete('/suppliers/payments/:id', authorizeRoles('ADMIN', 'PHARMACY', 'ACCOUNTANT'), deleteSupplierPayment);

// Customer Ledgers
router.get('/customers', getCustomerLedgers);

module.exports = router;
