const prisma = require('../config/prisma');
const { generatePharmacyInvoiceNo, generatePharmacyReturnNo } = require('../utils/idGenerator');
const {
  normalizePackagingConfig,
  getUnitMultiplier,
  getUnitPrice,
  convertToBaseQuantity,
  validateSaleQuantity,
  formatStockBreakdown
} = require('../utils/pharmacyPackaging');

// -------------------------------------------------------------
// 1. MEDICINE CATEGORIES MANAGEMENT
// -------------------------------------------------------------

const DEFAULT_CATEGORIES = [
  { name: 'TABLETS', description: 'Oral Tablets & Caplets' },
  { name: 'CAPSULES', description: 'Oral Encapsulated Formulations' },
  { name: 'SYRUPS', description: 'Liquid Suspensions & Elixirs' },
  { name: 'INJECTIONS', description: 'IV/IM Injections & Ampoules' },
  { name: 'OINTMENTS', description: 'Topical Creams, Gels & Salves' },
  { name: 'DROPS', description: 'Eye, Ear & Nasal Drops' },
  { name: 'INHALERS', description: 'Respiratory Inhalers & Nebules' },
  { name: 'VACCINES', description: 'Biological Vaccines & Serums' },
  { name: 'SURGICAL', description: 'Surgical Disposables, Syringes & Consumables' },
  { name: 'IV FLUIDS', description: 'Intravenous Fluids & Infusion Bags' },
  { name: 'SACHETS', description: 'Electrolytes & Powder Packets' },
  { name: 'GENERAL OTC', description: 'Over-the-Counter Healthcare Supplies' }
];

const getAllCategories = async (req, res) => {
  try {
    let categories = await prisma.pharmacyCategory.findMany({
      orderBy: { name: 'asc' }
    });

    if (categories.length === 0) {
      for (const cat of DEFAULT_CATEGORIES) {
        await prisma.pharmacyCategory.upsert({
          where: { name: cat.name },
          update: {},
          create: cat
        });
      }
      categories = await prisma.pharmacyCategory.findMany({
        orderBy: { name: 'asc' }
      });
    }

    const medicines = await prisma.pharmacyMedicine.findMany({ select: { category: true } });

    const result = categories.map(cat => {
      const count = medicines.filter(m => m.category.toLowerCase() === cat.name.toLowerCase()).length;
      return {
        ...cat,
        medicine_count: count
      };
    });

    return res.status(200).json({ success: true, categories: result });
  } catch (error) {
    console.error('getAllCategories error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch categories.' });
  }
};

const createCategory = async (req, res) => {
  try {
    const { name, description, color } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Category name is required.' });
    }

    const category = await prisma.pharmacyCategory.create({
      data: {
        name: name.trim(),
        description: description || null,
        color: color || '#0d9488'
      }
    });

    return res.status(201).json({ success: true, message: 'Category created successfully.', category });
  } catch (error) {
    console.error('createCategory error:', error);
    return res.status(500).json({ success: false, message: 'Failed to create category.' });
  }
};

const updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, color } = req.body;

    const category = await prisma.pharmacyCategory.update({
      where: { id },
      data: {
        name: name ? name.trim() : undefined,
        description: description !== undefined ? description : undefined,
        color: color || undefined
      }
    });

    return res.status(200).json({ success: true, message: 'Category updated successfully.', category });
  } catch (error) {
    console.error('updateCategory error:', error);
    return res.status(500).json({ success: false, message: 'Failed to update category.' });
  }
};

const deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.pharmacyCategory.delete({ where: { id } });
    return res.status(200).json({ success: true, message: 'Category deleted successfully.' });
  } catch (error) {
    console.error('deleteCategory error:', error);
    return res.status(500).json({ success: false, message: 'Failed to delete category.' });
  }
};

// -------------------------------------------------------------
// PACKAGING UNITS MANAGEMENT (FULL DATABASE CRUD)
// -------------------------------------------------------------

const INITIAL_DEFAULT_UNITS = [
  { name: 'Strip', description: 'Standard tablet/capsule blister strip' },
  { name: 'Box', description: 'Packaging box containing strips, bottles, or ampoules' },
  { name: 'Carton', description: 'Master wholesale shipping carton containing multiple boxes' },
  { name: 'Tablet', description: 'Individual loose tablet piece' },
  { name: 'Capsule', description: 'Individual capsule piece' },
  { name: 'Bottle', description: 'Syrup, suspension, or oral liquid bottle' },
  { name: 'Ampoule', description: 'Injectable glass ampoule' },
  { name: 'Vial', description: 'Liquid/powder injectable vial' },
  { name: 'Sachet', description: 'Powder sachet / packet' },
  { name: 'Tube', description: 'Ointment, cream, or gel tube' },
  { name: 'Syringe', description: 'Disposable syringe unit' },
  { name: 'Drop', description: 'Eye/ear drop bottle' },
  { name: 'Pouch / Bag', description: 'Infusion, saline or IV fluid bag' },
  { name: 'Piece', description: 'Single individual piece or device' },
  { name: 'Inhaler', description: 'Metered dose inhaler unit' },
  { name: 'Kit', description: 'Complete medical/surgical kit' },
  { name: 'Pack', description: 'Multi-item blister pack or bundle' }
];

const getAllPackagingUnits = async (req, res) => {
  try {
    let units = await prisma.pharmacyPackagingUnit.findMany({
      orderBy: { name: 'asc' }
    });

    if (units.length < 5) {
      for (const def of INITIAL_DEFAULT_UNITS) {
        const exists = units.some(u => u.name.toLowerCase() === def.name.toLowerCase());
        if (!exists) {
          try {
            const created = await prisma.pharmacyPackagingUnit.create({
              data: { name: def.name, description: def.description }
            });
            units.push(created);
          } catch (e) {
            // ignore unique race
          }
        }
      }
      units.sort((a, b) => a.name.localeCompare(b.name));
    }

    const medicines = await prisma.pharmacyMedicine.findMany({
      select: { baseUnit: true, defaultSaleUnit: true, packagingConfig: true }
    });

    const unitsWithCount = units.map(u => {
      const uName = u.name.toLowerCase();
      let count = 0;
      medicines.forEach(m => {
        let used = false;
        if (m.baseUnit && m.baseUnit.toLowerCase() === uName) used = true;
        if (m.defaultSaleUnit && m.defaultSaleUnit.toLowerCase() === uName) used = true;
        if (m.packagingConfig && Array.isArray(m.packagingConfig.tiers)) {
          if (m.packagingConfig.tiers.some(t => t && t.unit && t.unit.toLowerCase() === uName)) {
            used = true;
          }
        }
        if (used) count++;
      });
      return {
        ...u,
        medicine_count: count
      };
    });

    return res.status(200).json({ success: true, units: unitsWithCount });
  } catch (error) {
    console.error('getAllPackagingUnits error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch packaging units.' });
  }
};

const createPackagingUnit = async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Packaging unit name is required.' });
    }
    const trimmed = name.trim();

    const existing = await prisma.pharmacyPackagingUnit.findFirst({
      where: { name: { equals: trimmed, mode: 'insensitive' } }
    });
    if (existing) {
      return res.status(400).json({ success: false, message: `Packaging unit "${trimmed}" already exists.` });
    }

    const unit = await prisma.pharmacyPackagingUnit.create({
      data: {
        name: trimmed,
        description: description ? description.trim() : null
      }
    });

    return res.status(201).json({
      success: true,
      message: 'Packaging unit created successfully.',
      unit: { ...unit, medicine_count: 0 }
    });
  } catch (error) {
    console.error('createPackagingUnit error:', error);
    return res.status(500).json({ success: false, message: 'Failed to create packaging unit.' });
  }
};

const updatePackagingUnit = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Packaging unit name is required.' });
    }

    const existing = await prisma.pharmacyPackagingUnit.findFirst({
      where: {
        OR: [
          { id },
          { name: { equals: id, mode: 'insensitive' } }
        ]
      }
    });

    if (!existing) {
      return res.status(404).json({ success: false, message: 'Packaging unit not found.' });
    }

    const unit = await prisma.pharmacyPackagingUnit.update({
      where: { id: existing.id },
      data: {
        name: name.trim(),
        description: description !== undefined ? (description ? description.trim() : null) : undefined
      }
    });

    return res.status(200).json({
      success: true,
      message: 'Packaging unit updated successfully.',
      unit
    });
  } catch (error) {
    console.error('updatePackagingUnit error:', error);
    return res.status(500).json({ success: false, message: 'Failed to update packaging unit.' });
  }
};

