const express = require('express');
const router = express.Router();
const {
  login,
  getMe,
  updateProfile
} = require('../controllers/authController');
const { authenticateToken } = require('../middleware/auth');

// Public authentication routes
router.post('/login', login);

// Protected profile routes
router.get('/me', authenticateToken, getMe);
router.put('/profile', authenticateToken, updateProfile);

module.exports = router;
