const express = require('express');
const router = express.Router();
const customerController = require('../controllers/customerController');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

router.get('/', authenticateToken, customerController.getAllCustomers);
router.get('/:id', authenticateToken, customerController.getCustomerById);
router.post('/', authenticateToken, customerController.createCustomer);
router.put('/:id', authenticateToken, customerController.updateCustomer);
router.delete('/:id', authenticateToken, authorizeRoles('ADMIN'), customerController.deleteCustomer);

// Payment received towards customer credit balance (Khata payment)
router.post('/payments', authenticateToken, customerController.receiveCustomerPayment);

module.exports = router;

