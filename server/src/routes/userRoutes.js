const express = require('express');
const router = express.Router();
const { getAllUsers, createUser, toggleUserStatus, resetUserPassword } = require('../controllers/userController');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

router.use(authenticateToken);
router.use(authorizeRoles('ADMIN'));

router.get('/', getAllUsers);
router.post('/', createUser);
router.put('/:id/toggle', toggleUserStatus);
router.put('/:id/reset-password', resetUserPassword);

module.exports = router;