const deletePackagingUnit = async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await prisma.pharmacyPackagingUnit.findFirst({
      where: {
        OR: [
          { id },
          { name: { equals: id, mode: 'insensitive' } }
        ]
      }
    });

    if (!existing) {
      return res.status(404).json({ success: false, message: 'Packaging unit not found.' });
    }

    const medicines = await prisma.pharmacyMedicine.findMany({
      select: { baseUnit: true, defaultSaleUnit: true, packagingConfig: true }
    });

    const targetName = existing.name.toLowerCase();
    const usedCount = medicines.filter(m => {
      if (m.baseUnit && m.baseUnit.toLowerCase() === targetName) return true;
      if (m.defaultSaleUnit && m.defaultSaleUnit.toLowerCase() === targetName) return true;
      if (m.packagingConfig && Array.isArray(m.packagingConfig.tiers)) {
        return m.packagingConfig.tiers.some(t => t && t.unit && t.unit.toLowerCase() === targetName);
      }
      return false;
    }).length;

    if (usedCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete "${existing.name}". It is currently assigned to ${usedCount} medicine item(s) in catalog. Please reassign those items first.`
      });
    }

    await prisma.pharmacyPackagingUnit.delete({
      where: { id: existing.id }
    });

    return res.status(200).json({ success: true, message: `Packaging unit "${existing.name}" removed successfully.` });
  } catch (error) {
    console.error('deletePackagingUnit error:', error);
    return res.status(500).json({ success: false, message: 'Failed to delete packaging unit.' });
  }
};


// -------------------------------------------------------------
// 2. MEDICINE INVENTORY CATALOG (WITH BARCODE SUPPORT)
// -------------------------------------------------------------

const getAllMedicines = async (req, res) => {
  try {
    const medicines = await prisma.pharmacyMedicine.findMany({
      orderBy: { name: 'asc' }
    });

    const lowStockCount = medicines.filter(m => m.stockQuantity <= m.minStockAlert).length;

    return res.status(200).json({
      success: true,
      medicines: medicines.map(m => {
        const norm = normalizePackagingConfig(m);
        return {
          ...m,
          quantity: m.stockQuantity,
          purchase_price: m.unitCost,
          sale_price: m.retailPrice,
          batch_number: m.batchNo,
          expiry_date: m.expiryDate,
          baseUnit: norm.baseUnit,
          defaultSaleUnit: norm.defaultSaleUnit,
          allowFractional: norm.allowFractional,
          packagingConfig: norm,
          stockBreakdown: formatStockBreakdown(m.stockQuantity, m)
        };
      }),
      totalCount: medicines.length,
      lowStockCount
    });
  } catch (error) {
    console.error('getAllMedicines error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch medicine inventory.' });
  }
};

const getMedicineByBarcode = async (req, res) => {
  try {
    const raw = req.params.barcode ? decodeURIComponent(req.params.barcode).trim() : '';
    if (!raw) {
      return res.status(400).json({ success: false, message: 'Barcode is required.' });
    }

    const clean = raw.replace(/^\*+|\*+$/g, '').trim();

    // Search by clean code, raw code, with asterisks, or case-insensitive
    const medicine = await prisma.pharmacyMedicine.findFirst({
      where: {
        OR: [
          { barcode: clean },
          { barcode: raw },
          { barcode: `*${clean}*` },
          { barcode: { equals: clean } }
        ]
      }
    });

    if (!medicine) {
      return res.status(404).json({ success: false, message: `No medicine found for barcode: ${raw}` });
    }

    const norm = normalizePackagingConfig(medicine);
    const enriched = {
      ...medicine,
      quantity: medicine.stockQuantity,
      purchase_price: medicine.unitCost,
      sale_price: medicine.retailPrice,
      batch_number: medicine.batchNo,
      expiry_date: medicine.expiryDate,
      baseUnit: norm.baseUnit,
      defaultSaleUnit: norm.defaultSaleUnit,
      allowFractional: norm.allowFractional,
      packagingConfig: norm,
      stockBreakdown: formatStockBreakdown(medicine.stockQuantity, medicine)
    };

    return res.status(200).json({ success: true, medicine: enriched });
  } catch (error) {
    console.error('getMedicineByBarcode error:', error);
    return res.status(500).json({ success: false, message: 'Failed to scan medicine by barcode.' });
  }
};

const createMedicine = async (req, res) => {
  try {
    const {
      barcode,
      name,
      generic_name,
      genericName,
      category,
      unitCost,
      purchase_price,
      retailPrice,
      sale_price,
      stockQuantity,
      quantity,
      minStockAlert,
      batchNo,
      batch_number,
      expiryDate,
      expiry_date,
      manufacturer,
      supplier_id
    } = req.body;

    const brandName = name || req.body.name;
    const formulaName = genericName || generic_name || 'General Formula';

    if (!brandName) {
      return res.status(400).json({ success: false, message: 'Medicine brand name is required.' });
    }

    const qtyVal = parseInt(quantity || stockQuantity, 10) || 0;
    const costVal = parseFloat(purchase_price || unitCost || 0);
    const retailVal = parseFloat(sale_price || retailPrice || 0);

    const medicine = await prisma.$transaction(async (tx) => {
      const baseUnitVal = (req.body.baseUnit || req.body.base_unit || 'Piece').trim();
      const defaultSaleUnitVal = (req.body.defaultSaleUnit || req.body.default_sale_unit || baseUnitVal).trim();
      const allowFractionalVal = Boolean(req.body.allowFractional !== undefined ? req.body.allowFractional : req.body.allow_fractional);
      const packagingConfigVal = req.body.packagingConfig || req.body.packaging_config || null;

      const med = await tx.pharmacyMedicine.create({
        data: {
          barcode: barcode ? barcode.trim() : null,
          name: brandName.trim(),
          genericName: formulaName.trim(),
          category: category || 'TABLETS',
          unitCost: costVal,
          retailPrice: retailVal,
          stockQuantity: qtyVal,
          minStockAlert: parseFloat(minStockAlert) || 20,
          batchNo: batchNo || batch_number || 'BATCH-2026',
          expiryDate: expiry_date || expiryDate ? new Date(expiry_date || expiryDate) : null,
          manufacturer: manufacturer ? manufacturer.trim() : null,
          baseUnit: baseUnitVal,
          defaultSaleUnit: defaultSaleUnitVal,
          allowFractional: allowFractionalVal,
          packagingConfig: packagingConfigVal
        }
      });

      // If linked supplier and initial quantity > 0, auto-create supplier purchase bill!
      if (supplier_id && qtyVal > 0) {
        const totalBill = qtyVal * costVal;
        const invoiceNo = `BILL-MED-${Date.now().toString().slice(-6)}`;
        await tx.pharmacySupplierLedger.create({
          data: {
            supplierId: String(supplier_id),
            invoiceNo,
            totalAmount: totalBill,
            paidAmount: 0,
            balance: totalBill,
            paymentStatus: 'PENDING',
            description: `Auto-created purchase bill for initial stock of ${med.name} (${qtyVal} units)`,
            items: {
              create: [
                {
                  medicineId: med.id,
                  medicineName: med.name,
                  quantity: qtyVal,
                  unitCost: costVal,
                  totalPrice: totalBill
                }
              ]
            }
          }
        });

        // Update supplier balance
        await tx.pharmacySupplier.update({
          where: { id: String(supplier_id) },
          data: { payableBalance: { increment: totalBill } }
        });
      }

      return med;
    });

    return res.status(201).json({
      success: true,
      message: 'Medicine added to inventory successfully.',
      medicine
    });
  } catch (error) {
    console.error('createMedicine error:', error);
    return res.status(500).json({ success: false, message: 'Failed to add medicine to inventory.' });
  }
};

const updateMedicine = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      barcode,
      name,
      genericName,
      generic_name,
      category,
      unitCost,
      purchase_price,
      retailPrice,
      sale_price,
      stockQuantity,
      quantity,
      minStockAlert,
      batchNo,
      batch_number,
      expiryDate,
      expiry_date,
      manufacturer,
      supplier_id
    } = req.body;

    const existing = await prisma.pharmacyMedicine.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Medicine item not found.' });
    }

    const updateData = {};
    if (barcode !== undefined) updateData.barcode = barcode ? barcode.trim() : null;
    if (name !== undefined) updateData.name = name.trim();
    if (genericName !== undefined || generic_name !== undefined) {
      updateData.genericName = (genericName !== undefined ? genericName : generic_name || '').trim();
    }
    if (category !== undefined) {
      updateData.category = (category || 'TABLETS').trim();
    }
    if (unitCost !== undefined || purchase_price !== undefined) {
      updateData.unitCost = parseFloat(unitCost !== undefined ? unitCost : purchase_price) || 0;
    }
    if (retailPrice !== undefined || sale_price !== undefined) {
      updateData.retailPrice = parseFloat(retailPrice !== undefined ? retailPrice : sale_price) || 0;
    }
    if (stockQuantity !== undefined || quantity !== undefined) {
      updateData.stockQuantity = parseFloat(stockQuantity !== undefined ? stockQuantity : quantity) || 0;
    }
    if (minStockAlert !== undefined) {
      updateData.minStockAlert = parseFloat(minStockAlert) || 20;
    }
    if (batchNo !== undefined || batch_number !== undefined) {
      updateData.batchNo = (batchNo !== undefined ? batchNo : batch_number || '').trim();
    }
    if (expiryDate !== undefined || expiry_date !== undefined) {
      const exp = expiryDate !== undefined ? expiryDate : expiry_date;
      updateData.expiryDate = exp ? new Date(exp) : null;
    }
    if (manufacturer !== undefined) {
      updateData.manufacturer = manufacturer ? manufacturer.trim() : null;
    }
    if (req.body.baseUnit !== undefined || req.body.base_unit !== undefined) {
      updateData.baseUnit = (req.body.baseUnit || req.body.base_unit || existing.baseUnit || 'Piece').trim();
    }
    if (req.body.defaultSaleUnit !== undefined || req.body.default_sale_unit !== undefined) {
      updateData.defaultSaleUnit = (req.body.defaultSaleUnit || req.body.default_sale_unit || updateData.baseUnit || existing.defaultSaleUnit || 'Piece').trim();
    }
    if (req.body.allowFractional !== undefined || req.body.allow_fractional !== undefined) {
      updateData.allowFractional = Boolean(req.body.allowFractional !== undefined ? req.body.allowFractional : req.body.allow_fractional);
    }
    if (req.body.packagingConfig !== undefined || req.body.packaging_config !== undefined) {
      updateData.packagingConfig = req.body.packagingConfig !== undefined ? req.body.packagingConfig : req.body.packaging_config;
    }

    const activeSupplierId = supplier_id || req.body.supplierId || req.body.supplier_id;
    const newQty = updateData.stockQuantity !== undefined ? updateData.stockQuantity : existing.stockQuantity;
    const qtyDiff = newQty - existing.stockQuantity;

    const medicine = await prisma.$transaction(async (tx) => {
      const updated = await tx.pharmacyMedicine.update({
        where: { id },
        data: updateData
      });

      // If supplier provided and quantity increased, auto-create purchase bill for difference!
      if (activeSupplierId && qtyDiff > 0) {
        const costVal = updated.unitCost;
        const totalBill = qtyDiff * costVal;
        const invoiceNo = `BILL-RESTOCK-${Date.now().toString().slice(-6)}`;
        await tx.pharmacySupplierLedger.create({
          data: {
            supplierId: String(activeSupplierId),
            invoiceNo,
            totalAmount: totalBill,
            paidAmount: 0,
            balance: totalBill,
            paymentStatus: 'PENDING',
            description: `Auto-restock bill for ${updated.name} (+${qtyDiff} units)`,
            items: {
              create: [
                {
                  medicineId: updated.id,
                  medicineName: updated.name,
                  quantity: qtyDiff,
                  unitCost: costVal,
                  totalPrice: totalBill
                }
              ]
            }
          }
        });

        await tx.pharmacySupplier.update({
          where: { id: String(activeSupplierId) },
          data: { payableBalance: { increment: totalBill } }
        });
      }

      return updated;
    });

    return res.status(200).json({
      success: true,
      message: 'Medicine details updated successfully.',
      medicine
    });
  } catch (error) {
    console.error('updateMedicine error:', error);
    return res.status(500).json({ success: false, message: 'Failed to update medicine details.' });
  }
};

const deleteMedicine = async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.pharmacyMedicine.delete({ where: { id } });

    return res.status(200).json({
      success: true,
      message: 'Medicine removed from inventory.'
    });
  } catch (error) {
    console.error('deleteMedicine error:', error);
    return res.status(500).json({ success: false, message: 'Failed to delete medicine item.' });
  }
};

// -------------------------------------------------------------
// 3. SUPPLIERS & ITEMIZED PURCHASE BILLS & PAYMENTS
// -------------------------------------------------------------

const getAllSuppliers = async (req, res) => {
  try {
    const suppliers = await prisma.pharmacySupplier.findMany({
      include: {
        ledgers: {
          include: { items: true },
          orderBy: { createdAt: 'desc' }
        },
        payments: {
          orderBy: { createdAt: 'desc' }
        }
      },
      orderBy: { companyName: 'asc' }
    });

    return res.status(200).json({
      success: true,
      suppliers: suppliers.map(s => ({
        ...s,
        name: s.companyName,
        contact_person: s.contactPerson,
        payable_balance: s.payableBalance
      }))
    });
  } catch (error) {
    console.error('getAllSuppliers error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch suppliers directory.' });
  }
};

const createSupplier = async (req, res) => {
  try {
    const { companyName, name, contactPerson, phone, email, address, payableBalance } = req.body;
    const compName = companyName || name;
    if (!compName) {
      return res.status(400).json({ success: false, message: 'Supplier company name is required.' });
    }

    const supplier = await prisma.pharmacySupplier.create({
      data: {
        companyName: compName.trim(),
        contactPerson: contactPerson || '',
        phone: phone || '',
        email: email || '',
        address: address || '',
        payableBalance: parseFloat(payableBalance) || 0
      }
    });

    return res.status(201).json({
      success: true,
      message: 'Supplier registered successfully.',
      supplier
    });
  } catch (error) {
    console.error('createSupplier error:', error);
    return res.status(500).json({ success: false, message: 'Failed to register supplier.' });
  }
};

const softDeleteSupplier = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ success: false, message: 'Supplier ID is required.' });
    }

    const supplier = await prisma.pharmacySupplier.findUnique({
      where: { id }
    });

    if (!supplier) {
      return res.status(404).json({ success: false, message: 'Supplier company record not found.' });
    }

    if (supplier.payableBalance > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete supplier with outstanding dues of PKR ${supplier.payableBalance.toLocaleString()}. Please settle all balances before deleting.`
      });
    }

    const timeTag = Date.now();
    const updated = await prisma.pharmacySupplier.update({
      where: { id },
      data: {
        companyName: `${supplier.companyName}_DELETED_${timeTag}`,
        phone: supplier.phone ? `${supplier.phone}_DEL_${timeTag}` : null
      }
    });

    return res.status(200).json({
      success: true,
      message: 'Supplier soft deleted successfully. Historical ledgers & payments preserved.',
      supplier: updated
    });
  } catch (error) {
    console.error('softDeleteSupplier error:', error);
    return res.status(500).json({ success: false, message: 'Failed to soft delete supplier.' });
  }
};

