const prisma = require('../config/prisma');
const { generateProductBarcode } = require('../utils/idGenerator');

// Default retail categories for a Supermarket / Mart
const DEFAULT_CATEGORIES = [
  { name: 'GROCERY & STAPLES', description: 'Flour, rice, pulses, sugar, cooking oil, spices', color: '#10b981' },
  { name: 'BEVERAGES', description: 'Soft drinks, juices, mineral water, tea, coffee', color: '#3b82f6' },
  { name: 'SNACKS & CONFECTIONERY', description: 'Chips, biscuits, chocolates, candies, nuts', color: '#f59e0b' },
  { name: 'DAIRY & EGGS', description: 'Milk, cheese, butter, yogurt, fresh eggs', color: '#06b6d4' },
  { name: 'BAKERY & BREAD', description: 'Fresh bread, buns, cakes, pastries, rusks', color: '#eab308' },
  { name: 'FROZEN FOODS', description: 'Ice cream, frozen meats, nuggets, parathas, vegetables', color: '#6366f1' },
  { name: 'PERSONAL CARE', description: 'Soaps, shampoos, toothpaste, skincare, perfumes', color: '#ec4899' },
  { name: 'HOUSEHOLD & CLEANING', description: 'Detergents, dishwashers, cleaners, insect sprays', color: '#14b8a6' },
  { name: 'BABY CARE', description: 'Diapers, baby wipes, baby milk & foods', color: '#f43f5e' },
  { name: 'FRUITS & VEGETABLES', description: 'Fresh seasonal fruits and green farm vegetables', color: '#84cc16' },
  { name: 'MEAT & POULTRY', description: 'Fresh chicken, beef, mutton, seafood', color: '#ef4444' },
  { name: 'STATIONERY & GENERAL', description: 'Batteries, stationery, light bulbs, disposables', color: '#8b5cf6' }
];

// -------------------------------------------------------------
// CATEGORY CONTROLLERS
// -------------------------------------------------------------

const getAllCategories = async (req, res) => {
  try {
    let categories = await prisma.productCategory.findMany({
      orderBy: { name: 'asc' }
    });

    if (categories.length === 0) {
      for (const cat of DEFAULT_CATEGORIES) {
        await prisma.productCategory.upsert({
          where: { name: cat.name },
          update: {},
          create: cat
        });
      }
      categories = await prisma.productCategory.findMany({
        orderBy: { name: 'asc' }
      });
    }

    const products = await prisma.product.findMany({
      select: { category: true }
    });

    const result = categories.map(cat => {
      const count = products.filter(p => p.category?.toLowerCase() === cat.name.toLowerCase()).length;
      return {
        ...cat,
        product_count: count
      };
    });

    return res.status(200).json({ success: true, categories: result });
  } catch (error) {
    console.error('getAllCategories error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch product categories.' });
  }
};

const createCategory = async (req, res) => {
  try {
    const { name, description, color } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Category name is required.' });
    }

    const category = await prisma.productCategory.create({
      data: {
        name: name.trim().toUpperCase(),
        description: description || null,
        color: color || '#10b981'
      }
    });

    return res.status(201).json({ success: true, category });
  } catch (error) {
    console.error('createCategory error:', error);
    if (error.code === 'P2002') {
      return res.status(409).json({ success: false, message: 'A category with this name already exists.' });
    }
    return res.status(500).json({ success: false, message: 'Failed to create category.' });
  }
};

const deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.productCategory.delete({ where: { id } });
    return res.status(200).json({ success: true, message: 'Category deleted successfully.' });
  } catch (error) {
    console.error('deleteCategory error:', error);
    return res.status(500).json({ success: false, message: 'Failed to delete category.' });
  }
};

// -------------------------------------------------------------
// PRODUCT CONTROLLERS
// -------------------------------------------------------------

const getAllProducts = async (req, res) => {
  try {
    const { search, category, stockStatus, page, limit } = req.query;

    const where = { isActive: true };

    if (search && search.trim()) {
      const q = search.trim();
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { barcode: { contains: q, mode: 'insensitive' } },
        { sku: { contains: q, mode: 'insensitive' } },
        { brand: { contains: q, mode: 'insensitive' } }
      ];
    }

    if (category && category !== 'ALL') {
      where.category = { equals: category, mode: 'insensitive' };
    }

    if (stockStatus === 'LOW') {
      where.stockQuantity = { gt: 0, lte: 10 };
    } else if (stockStatus === 'OUT') {
      where.stockQuantity = { lte: 0 };
    } else if (stockStatus === 'IN') {
      where.stockQuantity = { gt: 10 };
    }

    const products = await prisma.product.findMany({
      where,
      orderBy: { name: 'asc' },
      include: {
        supplier: {
          select: { id: true, companyName: true }
        }
      }
    });

    return res.status(200).json({
      success: true,
      count: products.length,
      products
    });
  } catch (error) {
    console.error('getAllProducts error:', error);
    return res.status(500).json({ success: false, message: 'Failed to retrieve products.' });
  }
};

