const express = require('express');
const router = express.Router();
const { getAdminDashboardStats } = require('../controllers/adminController');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

router.use(authenticateToken);
router.use(authorizeRoles('ADMIN'));

router.get('/dashboard', getAdminDashboardStats);
router.get('/dashboard-stats', getAdminDashboardStats);

module.exports = router;