const createSupplierPurchase = async (req, res) => {
  try {
    const { supplierId, invoiceNo, paidAmount, description, items, totalAmount } = req.body;

    if (!supplierId || !invoiceNo) {
      return res.status(400).json({ success: false, message: 'Supplier ID and invoice bill number are required.' });
    }

    let calculatedTotal = 0;
    const rawItems = (items && Array.isArray(items)) ? items : [];

    const result = await prisma.$transaction(async (tx) => {
      const validatedItems = [];
      for (const item of rawItems) {
        const qty = parseFloat(item.quantity) || 1;
        const cost = parseFloat(item.unitCost || item.purchase_price) || 0;
        const lineTotal = Number((qty * cost).toFixed(2));
        calculatedTotal += lineTotal;

        let med = null;
        if (item.medicineId) {
          med = await tx.pharmacyMedicine.findUnique({ where: { id: item.medicineId } });
        }

        const purchaseUnit = item.purchaseUnit || item.purchase_unit || (med ? (med.packagingConfig?.tiers?.[0]?.unit || med.baseUnit) : 'Unit');
        const mult = med ? getUnitMultiplier(med, purchaseUnit) : 1.0;
        const baseQty = Number((qty * mult).toFixed(4));

        validatedItems.push({
          medicineId: item.medicineId || null,
          medicineName: item.medicineName || (med ? med.name : 'Purchased Item'),
          quantity: qty,
          unitCost: cost,
          retailPrice: parseFloat(item.retailPrice || item.retail_price) || 0,
          totalPrice: lineTotal,
          purchaseUnit: purchaseUnit,
          conversionFactor: mult,
          baseQuantity: baseQty,
          medRef: med
        });
      }

      const finalTotal = validatedItems.length > 0 ? calculatedTotal : parseFloat(totalAmount || 0);
      const paid = parseFloat(paidAmount || 0);
      const bal = Math.max(0, finalTotal - paid);
      const status = bal === 0 ? 'PAID' : paid > 0 ? 'PARTIAL' : 'PENDING';

      const ledger = await tx.pharmacySupplierLedger.create({
        data: {
          supplierId,
          invoiceNo: invoiceNo.trim(),
          totalAmount: finalTotal,
          paidAmount: paid,
          balance: bal,
          paymentStatus: status,
          description: description || 'Itemized Medicine Purchase Bill',
          items: {
            create: validatedItems.map(i => ({
              medicineId: i.medicineId,
              medicineName: i.medicineName,
              quantity: i.quantity,
              unitCost: i.unitCost,
              totalPrice: i.totalPrice,
              purchaseUnit: i.purchaseUnit,
              conversionFactor: i.conversionFactor,
              baseQuantity: i.baseQuantity
            }))
          }
        },
        include: { items: true }
      });

      for (const item of validatedItems) {
        if (item.medicineId && item.medRef) {
          const med = item.medRef;
          const mult = item.conversionFactor > 0 ? item.conversionFactor : 1;
          const baseUnitCost = mult > 1 ? Number((item.unitCost / mult).toFixed(2)) : item.unitCost;
          const baseRetailPrice = (item.retailPrice > 0 && mult > 1) ? Number((item.retailPrice / mult).toFixed(2)) : item.retailPrice;

          const updateData = {
            stockQuantity: med.stockQuantity + item.baseQuantity
          };

          if (baseUnitCost > 0) {
            updateData.unitCost = baseUnitCost;
          }
          if (baseRetailPrice > 0) {
            updateData.retailPrice = baseRetailPrice;
          }

          // If item purchased in a specific tier, update that tier's selling/purchase price in packagingConfig
          if (mult > 1 && med.packagingConfig && item.purchaseUnit) {
            const norm = normalizePackagingConfig(med);
            const tierIdx = norm.tiers.findIndex(t => t.unit.toLowerCase() === item.purchaseUnit.toLowerCase());
            if (tierIdx !== -1) {
              norm.tiers[tierIdx].purchasePrice = item.unitCost;
              if (item.retailPrice > 0) {
                norm.tiers[tierIdx].sellingPrice = item.retailPrice;
              }
              updateData.packagingConfig = norm;
            }
          }

          await tx.pharmacyMedicine.update({
            where: { id: item.medicineId },
            data: updateData
          });
        }
      }

      await tx.pharmacySupplier.update({
        where: { id: supplierId },
        data: {
          payableBalance: { increment: bal }
        }
      });

      return ledger;
    });

    return res.status(201).json({
      success: true,
      message: 'Itemized purchase bill saved successfully. Inventory stock updated!',
      ledger: result
    });
  } catch (error) {
    console.error('createSupplierPurchase error:', error);
    return res.status(500).json({ success: false, message: 'Failed to record supplier purchase invoice.' });
  }
};

const recordSupplierPayment = async (req, res) => {
  try {
    const { supplierId, ledgerId, amount, paymentMethod, referenceNo, notes } = req.body;
    if (!supplierId || !amount || parseFloat(amount) <= 0) {
      return res.status(400).json({ success: false, message: 'Supplier ID and a positive payment amount are required.' });
    }

    const payVal = parseFloat(amount);

    const result = await prisma.$transaction(async (tx) => {
      // Transactional advisory lock to prevent concurrent over-allocation on this supplier
      await tx.$executeRawUnsafe('SELECT pg_advisory_xact_lock(hashtext($1))', 'pharm_supp_' + supplierId);

      const payment = await tx.pharmacySupplierPayment.create({
        data: {
          supplierId,
          amount: payVal,
          paymentMethod: paymentMethod || 'CASH',
          referenceNo: referenceNo || null,
          notes: notes || 'Vendor Payment (FIFO Allocated)'
        }
      });

      // If specific bill / ledger ID provided, allocate payment directly to that bill first
      if (ledgerId) {
        const targetLedger = await tx.pharmacySupplierLedger.findUnique({ where: { id: ledgerId } });
        if (targetLedger) {
          const alloc = Math.min(payVal, targetLedger.balance);
          const newPaid = targetLedger.paidAmount + alloc;
          const newBal = Math.max(0, targetLedger.totalAmount - newPaid);
          const newStatus = newBal === 0 ? 'PAID' : newPaid > 0 ? 'PARTIAL' : 'PENDING';

          await tx.pharmacySupplierLedger.update({
            where: { id: ledgerId },
            data: {
              paidAmount: newPaid,
              balance: newBal,
              paymentStatus: newStatus
            }
          });
        }
      } else {
        // FIFO Payment Allocation (First-In, First-Out): Allocate payment to oldest unpaid bills first
        const openLedgers = await tx.pharmacySupplierLedger.findMany({
          where: {
            supplierId,
            paymentStatus: { in: ['PENDING', 'PARTIAL'] }
          },
          orderBy: { createdAt: 'asc' }
        });

        let remainingPay = payVal;
        for (const ledger of openLedgers) {
          if (remainingPay <= 0) break;
          const alloc = Math.min(remainingPay, ledger.balance);
          const newPaid = ledger.paidAmount + alloc;
          const newBal = Math.max(0, ledger.totalAmount - newPaid);
          const newStatus = newBal === 0 ? 'PAID' : newPaid > 0 ? 'PARTIAL' : 'PENDING';

          await tx.pharmacySupplierLedger.update({
            where: { id: ledger.id },
            data: {
              paidAmount: newPaid,
              balance: newBal,
              paymentStatus: newStatus
            }
          });

          remainingPay -= alloc;
        }
      }

      // Concurrency-safe atomic decrement of supplier payable balance
      await tx.pharmacySupplier.update({
        where: { id: supplierId },
        data: {
          payableBalance: { decrement: payVal }
        }
      });

      return payment;
    });

    return res.status(201).json({
      success: true,
      message: 'Supplier payment transaction recorded & allocated (FIFO).',
      payment: result
    });
  } catch (error) {
    console.error('recordSupplierPayment error:', error);
    return res.status(500).json({ success: false, message: 'Failed to record supplier payment.' });
  }
};

const updateSupplierPayment = async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, paymentMethod, referenceNo, notes } = req.body;

    if (!id) {
      return res.status(400).json({ success: false, message: 'Payment ID is required.' });
    }

    const existingPayment = await prisma.pharmacySupplierPayment.findUnique({
      where: { id }
    });

    if (!existingPayment) {
      return res.status(404).json({ success: false, message: 'Payment record not found.' });
    }

    const newAmount = parseFloat(amount) || existingPayment.amount;
    const amountDiff = newAmount - existingPayment.amount;

    const result = await prisma.$transaction(async (tx) => {
      const updatedPayment = await tx.pharmacySupplierPayment.update({
        where: { id },
        data: {
          amount: newAmount,
          paymentMethod: paymentMethod || existingPayment.paymentMethod,
          referenceNo: referenceNo !== undefined ? referenceNo : existingPayment.referenceNo,
          notes: notes !== undefined ? notes : existingPayment.notes
        }
      });

      if (amountDiff !== 0) {
        const sup = await tx.pharmacySupplier.findUnique({ where: { id: existingPayment.supplierId } });
        if (sup) {
          const newBal = Math.max(0, sup.payableBalance - amountDiff);
          await tx.pharmacySupplier.update({
            where: { id: existingPayment.supplierId },
            data: { payableBalance: newBal }
          });
        }
      }

      return updatedPayment;
    });

    return res.status(200).json({
      success: true,
      message: 'Vendor payment details updated successfully.',
      payment: result
    });
  } catch (error) {
    console.error('updateSupplierPayment error:', error);
    return res.status(500).json({ success: false, message: 'Failed to update vendor payment.' });
  }
};

const deleteSupplierPurchase = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ success: false, message: 'Purchase bill ID is required.' });
    }

    const existingBill = await prisma.pharmacySupplierLedger.findUnique({
      where: { id },
      include: { items: true }
    });

    if (!existingBill) {
      return res.status(404).json({ success: false, message: 'Purchase bill record not found.' });
    }

    await prisma.$transaction(async (tx) => {
      for (const item of existingBill.items) {
        if (item.medicineId) {
          const med = await tx.pharmacyMedicine.findUnique({ where: { id: item.medicineId } });
            const baseQtyToDeduct = (item.baseQuantity !== null && item.baseQuantity !== undefined && item.baseQuantity > 0)
              ? item.baseQuantity
              : (item.conversionFactor ? item.quantity * item.conversionFactor : (item.quantity * getUnitMultiplier(med, item.purchaseUnit)));
            const newQty = Math.max(0, med.stockQuantity - baseQtyToDeduct);
            await tx.pharmacyMedicine.update({
              where: { id: item.medicineId },
              data: { stockQuantity: newQty }
            });
        }
      }

      await tx.pharmacySupplierLedgerItem.deleteMany({
        where: { ledgerId: id }
      });

      await tx.pharmacySupplierLedger.delete({
        where: { id }
      });

      const sup = await tx.pharmacySupplier.findUnique({ where: { id: existingBill.supplierId } });
      if (sup) {
        const newBal = Math.max(0, sup.payableBalance - existingBill.balance);
        await tx.pharmacySupplier.update({
          where: { id: existingBill.supplierId },
          data: { payableBalance: newBal }
        });
      }
    });

    return res.status(200).json({
      success: true,
      message: 'Purchase bill deleted successfully. Inventory stock & balance reverted.'
    });
  } catch (error) {
    console.error('deleteSupplierPurchase error:', error);
    return res.status(500).json({ success: false, message: 'Failed to delete purchase bill.' });
  }
};

const deleteSupplierPayment = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ success: false, message: 'Payment ID is required.' });
    }

    const existingPayment = await prisma.pharmacySupplierPayment.findUnique({
      where: { id }
    });

    if (!existingPayment) {
      return res.status(404).json({ success: false, message: 'Payment record not found.' });
    }

    await prisma.$transaction(async (tx) => {
      await tx.pharmacySupplierPayment.delete({
        where: { id }
      });

      const sup = await tx.pharmacySupplier.findUnique({ where: { id: existingPayment.supplierId } });
      if (sup) {
        await tx.pharmacySupplier.update({
          where: { id: existingPayment.supplierId },
          data: { payableBalance: { increment: existingPayment.amount } }
        });
      }
    });

    return res.status(200).json({
      success: true,
      message: 'Vendor payment record deleted successfully. Balance updated.'
    });
  } catch (error) {
    console.error('deleteSupplierPayment error:', error);
    return res.status(500).json({ success: false, message: 'Failed to delete vendor payment.' });
  }
};

