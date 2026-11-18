const express = require('express');
const router = express.Router();
const registerController = require('../controllers/registerController');
const { authenticateToken } = require('../middleware/auth');

router.get('/current-shift', authenticateToken, registerController.getCurrentShift);
router.post('/open-shift', authenticateToken, registerController.openShift);
router.post('/cash-movement', authenticateToken, registerController.recordCashMovement);
router.post('/close-shift', authenticateToken, registerController.closeShift);
router.get('/shifts', authenticateToken, registerController.getAllShifts);

module.exports = router;

