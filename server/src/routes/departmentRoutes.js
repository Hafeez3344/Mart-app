const express = require('express');
const router = express.Router();
const {
  getAllDepartments,
  createDepartment,
  updateDepartment,
  deleteDepartment
} = require('../controllers/departmentController');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

router.use(authenticateToken);

router.get('/', getAllDepartments);
router.post('/', authorizeRoles('ADMIN'), createDepartment);
router.put('/:id', authorizeRoles('ADMIN'), updateDepartment);
router.delete('/:id', authorizeRoles('ADMIN'), deleteDepartment);

module.exports = router;