const updateSupplierPurchase = async (req, res) => {
  try {
    const { id } = req.params;
    const { invoiceNo, description, items } = req.body;

    if (!id) {
      return res.status(400).json({ success: false, message: 'Purchase bill ID is required.' });
    }

    const existingBill = await prisma.pharmacySupplierLedger.findUnique({
      where: { id },
      include: { items: true }
    });

    if (!existingBill) {
      return res.status(404).json({ success: false, message: 'Purchase bill not found.' });
    }

    let calculatedTotal = 0;
    const rawItems = (items && Array.isArray(items)) ? items : [];

    const result = await prisma.$transaction(async (tx) => {
      // 1. Revert old bill items from inventory
      for (const oldItem of existingBill.items) {
        if (oldItem.medicineId) {
          const med = await tx.pharmacyMedicine.findUnique({ where: { id: oldItem.medicineId } });
          if (med) {
            const oldBaseQty = (oldItem.baseQuantity !== null && oldItem.baseQuantity !== undefined && oldItem.baseQuantity > 0)
              ? oldItem.baseQuantity
              : (oldItem.conversionFactor ? oldItem.quantity * oldItem.conversionFactor : (oldItem.quantity * getUnitMultiplier(med, oldItem.purchaseUnit)));
            await tx.pharmacyMedicine.update({
              where: { id: oldItem.medicineId },
              data: { stockQuantity: Math.max(0, med.stockQuantity - oldBaseQty) }
            });
          }
        }
      }

      // 2. Validate and convert new items
      const validatedItems = [];
      for (const item of rawItems) {
        const qty = parseFloat(item.quantity) || 1;
        const cost = parseFloat(item.unitCost || item.purchase_price) || 0;
        const lineTotal = Number((qty * cost).toFixed(2));
        calculatedTotal += lineTotal;

        let med = null;
        const medId = item.medicineId || item.medicine_id || null;
        if (medId) {
          med = await tx.pharmacyMedicine.findUnique({ where: { id: medId } });
        }

        const purchaseUnit = item.purchaseUnit || item.purchase_unit || (med ? (med.packagingConfig?.tiers?.[0]?.unit || med.baseUnit) : 'Unit');
        const mult = med ? getUnitMultiplier(med, purchaseUnit) : 1.0;
        const baseQty = Number((qty * mult).toFixed(4));

        validatedItems.push({
          medicineId: medId,
          medicineName: item.medicineName || (med ? med.name : 'Purchased Item'),
          quantity: qty,
          unitCost: cost,
          retailPrice: parseFloat(item.retailPrice || item.retail_price) || 0,
          totalPrice: lineTotal,
          purchaseUnit: purchaseUnit,
          conversionFactor: mult,
          baseQuantity: baseQty,
          medRef: med
        });
      }

      const finalTotal = validatedItems.length > 0 ? calculatedTotal : existingBill.totalAmount;
      const paid = existingBill.paidAmount;
      const newBal = Math.max(0, finalTotal - paid);
      const newStatus = newBal === 0 ? 'PAID' : paid > 0 ? 'PARTIAL' : 'PENDING';
      const balDiff = newBal - existingBill.balance;

      await tx.pharmacySupplierLedgerItem.deleteMany({
        where: { ledgerId: id }
      });

      const updated = await tx.pharmacySupplierLedger.update({
        where: { id },
        data: {
          invoiceNo: invoiceNo ? invoiceNo.trim() : existingBill.invoiceNo,
          totalAmount: finalTotal,
          balance: newBal,
          paymentStatus: newStatus,
          description: description || existingBill.description,
          items: {
            create: validatedItems.map(i => ({
              medicineId: i.medicineId,
              medicineName: i.medicineName,
              quantity: i.quantity,
              unitCost: i.unitCost,
              totalPrice: i.totalPrice,
              purchaseUnit: i.purchaseUnit,
              conversionFactor: i.conversionFactor,
              baseQuantity: i.baseQuantity
            }))
          }
        },
        include: { items: true }
      });

      // 3. Add new base quantities and update pricing
      for (const item of validatedItems) {
        if (item.medicineId && item.medRef) {
          const med = await tx.pharmacyMedicine.findUnique({ where: { id: item.medicineId } });
          if (med) {
            const mult = item.conversionFactor > 0 ? item.conversionFactor : 1;
            const baseUnitCost = mult > 1 ? Number((item.unitCost / mult).toFixed(2)) : item.unitCost;
            const baseRetailPrice = (item.retailPrice > 0 && mult > 1) ? Number((item.retailPrice / mult).toFixed(2)) : item.retailPrice;

            const updateData = {
              stockQuantity: med.stockQuantity + item.baseQuantity
            };
            if (baseUnitCost > 0) {
              updateData.unitCost = baseUnitCost;
            }
            if (baseRetailPrice > 0) {
              updateData.retailPrice = baseRetailPrice;
            }

            if (mult > 1 && med.packagingConfig && item.purchaseUnit) {
              const norm = normalizePackagingConfig(med);
              const tierIdx = norm.tiers.findIndex(t => t.unit.toLowerCase() === item.purchaseUnit.toLowerCase());
              if (tierIdx !== -1) {
                norm.tiers[tierIdx].purchasePrice = item.unitCost;
                if (item.retailPrice > 0) {
                  norm.tiers[tierIdx].sellingPrice = item.retailPrice;
                }
                updateData.packagingConfig = norm;
              }
            }

            await tx.pharmacyMedicine.update({
              where: { id: item.medicineId },
              data: updateData
            });
          }
        }
      }

      if (balDiff !== 0) {
        await tx.pharmacySupplier.update({
          where: { id: existingBill.supplierId },
          data: {
            payableBalance: { increment: balDiff }
          }
        });
      }

      return updated;
    });

    return res.status(200).json({
      success: true,
      message: 'Purchase bill details & prices updated successfully!',
      ledger: result
    });
  } catch (error) {
    console.error('updateSupplierPurchase error:', error);
    return res.status(500).json({ success: false, message: 'Failed to update purchase bill.' });
  }
};

// -------------------------------------------------------------
// 4. POS SALES & DUES MANAGEMENT
// -------------------------------------------------------------

const createPharmacySale = async (req, res) => {
  try {
    const {
      saleType,
      patientId,
      customerName,
      customerPhone,
      discount,
      paidAmount,
      paymentMethod,
      notes,
      items
    } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Pharmacy sale must contain at least one medicine item.' });
    }

    const year = new Date().getFullYear();
    const invoiceNo = generatePharmacyInvoiceNo(year);

    // Validate patientId if provided
    let validPatientId = null;
    if (patientId) {
      const existingPat = await prisma.patient.findUnique({ where: { id: String(patientId) } });
      if (existingPat) {
        validPatientId = existingPat.id;
      }
    }

    let subtotal = 0;
    const validatedItems = [];
    for (const item of items) {
      const qty = parseFloat(item.quantity) || 1;
      const price = parseFloat(item.unitPrice || item.price) || 0;
      const total = Number((qty * price).toFixed(2));
      subtotal += total;

      let med = null;
      let medId = item.medicineId || item.medicine_id || null;
      if (medId) {
        med = await prisma.pharmacyMedicine.findUnique({ where: { id: String(medId) } });
        if (!med) medId = null;
      }

      const soldUnit = item.soldUnit || item.sold_unit || (med ? (med.defaultSaleUnit || med.baseUnit) : 'Unit');
      const mult = med ? getUnitMultiplier(med, soldUnit) : 1.0;
      const baseQty = Number((qty * mult).toFixed(4));

      validatedItems.push({
        medicineId: medId,
        medicineName: item.medicineName || item.name || (med ? med.name : 'Medicine Item'),
        quantity: qty,
        unitPrice: price,
        totalPrice: total,
        soldUnit: soldUnit,
        conversionFactor: mult,
        baseQuantity: baseQty,
        medRef: med
      });
    }

    const disc = parseFloat(discount || 0);
    const netTotal = Math.max(0, subtotal - disc);
    const paid = paidAmount !== undefined ? parseFloat(paidAmount) : netTotal;
    const status = paid >= netTotal ? 'PAID' : paid > 0 ? 'PARTIAL' : 'PENDING';
    const counter = req.body.paidAtCounter ? req.body.paidAtCounter : (paid > 0 ? 'PHARMACY' : null);

    let targetVisitId = req.body.visitId || req.body.targetVisitId || null;
    if (!targetVisitId && validPatientId) {
      const activeVisit = await prisma.patientVisit.findFirst({
        where: { patientId: validPatientId, status: 'ACTIVE' },
        orderBy: { checkInDate: 'desc' }
      });
      if (activeVisit) {
        targetVisitId = activeVisit.id;
      }
    }

    const saleResult = await prisma.$transaction(async (tx) => {
      const sale = await tx.pharmacySale.create({
        data: {
          invoiceNo,
          saleType: saleType || 'EXTERNAL_OTC',
          patientId: validPatientId,
          visitId: targetVisitId,
          customerName: customerName || 'Walk-In Customer',
          customerPhone: customerPhone || null,
          subtotal,
          discount: disc,
          netTotal,
          paidAmount: paid,
          status,
          paymentMethod: paymentMethod || 'CASH',
          paidAtCounter: counter,
          notes: notes || (paid === 0 ? 'Pay at Frontdesk Counter' : null),
          createdBy: req.user?.name || 'Pharmacy Counter',
          items: {
            create: validatedItems.map(i => ({
              medicineId: i.medicineId,
              medicineName: i.medicineName,
              quantity: i.quantity,
              unitPrice: i.unitPrice,
              totalPrice: i.totalPrice,
              soldUnit: i.soldUnit,
              conversionFactor: i.conversionFactor,
              baseQuantity: i.baseQuantity
            }))
          }
        },
        include: {
          items: true,
          patient: true
        }
      });

      // Record initial payment record if paid > 0
      if (paid > 0) {
        await tx.pharmacyCustomerPayment.create({
          data: {
            saleId: sale.id,
            amount: paid,
            paymentMethod: paymentMethod || 'CASH',
            referenceNo: 'POS Checkout Initial Payment',
            collectedAtCounter: counter || 'PHARMACY'
          }
        });
      }

      // Sort medicine items to avoid deadlocks across concurrent checkouts
      const itemsToDeduct = validatedItems.filter(i => i.medicineId);
      itemsToDeduct.sort((a, b) => String(a.medicineId).localeCompare(String(b.medicineId)));

      for (const item of itemsToDeduct) {
        // Concurrency-safe atomic check-and-decrement:
        // Updates stock ONLY IF current stock >= requested baseQuantity
        const updateRes = await tx.pharmacyMedicine.updateMany({
          where: {
            id: item.medicineId,
            stockQuantity: { gte: item.baseQuantity }
          },
          data: {
            stockQuantity: { decrement: item.baseQuantity }
          }
        });

        if (updateRes.count === 0) {
          const curMed = await tx.pharmacyMedicine.findUnique({ where: { id: item.medicineId } });
          const availableStock = curMed ? curMed.stockQuantity : 0;
          const baseUnit = curMed ? (curMed.baseUnit || 'units') : 'units';
          throw new Error(`Insufficient stock for "${item.medicineName}". Requested: ${item.quantity} ${item.soldUnit} (${item.baseQuantity} ${baseUnit}), Available: ${availableStock} ${baseUnit}.`);
        }
      }

      return sale;
    });

    return res.status(201).json({
      success: true,
      message: 'Pharmacy sale completed & stock deducted successfully.',
      sale: saleResult
    });
  } catch (error) {
    console.error('createPharmacySale error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to process pharmacy sale.'
    });
  }
};