const getProductById = async (req, res) => {
  try {
    const { id } = req.params;
    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        supplier: true,
        adjustments: { orderBy: { createdAt: 'desc' }, take: 10 }
      }
    });

    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found.' });
    }

    return res.status(200).json({ success: true, product });
  } catch (error) {
    console.error('getProductById error:', error);
    return res.status(500).json({ success: false, message: 'Failed to retrieve product details.' });
  }
};

const getProductByBarcode = async (req, res) => {
  try {
    const { barcode } = req.params;
    if (!barcode) {
      return res.status(400).json({ success: false, message: 'Barcode is required.' });
    }

    const cleanBarcode = barcode.trim();
    const product = await prisma.product.findFirst({
      where: {
        isActive: true,
        OR: [
          { barcode: cleanBarcode },
          { sku: cleanBarcode },
          { packBarcode: cleanBarcode },
          { cartonBarcode: cleanBarcode }
        ]
      }
    });

    if (!product) {
      return res.status(404).json({ success: false, message: `No product found for barcode '${cleanBarcode}'.` });
    }

    let matchedUnit = 'Pcs';
    let matchedPrice = product.retailPrice;
    if (product.cartonBarcode && cleanBarcode === product.cartonBarcode) {
      matchedUnit = 'Carton';
      matchedPrice = product.cartonPrice && product.cartonPrice > 0
        ? product.cartonPrice
        : (product.retailPrice * (product.piecesPerPack || 1) * (product.packsPerCarton || 1));
    } else if (product.packBarcode && cleanBarcode === product.packBarcode) {
      matchedUnit = 'Pack';
      matchedPrice = product.packPrice && product.packPrice > 0
        ? product.packPrice
        : (product.retailPrice * (product.piecesPerPack || 1));
    }

    return res.status(200).json({ success: true, product: { ...product, matchedUnit, matchedPrice } });
  } catch (error) {
    console.error('getProductByBarcode error:', error);
    return res.status(500).json({ success: false, message: 'Failed to scan product.' });
  }
};

const createProduct = async (req, res) => {
  try {
    const {
      name,
      barcode,
      sku,
      description,
      category,
      brand,
      costPrice,
      retailPrice,
      wholesalePrice,
      piecesPerPack,
      packPrice,
      packBarcode,
      packsPerCarton,
      cartonPrice,
      cartonBarcode,
      stockQuantity,
      minStockAlert,
      unit,
      allowFractional,
      expiryDate,
      batchNo,
      supplierId
    } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Product name is required.' });
    }

    // Auto generate barcode if not supplied
    const finalBarcode = barcode && barcode.trim() ? barcode.trim() : generateProductBarcode();
    const finalSku = sku && sku.trim() ? sku.trim() : `SKU-${Date.now().toString().slice(-6)}`;

    // Verify uniqueness
    const existing = await prisma.product.findFirst({
      where: {
        OR: [
          { barcode: finalBarcode },
          { sku: finalSku }
        ]
      }
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        message: `Product with barcode '${finalBarcode}' or SKU '${finalSku}' already exists.`
      });
    }

    const product = await prisma.product.create({
      data: {
        name: name.trim(),
        barcode: finalBarcode,
        sku: finalSku,
        description: description?.trim() || null,
        category: category?.trim() || 'GROCERY & STAPLES',
        brand: brand?.trim() || null,
        costPrice: parseFloat(costPrice) || 0,
        retailPrice: parseFloat(retailPrice) || 0,
        wholesalePrice: wholesalePrice ? parseFloat(wholesalePrice) : null,
        piecesPerPack: piecesPerPack ? (parseFloat(piecesPerPack) || 1) : 1,
        packPrice: packPrice ? (parseFloat(packPrice) || 0) : 0,
        packBarcode: packBarcode ? packBarcode.trim() : null,
        packsPerCarton: packsPerCarton ? (parseFloat(packsPerCarton) || 1) : 1,
        cartonPrice: cartonPrice ? (parseFloat(cartonPrice) || 0) : 0,
        cartonBarcode: cartonBarcode ? cartonBarcode.trim() : null,
        stockQuantity: parseFloat(stockQuantity) || 0,
        minStockAlert: minStockAlert !== undefined ? parseFloat(minStockAlert) : 10,
        unit: unit?.trim() || 'Pcs',
        allowFractional: Boolean(allowFractional),
        expiryDate: expiryDate ? new Date(expiryDate) : null,
        batchNo: batchNo?.trim() || null,
        supplierId: supplierId || null
      }
    });

    return res.status(201).json({
      success: true,
      message: 'Product created successfully.',
      product
    });
  } catch (error) {
    console.error('createProduct error:', error);
    return res.status(500).json({ success: false, message: 'Failed to create product.' });
  }
};

