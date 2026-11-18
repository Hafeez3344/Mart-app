const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

// Categories
router.get('/categories', productController.getAllCategories);
router.post('/categories', authenticateToken, productController.createCategory);
router.delete('/categories/:id', authenticateToken, productController.deleteCategory);

// Brands
router.get('/brands', productController.getAllBrands);
router.post('/brands', authenticateToken, productController.createBrand);
router.delete('/brands/:id', authenticateToken, productController.deleteBrand);

// Units
router.get('/units', productController.getAllUnits);
router.post('/units', authenticateToken, productController.createUnit);
router.delete('/units/:id', authenticateToken, productController.deleteUnit);

// Stock Movements & Audit
router.get('/movements', authenticateToken, productController.getStockMovements);

// Products
router.get('/', productController.getAllProducts);
router.get('/barcode/:barcode', productController.getProductByBarcode);
router.get('/low-stock', productController.getLowStockAlerts);
router.get('/:id', productController.getProductById);

router.post('/', authenticateToken, productController.createProduct);
router.put('/:id', authenticateToken, productController.updateProduct);
router.delete('/:id', authenticateToken, productController.deleteProduct);

// Stock adjustment
router.post('/:id/adjust-stock', authenticateToken, productController.adjustStock);

module.exports = router;