const updatePharmacySale = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      saleType,
      patientId,
      customerName,
      customerPhone,
      discount,
      paidAmount,
      paymentMethod,
      notes,
      items
    } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Pharmacy sale must contain at least one medicine item.' });
    }

    const existingSale = await prisma.pharmacySale.findUnique({
      where: { id },
      include: { items: true, duePayments: true }
    });

    if (!existingSale) {
      return res.status(404).json({ success: false, message: 'Pharmacy sale invoice record not found.' });
    }

    const saleDate = new Date(existingSale.createdAt);
    const today = new Date();
    const isToday = (
      saleDate.getFullYear() === today.getFullYear() &&
      saleDate.getMonth() === today.getMonth() &&
      saleDate.getDate() === today.getDate()
    );

    if (!isToday) {
      return res.status(400).json({
        success: false,
        message: 'Invoices from previous dates are locked for direct editing to protect closed cash drawer registers and audit history. Please use the Sales Return & Refund feature instead.'
      });
    }

    let validPatientId = null;
    if (patientId) {
      const existingPat = await prisma.patient.findUnique({ where: { id: String(patientId) } });
      if (existingPat) validPatientId = existingPat.id;
    }

    let subtotal = 0;
    const validatedItems = [];
    for (const item of items) {
      const qty = parseFloat(item.quantity) || 1;
      const price = parseFloat(item.unitPrice || item.price) || 0;
      const total = Number((qty * price).toFixed(2));
      subtotal += total;

      let med = null;
      let medId = item.medicineId || item.medicine_id || null;
      if (medId) {
        med = await prisma.pharmacyMedicine.findUnique({ where: { id: String(medId) } });
        if (!med) medId = null;
      }

      const soldUnit = item.soldUnit || item.sold_unit || item.unit || (med ? med.baseUnit : 'Unit');
      const mult = med ? getUnitMultiplier(med, soldUnit) : 1.0;
      const baseQty = Number((qty * mult).toFixed(4));

      validatedItems.push({
        medicineId: medId,
        medicineName: item.medicineName || item.name || (med ? med.name : 'Medicine Item'),
        quantity: qty,
        unitPrice: price,
        totalPrice: total,
        soldUnit: soldUnit,
        conversionFactor: mult,
        baseQuantity: baseQty
      });
    }

    const disc = parseFloat(discount || 0);
    const netTotal = Math.max(0, subtotal - disc);

    // Isolate any subsequent dues recovery payments made on this bill
    const duesRecoveries = (existingSale.duePayments || []).filter(p =>
      p && p.referenceNo !== 'POS Checkout Initial Payment' && !p.referenceNo?.toLowerCase().includes('initial payment')
    );
    const totalDuesRecovered = duesRecoveries.reduce((sum, p) => sum + (p.amount || 0), 0);

    // Initial checkout paid amount cannot exceed netTotal (any excess is change return handed back to customer)
    const rawPaid = paidAmount !== undefined ? parseFloat(paidAmount) : (existingSale.paidAmount - totalDuesRecovered);
    const newInitialPaid = Math.max(0, Math.min(rawPaid, netTotal));
    const finalPaidAmount = Math.min(netTotal, newInitialPaid + totalDuesRecovered);
    const status = finalPaidAmount >= netTotal ? 'PAID' : finalPaidAmount > 0 ? 'PARTIAL' : 'PENDING';

    const saleResult = await prisma.$transaction(async (tx) => {
      // 1. Revert previous inventory stock for old items using baseQuantity
      for (const oldItem of existingSale.items) {
        if (oldItem.medicineId) {
          try {
            const med = await tx.pharmacyMedicine.findUnique({ where: { id: oldItem.medicineId } });
            if (med) {
              const oldBaseQty = (oldItem.baseQuantity !== null && oldItem.baseQuantity !== undefined && oldItem.baseQuantity > 0)
                ? oldItem.baseQuantity
                : (oldItem.conversionFactor ? oldItem.quantity * oldItem.conversionFactor : oldItem.quantity);
              await tx.pharmacyMedicine.update({
                where: { id: oldItem.medicineId },
                data: { stockQuantity: med.stockQuantity + oldBaseQty }
              });
            }
          } catch (e) {
            console.warn(`Stock revert skipped for ${oldItem.medicineId}:`, e);
          }
        }
      }

      // 2. Delete old sale items
      await tx.pharmacySaleItem.deleteMany({ where: { saleId: id } });

      // 3. Deduct new inventory stock & create new items
      for (const item of validatedItems) {
        if (item.medicineId) {
          try {
            const med = await tx.pharmacyMedicine.findUnique({ where: { id: item.medicineId } });
            if (med) {
              const newStock = Math.max(0, med.stockQuantity - item.baseQuantity);
              await tx.pharmacyMedicine.update({
                where: { id: item.medicineId },
                data: { stockQuantity: newStock }
              });
            }
          } catch (e) {
            console.warn(`Stock update skipped for ${item.medicineId}:`, e);
          }
        }
      }

      // 4. Update initial payment record in PharmacyCustomerPayment
      const initPayment = await tx.pharmacyCustomerPayment.findFirst({
        where: {
          saleId: id,
          referenceNo: 'POS Checkout Initial Payment'
        }
      });
      if (initPayment) {
        await tx.pharmacyCustomerPayment.update({
          where: { id: initPayment.id },
          data: { amount: newInitialPaid }
        });
      } else if (newInitialPaid > 0) {
        await tx.pharmacyCustomerPayment.create({
          data: {
            saleId: id,
            amount: newInitialPaid,
            paymentMethod: paymentMethod || existingSale.paymentMethod || 'CASH',
            referenceNo: 'POS Checkout Initial Payment',
            collectedAtCounter: req.body.paidAtCounter || existingSale.paidAtCounter || 'PHARMACY'
          }
        });
      }

      // 5. Update PharmacySale record
      const updatedSale = await tx.pharmacySale.update({
        where: { id },
        data: {
          saleType: saleType || existingSale.saleType,
          patientId: validPatientId,
          customerName: customerName || existingSale.customerName,
          customerPhone: customerPhone || null,
          subtotal,
          discount: disc,
          netTotal,
          paidAmount: finalPaidAmount,
          status,
          paymentMethod: paymentMethod || existingSale.paymentMethod,
          paidAtCounter: req.body.paidAtCounter || existingSale.paidAtCounter || (finalPaidAmount > 0 ? 'PHARMACY' : null),
          notes: notes || null,
          items: {
            create: validatedItems.map(i => ({
              medicineId: i.medicineId,
              medicineName: i.medicineName,
              quantity: i.quantity,
              unitPrice: i.unitPrice,
              totalPrice: i.totalPrice,
              soldUnit: i.soldUnit,
              conversionFactor: i.conversionFactor,
              baseQuantity: i.baseQuantity
            }))
          }
        },
        include: { items: true, patient: true }
      });

      return updatedSale;
    });

    return res.status(200).json({
      success: true,
      message: `Invoice ${existingSale.invoiceNo} updated successfully! Stock inventory adjusted.`,
      sale: saleResult
    });
  } catch (error) {
    console.error('updatePharmacySale error:', error);
    return res.status(500).json({ success: false, message: 'Failed to update pharmacy sale record.' });
  }
};

const enrichSaleWithReturns = (sale) => {
  if (!sale) return sale;
  const returnsList = sale.returns || [];
  const totalRefund = returnsList.reduce((sum, r) => sum + (r.refundAmount || 0), 0);
  const returnedItemsCount = returnsList.reduce(
    (sum, r) => sum + (r.items || []).reduce((is, i) => is + (i.quantity || 0), 0),
    0
  );
  const adjustedNetTotal = Math.max(0, sale.netTotal - totalRefund);

  const returnedQtyMap = {};
  returnsList.forEach(r => {
    (r.items || []).forEach(i => {
      if (i.medicineId) {
        returnedQtyMap[i.medicineId] = (returnedQtyMap[i.medicineId] || 0) + (i.quantity || 0);
      }
      if (i.medicineName) {
        returnedQtyMap[i.medicineName] = (returnedQtyMap[i.medicineName] || 0) + (i.quantity || 0);
      }
    });
  });

  const enrichedItems = (sale.items || []).map(item => {
    const retQty = (item.medicineId && returnedQtyMap[item.medicineId])
      || returnedQtyMap[item.medicineName]
      || 0;
    const activeQty = Math.max(0, (item.quantity || 0) - retQty);
    return {
      ...item,
      returnedQuantity: retQty,
      activeQuantity: activeQty,
      activeTotalPrice: activeQty * (item.unitPrice || 0),
      isReturned: retQty > 0,
      isFullyReturned: activeQty === 0 && (item.quantity || 0) > 0
    };
  });

  const unpaidBalance = Math.max(0, adjustedNetTotal - (sale.paidAmount || 0));

  return {
    ...sale,
    totalRefund,
    returnedItemsCount,
    adjustedNetTotal,
    unpaidBalance,
    hasReturns: totalRefund > 0,
    items: enrichedItems
  };
};

const getSaleById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ success: false, message: 'Sale ID or Invoice No is required.' });
    }

    const sale = await prisma.pharmacySale.findFirst({
      where: {
        OR: [
          { id },
          { invoiceNo: id }
        ]
      },
      include: {
        items: true,
        patient: true,
        returns: { include: { items: true } },
        duePayments: true
      }
    });

    if (!sale) {
      return res.status(404).json({ success: false, message: 'Sale invoice record not found.' });
    }

    return res.status(200).json({ success: true, sale: enrichSaleWithReturns(sale) });
  } catch (error) {
    console.error('getSaleById error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch pharmacy sale details.' });
  }
};

const getAllSales = async (req, res) => {
  try {
    const { period, startDate, endDate, search, status, patientId, walkinKey } = req.query;
    const whereConditions = [];

    if (patientId && patientId.trim()) {
      whereConditions.push({ patientId: patientId.trim() });
    } else if (walkinKey && walkinKey.trim()) {
      const wKey = walkinKey.trim();
      whereConditions.push({
        patientId: null,
        OR: [
          { customerPhone: { contains: wKey, mode: 'insensitive' } },
          { customerName: { contains: wKey, mode: 'insensitive' } }
        ]
      });
    }

    if (search && search.trim()) {
      const q = search.trim();
      whereConditions.push({
        OR: [
          { invoiceNo: { contains: q, mode: 'insensitive' } },
          { customerName: { contains: q, mode: 'insensitive' } },
          { customerPhone: { contains: q, mode: 'insensitive' } },
          { notes: { contains: q, mode: 'insensitive' } }
        ]
      });
    }

    if (status && status !== 'ALL') {
      whereConditions.push({ status });
    }

    let dateFilter = null;

    if (period === 'today' || period === 'TODAY') {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      dateFilter = { gte: todayStart };
    } else if (period === 'weekly' || period === 'WEEKLY') {
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - 7);
      weekStart.setHours(0, 0, 0, 0);
      dateFilter = { gte: weekStart };
    } else if (period === 'monthly' || period === 'MONTHLY') {
      const monthStart = new Date();
      monthStart.setDate(monthStart.getDate() - 30);
      monthStart.setHours(0, 0, 0, 0);
      dateFilter = { gte: monthStart };
    } else if (startDate && endDate) {
      dateFilter = {
        gte: new Date(`${startDate}T00:00:00`),
        lte: new Date(`${endDate}T23:59:59.999`)
      };
    }

    if (dateFilter) {
      whereConditions.push({
        OR: [
          { createdAt: dateFilter },
          { duePayments: { some: { createdAt: dateFilter } } }
        ]
      });
    }

    const where = whereConditions.length > 0 ? { AND: whereConditions } : {};

    const sales = await prisma.pharmacySale.findMany({
      where,
      include: {
        items: true,
        patient: true,
        returns: { include: { items: true } },
        duePayments: true
      },
      orderBy: { createdAt: 'desc' }
    });

    const enrichedSales = sales.map(enrichSaleWithReturns);

    return res.status(200).json({ success: true, sales: enrichedSales });
  } catch (error) {
    console.error('getAllSales error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch sales history.' });
  }
};

