const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

// Categories
router.get('/categories', productController.getAllCategories);
router.post('/categories', authenticateToken, authorizeRoles('ADMIN', 'MANAGER'), productController.createCategory);
router.delete('/categories/:id', authenticateToken, authorizeRoles('ADMIN'), productController.deleteCategory);

// Brands
router.get('/brands', productController.getAllBrands);
router.post('/brands', authenticateToken, authorizeRoles('ADMIN', 'MANAGER'), productController.createBrand);
router.delete('/brands/:id', authenticateToken, authorizeRoles('ADMIN'), productController.deleteBrand);

// Units
router.get('/units', productController.getAllUnits);
router.post('/units', authenticateToken, authorizeRoles('ADMIN', 'MANAGER'), productController.createUnit);
router.delete('/units/:id', authenticateToken, authorizeRoles('ADMIN'), productController.deleteUnit);

// Stock Movements & Audit
router.get('/movements', authenticateToken, authorizeRoles('ADMIN', 'MANAGER'), productController.getStockMovements);

// Products
router.get('/', productController.getAllProducts);
router.get('/barcode/:barcode', productController.getProductByBarcode);
router.get('/low-stock', productController.getLowStockAlerts);
router.get('/:id', productController.getProductById);

router.post('/', authenticateToken, authorizeRoles('ADMIN', 'MANAGER', 'STOCK_KEEPER'), productController.createProduct);
router.put('/:id', authenticateToken, authorizeRoles('ADMIN', 'MANAGER', 'STOCK_KEEPER'), productController.updateProduct);
router.delete('/:id', authenticateToken, authorizeRoles('ADMIN'), productController.deleteProduct);

// Stock adjustment
router.post('/:id/adjust-stock', authenticateToken, authorizeRoles('ADMIN', 'MANAGER', 'STOCK_KEEPER'), productController.adjustStock);

module.exports = router;

