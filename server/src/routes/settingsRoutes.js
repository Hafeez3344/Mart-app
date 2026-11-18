const express = require('express');
const router = express.Router();
const settingsController = require('../controllers/settingsController');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

// Public route for reading store settings & LAN info
router.get('/', settingsController.getStoreSettings);
router.get('/lan', settingsController.getLanInfo);

// Protected route for updating store settings
router.put('/', authenticateToken, authorizeRoles('ADMIN', 'MANAGER'), settingsController.updateStoreSettings);

module.exports = router;