// -------------------------------------------------------------
// 5. DUES MANAGEMENT, FIFO PAYMENTS & PAYMENT HISTORY
// -------------------------------------------------------------

const getGlobalDueKpi = async (req, res) => {
  try {
    const sales = await prisma.pharmacySale.findMany({
      where: {
        OR: [
          { notes: null },
          { notes: { not: { contains: '_ARCHIVED_DUES_' } } }
        ]
      },
      include: {
        duePayments: true,
        returns: { include: { items: true } }
      }
    });

    // Filter to only sales that had dues/credit, excluding 100% direct cash sales
    const dueSales = sales.filter(sale => {
      const refund = (sale.returns || []).reduce((sum, r) => sum + (r.refundAmount || 0), 0);
      const effNet = Math.max(0, sale.netTotal - refund);
      const hadDues = (effNet > sale.paidAmount) ||
        (sale.duePayments && sale.duePayments.some(p => p.referenceNo && !p.referenceNo.startsWith('POS Checkout')));
      return hadDues;
    });

    const totalBilled = dueSales.reduce((sum, s) => {
      const refund = (s.returns || []).reduce((rSum, r) => rSum + (r.refundAmount || 0), 0);
      return sum + Math.max(0, s.netTotal - refund);
    }, 0);
    const totalPaid = dueSales.reduce((sum, s) => sum + s.paidAmount, 0);
    const totalPending = dueSales.reduce((sum, s) => {
      const refund = (s.returns || []).reduce((rSum, r) => rSum + (r.refundAmount || 0), 0);
      const effNet = Math.max(0, s.netTotal - refund);
      return sum + Math.max(0, effNet - s.paidAmount);
    }, 0);

    const pendingCustomerSet = new Set(
      dueSales
        .filter(s => {
          const refund = (s.returns || []).reduce((rSum, r) => rSum + (r.refundAmount || 0), 0);
          return Math.max(0, s.netTotal - refund) > s.paidAmount;
        })
        .map(s => s.patientId ? `PAT-${s.patientId}` : `NAME-${s.customerName}`)
    );

    return res.status(200).json({
      success: true,
      totalBilled,
      totalPaid,
      totalPending,
      customerCount: pendingCustomerSet.size
    });
  } catch (error) {
    console.error('getGlobalDueKpi error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch global dues KPI.' });
  }
};

const getCustomerDueSummary = async (req, res) => {
  try {
    const sales = await prisma.pharmacySale.findMany({
      where: {
        OR: [
          { notes: null },
          { notes: { not: { contains: '_ARCHIVED_DUES_' } } }
        ]
      },
      include: {
        patient: true,
        duePayments: true,
        returns: { include: { items: true } }
      }
    });

    const customerMap = {};
    sales.forEach(sale => {
      const refund = (sale.returns || []).reduce((sum, r) => sum + (r.refundAmount || 0), 0);
      const effectiveNet = Math.max(0, sale.netTotal - refund);

      // Direct cash sales (paid in full directly at checkout with no dues) are NOT added to the dues page!
      const hadDues = (effectiveNet > sale.paidAmount) ||
        (sale.duePayments && sale.duePayments.some(p => p.referenceNo && !p.referenceNo.startsWith('POS Checkout')));

      if (!hadDues) {
        return;
      }

      const cleanPhone = sale.customerPhone ? sale.customerPhone.trim() : '';
      const cleanName = sale.customerName ? sale.customerName.trim() : 'Walk-In Customer';

      const key = sale.patientId
        ? `PATIENT-${sale.patientId}`
        : (cleanPhone && cleanPhone !== '—' ? `WALKIN-${cleanPhone}` : `WALKIN-${cleanName}`);

      if (!customerMap[key]) {
        customerMap[key] = {
          customer_id: key,
          id: key,
          customer_name: sale.patient ? sale.patient.name : cleanName,
          name: sale.patient ? sale.patient.name : cleanName,
          customer_phone: sale.patient?.phone || sale.customerPhone || '—',
          phone: sale.patient?.phone || sale.customerPhone || '—',
          address: sale.patient ? 'Hospital Patient MRN' : 'Walk-In Customer',
          invoice_count: 0,
          total_billed: 0,
          total_paid: 0,
          total_pending: 0
        };
      }
      customerMap[key].invoice_count += 1;
      customerMap[key].total_billed += effectiveNet;
      customerMap[key].total_paid += sale.paidAmount;
      const due = Math.max(0, effectiveNet - sale.paidAmount);
      customerMap[key].total_pending += due;
    });

    // The dues page is strictly for customers who have outstanding dues (total_pending > 0).
    const summaryList = Object.values(customerMap)
      .filter(c => c.total_pending > 0)
      .sort((a, b) => b.total_pending - a.total_pending);

    return res.status(200).json({ success: true, summary: summaryList, customerDues: summaryList });
  } catch (error) {
    console.error('getCustomerDueSummary error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch customer dues summary.' });
  }
};