const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      barcode,
      sku,
      description,
      category,
      brand,
      costPrice,
      retailPrice,
      wholesalePrice,
      piecesPerPack,
      packPrice,
      packBarcode,
      packsPerCarton,
      cartonPrice,
      cartonBarcode,
      stockQuantity,
      minStockAlert,
      unit,
      allowFractional,
      expiryDate,
      batchNo,
      supplierId,
      isActive
    } = req.body;

    const existing = await prisma.product.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Product not found.' });
    }

    const updateData = {};
    if (name !== undefined) updateData.name = name.trim();
    if (barcode !== undefined) updateData.barcode = barcode.trim();
    if (sku !== undefined) updateData.sku = sku.trim();
    if (description !== undefined) updateData.description = description ? description.trim() : null;
    if (category !== undefined) updateData.category = category.trim();
    if (brand !== undefined) updateData.brand = brand ? brand.trim() : null;
    if (costPrice !== undefined) updateData.costPrice = parseFloat(costPrice) || 0;
    if (retailPrice !== undefined) updateData.retailPrice = parseFloat(retailPrice) || 0;
    if (wholesalePrice !== undefined) updateData.wholesalePrice = parseFloat(wholesalePrice) || 0;
    if (piecesPerPack !== undefined) updateData.piecesPerPack = piecesPerPack ? (parseFloat(piecesPerPack) || 1) : 1;
    if (packPrice !== undefined) updateData.packPrice = packPrice ? (parseFloat(packPrice) || 0) : 0;
    if (packBarcode !== undefined) updateData.packBarcode = packBarcode ? packBarcode.trim() : null;
    if (packsPerCarton !== undefined) updateData.packsPerCarton = packsPerCarton ? (parseFloat(packsPerCarton) || 1) : 1;
    if (cartonPrice !== undefined) updateData.cartonPrice = cartonPrice ? (parseFloat(cartonPrice) || 0) : 0;
    if (cartonBarcode !== undefined) updateData.cartonBarcode = cartonBarcode ? cartonBarcode.trim() : null;
    if (stockQuantity !== undefined) updateData.stockQuantity = parseFloat(stockQuantity) || 0;
    if (minStockAlert !== undefined) updateData.minStockAlert = parseFloat(minStockAlert) || 0;
    if (unit !== undefined) updateData.unit = unit.trim();
    if (allowFractional !== undefined) updateData.allowFractional = Boolean(allowFractional);
    if (expiryDate !== undefined) updateData.expiryDate = expiryDate ? new Date(expiryDate) : null;
    if (batchNo !== undefined) updateData.batchNo = batchNo ? batchNo.trim() : null;
    if (supplierId !== undefined) updateData.supplierId = supplierId || null;
    if (isActive !== undefined) updateData.isActive = Boolean(isActive);

    const product = await prisma.product.update({
      where: { id },
      data: updateData
    });

    return res.status(200).json({
      success: true,
      message: 'Product updated successfully.',
      product
    });
  } catch (error) {
    console.error('updateProduct error:', error);
    return res.status(500).json({ success: false, message: 'Failed to update product.' });
  }
};

const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;
    // Soft delete product by setting isActive to false
    await prisma.product.update({
      where: { id },
      data: { isActive: false }
    });

    return res.status(200).json({ success: true, message: 'Product removed successfully.' });
  } catch (error) {
    console.error('deleteProduct error:', error);
    return res.status(500).json({ success: false, message: 'Failed to delete product.' });
  }
};