const softDeleteCustomerDue = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ success: false, message: 'Customer ID is required.' });
    }

    const isPatient = id.startsWith('PATIENT-');
    const targetKey = isPatient ? id.replace('PATIENT-', '') : id.replace('WALKIN-', '');

    const sales = await prisma.pharmacySale.findMany({
      where: isPatient
        ? { patientId: targetKey }
        : {
          OR: [
            { customerPhone: targetKey },
            { customerName: targetKey }
          ]
        }
    });

    if (sales.length === 0) {
      return res.status(404).json({ success: false, message: 'Customer dues record not found.' });
    }

    const totalPending = sales.reduce((sum, s) => sum + Math.max(0, s.netTotal - s.paidAmount), 0);

    if (totalPending > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete customer dues record with outstanding balance of PKR ${totalPending.toLocaleString()}. Please settle all pending dues to Rs. 0 first.`
      });
    }

    for (const s of sales) {
      const newNotes = s.notes ? `${s.notes} _ARCHIVED_DUES_` : '_ARCHIVED_DUES_';
      await prisma.pharmacySale.update({
        where: { id: s.id },
        data: { notes: newNotes }
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Customer dues ledger soft deleted successfully. Historical sales preserved.'
    });
  } catch (error) {
    console.error('softDeleteCustomerDue error:', error);
    return res.status(500).json({ success: false, message: 'Failed to soft delete customer dues record.' });
  }
};

const recordIndividualDuePayment = async (req, res) => {
  try {
    const { saleId, amount, paymentMethod, collectedAtCounter } = req.body;
    if (!saleId || !amount || parseFloat(amount) <= 0) {
      return res.status(400).json({ success: false, message: 'Sale ID and positive payment amount are required.' });
    }

    const payVal = parseFloat(amount);
    const counter = collectedAtCounter || 'PHARMACY';

    const result = await prisma.$transaction(async (tx) => {
      const sale = await tx.pharmacySale.findUnique({ where: { id: saleId } });
      if (!sale) throw new Error('Sale invoice record not found.');

      const newPaid = sale.paidAmount + payVal;
      const newDue = Math.max(0, sale.netTotal - newPaid);
      const newStatus = newDue <= 0 ? 'PAID' : 'PARTIAL';

      let updatedCounter = counter;
      if (sale.paidAtCounter && sale.paidAtCounter !== counter && sale.paidAmount > 0) {
        updatedCounter = 'SPLIT';
      } else if (!sale.paidAtCounter) {
        updatedCounter = counter;
      } else {
        updatedCounter = sale.paidAtCounter;
      }

      await tx.pharmacySale.update({
        where: { id: saleId },
        data: {
          paidAmount: newPaid,
          status: newStatus,
          paidAtCounter: updatedCounter
        }
      });

      const payment = await tx.pharmacyCustomerPayment.create({
        data: {
          saleId: sale.id,
          amount: payVal,
          paymentMethod: paymentMethod || 'CASH',
          referenceNo: `Manual Payment on ${sale.invoiceNo}`,
          collectedAtCounter: counter
        }
      });

      return payment;
    });

    return res.status(201).json({ success: true, message: 'Payment recorded successfully.', payment: result });
  } catch (error) {
    console.error('recordIndividualDuePayment error:', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to record payment.' });
  }
};

const recordFifoPayment = async (req, res) => {
  try {
    const { customerId, amount, paymentMethod, collectedAtCounter } = req.body;
    if (!customerId || !amount || parseFloat(amount) <= 0) {
      return res.status(400).json({ success: false, message: 'Customer ID and positive amount are required.' });
    }

    let remainingAmount = parseFloat(amount);
    const counter = collectedAtCounter || 'PHARMACY';

    const isPatient = customerId.startsWith('PATIENT-');
    const targetKey = isPatient ? customerId.replace('PATIENT-', '') : customerId.replace('WALKIN-', '');

    const activeDues = await prisma.pharmacySale.findMany({
      where: {
        ...(isPatient
          ? { patientId: targetKey }
          : {
            OR: [
              { customerPhone: { contains: targetKey, mode: 'insensitive' } },
              { customerName: { contains: targetKey, mode: 'insensitive' } }
            ]
          }),
        status: { in: ['PENDING', 'PARTIAL'] },
        AND: [
          {
            OR: [
              { notes: null },
              { notes: { not: { contains: '_ARCHIVED_DUES_' } } }
            ]
          }
        ]
      },
      orderBy: { createdAt: 'asc' }
    });

    if (activeDues.length === 0) {
      return res.status(400).json({ success: false, message: 'No active outstanding dues found for this customer.' });
    }

    await prisma.$transaction(async (tx) => {
      for (const due of activeDues) {
        if (remainingAmount <= 0) break;

        const currentDueAmount = Math.max(0, due.netTotal - due.paidAmount);
        const payForThisDue = Math.min(remainingAmount, currentDueAmount);
        const newPaid = due.paidAmount + payForThisDue;
        const newDue = Math.max(0, due.netTotal - newPaid);
        const newStatus = newDue <= 0 ? 'PAID' : 'PARTIAL';

        let updatedCounter = counter;
        if (due.paidAtCounter && due.paidAtCounter !== counter && due.paidAmount > 0) {
          updatedCounter = 'SPLIT';
        } else if (!due.paidAtCounter) {
          updatedCounter = counter;
        } else {
          updatedCounter = due.paidAtCounter;
        }

        await tx.pharmacySale.update({
          where: { id: due.id },
          data: {
            paidAmount: newPaid,
            status: newStatus,
            paidAtCounter: updatedCounter
          }
        });

        await tx.pharmacyCustomerPayment.create({
          data: {
            saleId: due.id,
            amount: payForThisDue,
            paymentMethod: paymentMethod || 'CASH',
            referenceNo: `FIFO Payment auto-applied to ${due.invoiceNo}`,
            collectedAtCounter: counter
          }
        });

        remainingAmount -= payForThisDue;
      }
    });

    return res.status(200).json({
      success: true,
      message: `Rs. ${amount} successfully distributed via FIFO across oldest outstanding invoices!`
    });
  } catch (error) {
    console.error('recordFifoPayment error:', error);
    return res.status(500).json({ success: false, message: 'Failed to apply FIFO payment.' });
  }
};

const getPaymentHistory = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const whereClause = {};
    if (startDate && endDate) {
      whereClause.createdAt = {
        gte: new Date(`${startDate}T00:00:00.000Z`),
        lte: new Date(`${endDate}T23:59:59.999Z`)
      };
    }

    const payments = await prisma.pharmacyCustomerPayment.findMany({
      where: whereClause,
      include: {
        sale: {
          include: { patient: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const result = payments.map(p => ({
      id: p.id,
      due_id: p.saleId,
      sale_id: p.sale?.invoiceNo || p.saleId,
      amount: p.amount,
      date: p.createdAt.toISOString(),
      customer_name: p.sale?.patient ? p.sale.patient.name : p.sale?.customerName || 'Customer',
      customer_phone: p.sale?.patient ? p.sale.patient.phone : p.sale?.customerPhone || '—',
      invoice_total: p.sale?.netTotal || 0,
      isSoftDeleted: p.sale?.notes ? p.sale.notes.includes('_ARCHIVED_DUES_') : false
    }));

    return res.status(200).json({ success: true, payments: result });
  } catch (error) {
    console.error('getPaymentHistory error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch payment history.' });
  }
};

const editCustomerPayment = async (req, res) => {
  try {
    const { paymentId } = req.params;
    const { newAmount } = req.body;

    if (!paymentId || newAmount === undefined || parseFloat(newAmount) <= 0) {
      return res.status(400).json({ success: false, message: 'Payment ID and positive new amount are required.' });
    }

    const newAmtVal = parseFloat(newAmount);

    const result = await prisma.$transaction(async (tx) => {
      const payment = await tx.pharmacyCustomerPayment.findUnique({ where: { id: paymentId } });
      if (!payment) throw new Error('Payment record not found.');

      const sale = await tx.pharmacySale.findUnique({ where: { id: payment.saleId } });
      if (!sale) throw new Error('Sale invoice record not found.');
      if (sale.notes && sale.notes.includes('_ARCHIVED_DUES_')) {
        throw new Error('Cannot edit payment for a soft-deleted customer record.');
      }

      const diff = newAmtVal - payment.amount;
      const newPaid = Math.max(0, sale.paidAmount + diff);
      const newDue = Math.max(0, sale.netTotal - newPaid);
      const newStatus = newDue <= 0 ? 'PAID' : newPaid > 0 ? 'PARTIAL' : 'PENDING';

      await tx.pharmacyCustomerPayment.update({
        where: { id: paymentId },
        data: { amount: newAmtVal }
      });

      await tx.pharmacySale.update({
        where: { id: sale.id },
        data: {
          paidAmount: newPaid,
          status: newStatus
        }
      });

      return { success: true };
    });

    return res.status(200).json({ success: true, message: 'Payment record updated successfully.', result });
  } catch (error) {
    console.error('editCustomerPayment error:', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to edit payment record.' });
  }
};

// -------------------------------------------------------------
// 6. SALES RETURNS & DUES ADJUSTMENTS
// -------------------------------------------------------------

const processPharmacyReturn = async (req, res) => {
  try {
    const { invoiceNo, reason, refundMethod, items } = req.body;

    if (!invoiceNo || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Invoice number and returned medicine items are required.' });
    }

    const sale = await prisma.pharmacySale.findUnique({
      where: { invoiceNo: invoiceNo.trim() },
      include: {
        items: true,
        returns: { include: { items: true } },
        duePayments: true
      }
    });

    const year = new Date().getFullYear();
    const returnNo = generatePharmacyReturnNo(year);

    let totalRefund = 0;
    const validatedItems = items.map(item => {
      const qty = parseFloat(item.quantity) || 1;
      const price = parseFloat(item.unitPrice) || 0;
      const refund = Number((qty * price).toFixed(2));
      totalRefund += refund;

      // Look up original sale line item to determine multiplier/soldUnit
      const saleItem = sale?.items?.find(si =>
        (item.saleItemId && si.id === item.saleItemId) ||
        (item.medicineId && si.medicineId === item.medicineId)
      );
      const mult = item.conversionFactor || saleItem?.conversionFactor || 1.0;
      const baseQty = Number((qty * mult).toFixed(4));

      return {
        medicineId: item.medicineId || null,
        medicineName: item.medicineName,
        quantity: qty,
        unitPrice: price,
        totalRefund: refund,
        soldUnit: item.soldUnit || saleItem?.soldUnit || null,
        conversionFactor: mult,
        baseQuantity: baseQty
      };
    });

    const returnResult = await prisma.$transaction(async (tx) => {
      const phReturn = await tx.pharmacyReturn.create({
        data: {
          returnNo,
          saleId: sale?.id || null,
          invoiceNo: invoiceNo.trim(),
          customerName: sale?.customerName || 'Customer Return',
          refundAmount: totalRefund,
          refundMethod: refundMethod || 'Cash',
          reason: reason || 'Customer Return',
          createdBy: req.user?.name || 'Pharmacist',
          items: {
            create: validatedItems.map(i => ({
              medicineId: i.medicineId,
              medicineName: i.medicineName,
              quantity: i.quantity,
              unitPrice: i.unitPrice,
              totalRefund: i.totalRefund
            }))
          }
        },
        include: { items: true }
      });

      // Update the sale status and adjustments on the backend
      if (sale) {
        const priorRefunds = (sale.returns || []).reduce((sum, r) => sum + (r.refundAmount || 0), 0);
        const newTotalRefunds = priorRefunds + totalRefund;
        const newAdjustedNet = Math.max(0, sale.netTotal - newTotalRefunds);

        if (refundMethod === 'Dues Adjustment') {
          const newDue = Math.max(0, newAdjustedNet - sale.paidAmount);
          const newStatus = newDue <= 0 ? 'PAID' : 'PARTIAL';
          await tx.pharmacySale.update({
            where: { id: sale.id },
            data: {
              status: newStatus
            }
          });
          await tx.pharmacyCustomerPayment.create({
            data: {
              saleId: sale.id,
              amount: totalRefund,
              paymentMethod: 'Dues Adjustment',
              referenceNo: `Sales Return Dues Credit (${returnNo})`
            }
          });
        } else {
          // Cash, Card, Bank Transfer refund
          const newDue = Math.max(0, newAdjustedNet - sale.paidAmount);
          const newStatus = newDue <= 0 ? 'PAID' : (sale.paidAmount > 0 ? 'PARTIAL' : 'PENDING');
          await tx.pharmacySale.update({
            where: { id: sale.id },
            data: {
              status: newStatus
            }
          });
        }
      }

      for (const item of validatedItems) {
        if (item.medicineId) {
          // Atomic stock increment on returns in baseQuantity
          await tx.pharmacyMedicine.update({
            where: { id: item.medicineId },
            data: { stockQuantity: { increment: item.baseQuantity } }
          });
        }
      }

      return phReturn;
    });

    const updatedSaleRecord = sale
      ? await prisma.pharmacySale.findUnique({
        where: { id: sale.id },
        include: {
          items: true,
          patient: true,
          returns: { include: { items: true } },
          duePayments: true
        }
      })
      : null;

    return res.status(201).json({
      success: true,
      message: `Return ${returnNo} processed successfully (${refundMethod}). Items restocked into inventory!`,
      pharmacyReturn: returnResult,
      updatedSale: updatedSaleRecord ? enrichSaleWithReturns(updatedSaleRecord) : null
    });
  } catch (error) {
    console.error('processPharmacyReturn error:', error);
    return res.status(500).json({ success: false, message: 'Failed to process medicine sales return.' });
  }
};

const getAllReturns = async (req, res) => {
  try {
    const returns = await prisma.pharmacyReturn.findMany({
      include: {
        items: true,
        sale: {
          include: {
            patient: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return res.status(200).json({ success: true, returns });
  } catch (error) {
    console.error('getAllReturns error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch sales returns history.' });
  }
};

const getCustomerLedgers = async (req, res) => {
  try {
    const sales = await prisma.pharmacySale.findMany({
      include: {
        patient: true,
        items: true,
        returns: { include: { items: true } },
        duePayments: true
      },
      orderBy: { createdAt: 'desc' }
    });

    const customerMap = {};
    sales.forEach(sale => {
      const refund = (sale.returns || []).reduce((sum, r) => sum + (r.refundAmount || 0), 0);
      const effectiveNet = Math.max(0, sale.netTotal - refund);
      const due = Math.max(0, effectiveNet - sale.paidAmount);

      const key = sale.patientId ? `PATIENT-${sale.patientId}` : `WALKIN-${sale.customerName}`;
      if (!customerMap[key]) {
        customerMap[key] = {
          id: key,
          customer_id: key,
          name: sale.patient ? sale.patient.name : sale.customerName,
          customer_name: sale.patient ? sale.patient.name : sale.customerName,
          type: sale.saleType,
          mrn: sale.patient?.mrn || 'N/A',
          phone: sale.patient?.phone || sale.customerPhone || '—',
          customer_phone: sale.patient?.phone || sale.customerPhone || '—',
          totalPurchases: 0,
          totalPaid: 0,
          outstandingBalance: 0,
          ordersCount: 0,
          sales: []
        };
      }
      customerMap[key].totalPurchases += effectiveNet;
      customerMap[key].totalPaid += sale.paidAmount;
      customerMap[key].outstandingBalance += due;
      customerMap[key].ordersCount += 1;

      customerMap[key].sales.push({
        ...enrichSaleWithReturns(sale),
        total_amount: effectiveNet,
        paid_amount: sale.paidAmount,
        due_amount: due,
        status: sale.status ? sale.status.toLowerCase() : (effectiveNet <= sale.paidAmount ? 'paid' : 'pending'),
        date: sale.createdAt.toISOString().split('T')[0]
      });
    });

    return res.status(200).json({
      success: true,
      customers: Object.values(customerMap)
    });
  } catch (error) {
    console.error('getCustomerLedgers error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch customer ledgers.' });
  }
};

const getPharmacyDashboardSummary = async (req, res) => {
  try {
    const { period, startDate, endDate } = req.query;

    const medicines = await prisma.pharmacyMedicine.findMany();
    const sales = await prisma.pharmacySale.findMany({
      include: {
        items: true,
        patient: true,
        returns: { include: { items: true } },
        duePayments: true
      },
      orderBy: { createdAt: 'desc' }
    });
    const suppliers = await prisma.pharmacySupplier.findMany();
    const supplierPayments = await prisma.pharmacySupplierPayment.findMany({
      include: { supplier: true },
      orderBy: { paymentDate: 'desc' }
    });
    const supplierLedgers = await prisma.pharmacySupplierLedger.findMany({
      include: { supplier: true },
      orderBy: { purchaseDate: 'desc' }
    });
    const returns = await prisma.pharmacyReturn.findMany({
      include: { items: true }
    });
    const customerPayments = await prisma.pharmacyCustomerPayment.findMany({
      include: { sale: true }
    });

    let activeSales = sales.filter(s => !(s.notes && s.notes.includes('_ARCHIVED_DUES_')));
    let activeReturns = returns;

    let start = null;
    let end = null;

    if (period === 'today' || period === 'TODAY') {
      start = new Date();
      start.setHours(0, 0, 0, 0);
      end = new Date();
      end.setHours(23, 59, 59, 999);
    } else if (period === 'yesterday' || period === 'YESTERDAY') {
      start = new Date();
      start.setDate(start.getDate() - 1);
      start.setHours(0, 0, 0, 0);
      end = new Date();
      end.setDate(end.getDate() - 1);
      end.setHours(23, 59, 59, 999);
    } else if (period === 'weekly' || period === 'WEEKLY') {
      start = new Date();
      start.setDate(start.getDate() - 7);
      start.setHours(0, 0, 0, 0);
      end = new Date();
    } else if (period === 'monthly' || period === 'MONTHLY') {
      start = new Date();
      start.setDate(start.getDate() - 30);
      start.setHours(0, 0, 0, 0);
      end = new Date();
    } else if (startDate && endDate) {
      start = new Date(`${startDate}T00:00:00`);
      end = new Date(`${endDate}T23:59:59.999`);
    }

    const isDateInPeriod = (d) => {
      if (!d) return false;
      if (!start || !end) return true;
      const dateObj = new Date(d);
      return dateObj >= start && dateObj <= end;
    };

    const periodSales = [];
    const periodRecoveries = [];

    activeSales.forEach(sale => {
      // Filter out initial checkout payment records to isolate pure DUES RECOVERY payments
      const duePaymentsList = (sale.duePayments || []).filter(p => {
        if (!p) return false;
        if (p.referenceNo === 'POS Checkout Initial Payment' || p.referenceNo?.toLowerCase().includes('initial payment')) {
          return false;
        }
        return true;
      });

      const totalRecoveredVal = duePaymentsList.reduce((sum, p) => sum + (p.amount || 0), 0);
      const initialPaidAmount = Math.max(0, Math.min(sale.netTotal, (sale.paidAmount || 0) - totalRecoveredVal));

      if (isDateInPeriod(sale.createdAt)) {
        periodSales.push({
          ...sale,
          duePaymentsList,
          totalRecoveredVal,
          initialPaidAmount
        });
      }

      duePaymentsList.forEach(payment => {
        if (isDateInPeriod(payment.createdAt || payment.paymentDate)) {
          periodRecoveries.push(payment);
        }
      });
    });

    const periodReturns = activeReturns.filter(r => isDateInPeriod(r.createdAt));

    const totalMedicines = medicines.length;
    const lowStockCount = medicines.filter(m => m.stockQuantity <= m.minStockAlert).length;
    const totalStockValuation = medicines.reduce((sum, m) => sum + (m.stockQuantity * m.retailPrice), 0);

    const now = new Date();
    const ninetyDaysFromNow = new Date();
    ninetyDaysFromNow.setDate(ninetyDaysFromNow.getDate() + 90);

    const expiredItems = medicines.filter(m => m.expiryDate && new Date(m.expiryDate) < now);
    const expiredCount = expiredItems.length;

    const nearExpiryItems = medicines.filter(m => m.expiryDate && new Date(m.expiryDate) >= now && new Date(m.expiryDate) <= ninetyDaysFromNow);
    const nearExpiryCount = nearExpiryItems.length;

    const medCatMap = {};
    medicines.forEach(m => {
      medCatMap[m.name] = m.category || 'GENERAL';
      medCatMap[m.id] = m.category || 'GENERAL';
    });

    const getSaleEffNet = (s) => {
      const refund = (s.returns || []).reduce((sum, r) => sum + (r.refundAmount || 0), 0);
      return Math.max(0, s.netTotal - refund);
    };

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todaySales = activeSales.filter(s => new Date(s.createdAt) >= today);
    const todayRevenue = todaySales.reduce((sum, s) => {
      const sub = (s.subtotal && s.subtotal > 0) ? s.subtotal : ((s.netTotal || 0) + (s.discount || 0));
      const refund = (s.returns || []).reduce((rSum, r) => rSum + (r.refundAmount || 0), 0);
      return sum + Math.max(0, sub - refund);
    }, 0);

    // Total sale period (Gross sales before discount)
    const totalSalePeriod = periodSales.reduce((sum, s) => {
      const sub = (s.subtotal && s.subtotal > 0) ? s.subtotal : ((s.netTotal || 0) + (s.discount || 0));
      const refund = (s.returns || []).reduce((rSum, r) => rSum + (r.refundAmount || 0), 0);
      return sum + Math.max(0, sub - refund);
    }, 0);
    const grossRevenue = totalSalePeriod;
    const totalDiscounts = periodSales.reduce((sum, s) => sum + (s.discount || 0), 0);
    const discountedSalesCount = periodSales.filter(s => (s.discount || 0) > 0).length;
    const totalReturnsCount = periodReturns.length;
    const totalRefundsAmount = periodReturns.reduce((sum, r) => sum + (r.refundAmount || 0), 0);
    const returnedUnitsCount = periodReturns.reduce((sum, r) => sum + (r.items || []).reduce((is, i) => is + (i.quantity || 0), 0), 0);
    const totalRevenue = Math.max(0, grossRevenue - totalRefundsAmount - totalDiscounts);
    const totalSupplierDues = suppliers.reduce((sum, s) => sum + (s.payableBalance || 0), 0);

    // Stock Paid (Payments disbursed to suppliers for medicine stock in this period)
    const periodSupplierPayments = supplierPayments.filter(p => isDateInPeriod(p.paymentDate || p.createdAt));
    const totalStockPaid = periodSupplierPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
    const stockPaymentsCount = periodSupplierPayments.length;

    // Stock Purchases & Pending Dues
    const periodSupplierLedgers = supplierLedgers.filter(l => isDateInPeriod(l.purchaseDate || l.createdAt));
    const totalStockPurchased = periodSupplierLedgers.reduce((sum, l) => sum + (l.totalAmount || 0), 0);
    const stockPurchasesCount = periodSupplierLedgers.length;
    const periodStockPending = periodSupplierLedgers.reduce((sum, l) => sum + Math.max(0, (l.balance !== undefined && l.balance !== null) ? l.balance : ((l.totalAmount || 0) - (l.paidAmount || 0))), 0);
    const totalStockCostValuation = medicines.reduce((sum, m) => sum + ((m.stockQuantity || 0) * (m.unitCost || 0)), 0);

    // Internal vs External Sales Breakdown (for periodSales)
    const internalSales = periodSales.filter(s => s.patientId || (s.mrn && s.mrn !== 'WALK-IN'));
    const externalSales = periodSales.filter(s => !s.patientId && (!s.mrn || s.mrn === 'WALK-IN'));

    const internalRevenue = internalSales.reduce((sum, s) => sum + getSaleEffNet(s), 0);
    const externalRevenue = externalSales.reduce((sum, s) => sum + getSaleEffNet(s), 0);
    const internalCount = internalSales.length;
    const externalCount = externalSales.length;

    // Dues Added vs Recovered & Net Cash Collected
    const totalPosCollected = periodSales.reduce((sum, s) => sum + (s.initialPaidAmount || 0), 0);
    const totalDuesRecovered = periodRecoveries.reduce((sum, p) => sum + (p.amount || 0), 0);
    const totalDuesAdded = periodSales.reduce((sum, s) => {
      const refund = (s.returns || []).reduce((rSum, r) => rSum + (r.refundAmount || 0), 0);
      const effNet = Math.max(0, s.netTotal - refund);
      return sum + Math.max(0, effNet - s.initialPaidAmount);
    }, 0);
    const grossCollected = totalPosCollected + totalDuesRecovered;

    // Requested Accounting Formula:
    // net cash collected = total sale period + dues recovered - return - pending dues add - discount - stock paid
    const netCashCollected = (totalSalePeriod + totalDuesRecovered - totalRefundsAmount - totalDuesAdded - totalDiscounts - totalStockPaid);
    const totalNetCollected = netCashCollected;

    // Category Sales Breakdown
    const categoryRevenueMap = {};
    periodSales.forEach(sale => {
      const retMap = {};
      (sale.returns || []).forEach(r => {
        (r.items || []).forEach(ri => {
          const k = ri.medicineName || ri.medicineId;
          retMap[k] = (retMap[k] || 0) + (ri.quantity || 0);
        });
      });

      (sale.items || []).forEach(item => {
        const catName = item.category || medCatMap[item.medicineName] || medCatMap[item.medicineId] || 'TABLETS';
        const retQty = retMap[item.medicineName] || retMap[item.medicineId] || 0;
        const actQty = Math.max(0, (item.quantity || 0) - retQty);
        const actTot = actQty * (item.unitPrice || 0);
        categoryRevenueMap[catName] = (categoryRevenueMap[catName] || 0) + actTot;
      });
    });

    const categoryBreakdown = Object.keys(categoryRevenueMap).map(cat => ({
      category: cat,
      revenue: Math.round(categoryRevenueMap[cat] * 100) / 100
    }));

    // Monthly / Period Sales Trend
    const monthlySalesMap = {};
    periodSales.forEach(sale => {
      const dateObj = new Date(sale.createdAt);
      const monthKey = dateObj.toLocaleString('en-US', { month: 'short', day: '2-digit' });
      if (!monthlySalesMap[monthKey]) {
        monthlySalesMap[monthKey] = { month: monthKey, totalSales: 0, internalSales: 0, externalSales: 0 };
      }
      const effNet = getSaleEffNet(sale);
      monthlySalesMap[monthKey].totalSales += effNet;
      if (sale.patientId || (sale.mrn && sale.mrn !== 'WALK-IN')) {
        monthlySalesMap[monthKey].internalSales += effNet;
      } else {
        monthlySalesMap[monthKey].externalSales += effNet;
      }
    });

    const monthlyTrend = Object.values(monthlySalesMap).reverse().slice(0, 10).reverse();

    // Top 10 Best-Selling Products Aggregation (Accounting for Returns)
    const productSalesMap = {};
    periodSales.forEach(sale => {
      const retMap = {};
      (sale.returns || []).forEach(r => {
        (r.items || []).forEach(ri => {
          const k = ri.medicineName || ri.medicineId;
          retMap[k] = (retMap[k] || 0) + (ri.quantity || 0);
        });
      });

      (sale.items || []).forEach(item => {
        const pName = item.medicineName;
        const retQty = retMap[item.medicineName] || retMap[item.medicineId] || 0;
        const actQty = Math.max(0, (item.quantity || 0) - retQty);
        const actTot = actQty * (item.unitPrice || 0);
        const cat = item.category || medCatMap[item.medicineName] || medCatMap[item.medicineId] || 'GENERAL';

        if (!productSalesMap[pName]) {
          productSalesMap[pName] = { name: pName, category: cat, quantitySold: 0, revenue: 0 };
        }
        productSalesMap[pName].quantitySold += actQty;
        productSalesMap[pName].revenue += actTot;
      });
    });

    const topProducts = Object.values(productSalesMap)
      .filter(p => p.quantitySold > 0)
      .sort((a, b) => b.quantitySold - a.quantitySold)
      .slice(0, 10);

    const summaryObj = {
      totalMedicines,
      lowStockCount,
      totalStockValuation,
      todaySalesCount: todaySales.length,
      todayRevenue,
      totalSalePeriod,
      grossRevenue,
      totalRevenue,
      totalDiscounts,
      discountedSalesCount,
      totalPosCollected,
      totalDuesAdded,
      totalDuesRecovered,
      totalStockPaid,
      stockPaymentsCount,
      totalStockPurchased,
      stockPurchasesCount,
      periodStockPending,
      totalStockCostValuation,
      grossCollected,
      totalNetCollected,
      netCashCollected,
      totalSalesCount: periodSales.length,
      recoveryReceiptsCount: periodRecoveries.length,
      suppliersCount: suppliers.length,
      totalSupplierDues,
      totalReturnsCount,
      totalRefundsAmount,
      returnedUnitsCount,
      internalRevenue,
      externalRevenue,
      internalCount,
      externalCount,
      categoryBreakdown,
      monthlyTrend,
      topProducts,
      topSellingProducts: topProducts,
      expiredCount,
      nearExpiryCount,
      expiredMedicinesCount: expiredCount
    };

    return res.status(200).json({
      success: true,
      summary: summaryObj,
      ...summaryObj,
      recentSales: activeSales.slice(0, 8).map(enrichSaleWithReturns),
      lowStockItems: medicines.filter(m => m.stockQuantity <= m.minStockAlert).slice(0, 5),
      expiredItems: expiredItems.slice(0, 8),
      nearExpiryItems: nearExpiryItems.slice(0, 8)
    });
  } catch (error) {
    console.error('getPharmacyDashboardSummary error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch pharmacy summary statistics.' });
  }
};

module.exports = {
  getAllCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  getAllPackagingUnits,
  createPackagingUnit,
  updatePackagingUnit,
  deletePackagingUnit,
  getAllMedicines,
  getMedicineByBarcode,
  createMedicine,
  updateMedicine,
  deleteMedicine,
  getAllSuppliers,
  createSupplier,
  softDeleteSupplier,
  createSupplierPurchase,
  updateSupplierPurchase,
  deleteSupplierPurchase,
  recordSupplierPayment,
  updateSupplierPayment,
  deleteSupplierPayment,
  createPharmacySale,
  updatePharmacySale,
  getAllSales,
  getSaleById,
  getGlobalDueKpi,
  getCustomerDueSummary,
  softDeleteCustomerDue,
  recordIndividualDuePayment,
  recordFifoPayment,
  getPaymentHistory,
  editCustomerPayment,
  processPharmacyReturn,
  getAllReturns,
  getCustomerLedgers,
  getPharmacyDashboardSummary
};