const adjustStock = async (req, res) => {
  try {
    const { id } = req.params;
    const { quantity, type, reason } = req.body;

    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found.' });
    }

    const changeQty = parseFloat(quantity) || 0;
    const previousQty = product.stockQuantity;
    let newQty = previousQty;

    if (type === 'RESTOCK' || type === 'COUNT_CORRECTION_ADD') {
      newQty = previousQty + Math.abs(changeQty);
    } else {
      // DAMAGE, EXPIRED, SHRINKAGE, COUNT_CORRECTION_SUB
      newQty = Math.max(0, previousQty - Math.abs(changeQty));
    }

    const [updatedProduct, adjustment] = await prisma.$transaction([
      prisma.product.update({
        where: { id },
        data: { stockQuantity: newQty }
      }),
      prisma.stockAdjustment.create({
        data: {
          productId: id,
          type: type || 'DAMAGE',
          quantity: Math.abs(changeQty),
          previousQty,
          newQty,
          reason: reason?.trim() || null,
          adjustedBy: req.user?.name || 'Staff'
        }
      })
    ]);

    return res.status(200).json({
      success: true,
      message: 'Stock adjusted successfully.',
      product: updatedProduct,
      adjustment
    });
  } catch (error) {
    console.error('adjustStock error:', error);
    return res.status(500).json({ success: false, message: 'Failed to adjust stock.' });
  }
};

const getLowStockAlerts = async (req, res) => {
  try {
    const products = await prisma.product.findMany({
      where: {
        isActive: true,
        stockQuantity: { lte: 10 }
      },
      orderBy: { stockQuantity: 'asc' },
      take: 50
    });

    return res.status(200).json({ success: true, products });
  } catch (error) {
    console.error('getLowStockAlerts error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch low stock alerts.' });
  }
};

// -------------------------------------------------------------
// BRANDS CONTROLLERS
// -------------------------------------------------------------

const getAllBrands = async (req, res) => {
  try {
    const brands = await prisma.brand.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: { products: true }
        }
      }
    });

    const result = brands.map(b => ({
      ...b,
      productCount: b._count.products
    }));

    return res.status(200).json({ success: true, brands: result });
  } catch (error) {
    console.error('getAllBrands error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch brands.' });
  }
};

const createBrand = async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Brand name is required.' });
    }

    const brand = await prisma.brand.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null
      }
    });

    return res.status(201).json({ success: true, message: 'Brand created successfully.', brand });
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(400).json({ success: false, message: 'A brand with this name already exists.' });
    }
    return res.status(500).json({ success: false, message: 'Failed to create brand.' });
  }
};

const deleteBrand = async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.brand.delete({ where: { id } });
    return res.status(200).json({ success: true, message: 'Brand deleted successfully.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to delete brand.' });
  }
};

// -------------------------------------------------------------
// UNITS CONTROLLERS
// -------------------------------------------------------------

const getAllUnits = async (req, res) => {
  try {
    const units = await prisma.unit.findMany({
      orderBy: { name: 'asc' }
    });
    return res.status(200).json({ success: true, units });
  } catch (error) {
    console.error('getAllUnits error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch units.' });
  }
};

const createUnit = async (req, res) => {
  try {
    const { name, shortCode, allowDecimal } = req.body;
    if (!name || !shortCode) {
      return res.status(400).json({ success: false, message: 'Unit name and short code are required.' });
    }

    const unit = await prisma.unit.create({
      data: {
        name: name.trim(),
        shortCode: shortCode.trim().toLowerCase(),
        allowDecimal: Boolean(allowDecimal)
      }
    });

    return res.status(201).json({ success: true, message: 'Unit created successfully.', unit });
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(400).json({ success: false, message: 'Unit or short code already exists.' });
    }
    return res.status(500).json({ success: false, message: 'Failed to create unit.' });
  }
};

const deleteUnit = async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.unit.delete({ where: { id } });
    return res.status(200).json({ success: true, message: 'Unit deleted successfully.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to delete unit.' });
  }
};

// -------------------------------------------------------------
// STOCK MOVEMENTS & AUDIT
// -------------------------------------------------------------

const getStockMovements = async (req, res) => {
  try {
    const { productId, limit = 100 } = req.query;
    const where = productId ? { productId } : {};

    const adjustments = await prisma.stockAdjustment.findMany({
      where,
      include: {
        product: { select: { name: true, barcode: true, unit: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit, 10)
    });

    return res.status(200).json({ success: true, adjustments });
  } catch (error) {
    console.error('getStockMovements error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch stock adjustments.' });
  }
};

module.exports = {
  getAllCategories,
  createCategory,
  deleteCategory,
  getAllBrands,
  createBrand,
  deleteBrand,
  getAllUnits,
  createUnit,
  deleteUnit,
  getAllProducts,
  getProductById,
  getProductByBarcode,
  createProduct,
  updateProduct,
  deleteProduct,
  adjustStock,
  getLowStockAlerts,
  getStockMovements
};

