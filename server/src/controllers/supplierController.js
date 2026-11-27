const prisma = require('../config/prisma');
const { generatePurchaseOrderNo } = require('../utils/idGenerator');

const getAllSuppliers = async (req, res) => {
  try {
    const { search } = req.query;
    const where = {};

    if (search && search.trim()) {
      const q = search.trim();
      where.OR = [
        { companyName: { contains: q, mode: 'insensitive' } },
        { contactPerson: { contains: q, mode: 'insensitive' } },
        { phone: { contains: q, mode: 'insensitive' } }
      ];
    }

    const suppliers = await prisma.supplier.findMany({
      where,
      orderBy: { companyName: 'asc' },
      include: {
        _count: { select: { purchases: true, payments: true, products: true } }
      }
    });

    return res.status(200).json({ success: true, suppliers });
  } catch (error) {
    console.error('getAllSuppliers error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch suppliers.' });
  }
};

const getSupplierById = async (req, res) => {
  try {
    const { id } = req.params;
    const supplier = await prisma.supplier.findUnique({
      where: { id },
      include: {
        purchases: {
          orderBy: { purchaseDate: 'desc' },
          take: 20,
          include: { items: true }
        },
        payments: {
          orderBy: { paymentDate: 'desc' },
          take: 20
        },
        products: {
          take: 20,
          select: { id: true, name: true, barcode: true, stockQuantity: true, costPrice: true, retailPrice: true }
        }
      }
    });

    if (!supplier) {
      return res.status(404).json({ success: false, message: 'Supplier not found.' });
    }

    return res.status(200).json({ success: true, supplier });
  } catch (error) {
    console.error('getSupplierById error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch supplier details.' });
  }
};

const createSupplier = async (req, res) => {
  try {
    const { companyName, contactPerson, phone, email, address, taxNo, notes } = req.body;

    if (!companyName || !companyName.trim()) {
      return res.status(400).json({ success: false, message: 'Supplier company name is required.' });
    }

    const existing = await prisma.supplier.findUnique({
      where: { companyName: companyName.trim() }
    });

    if (existing) {
      return res.status(409).json({ success: false, message: 'Supplier company already exists.' });
    }

    const supplier = await prisma.supplier.create({
      data: {
        companyName: companyName.trim(),
        contactPerson: contactPerson?.trim() || null,
        phone: phone?.trim() || null,
        email: email?.trim() || null,
        address: address?.trim() || null,
        taxNo: taxNo?.trim() || null,
        notes: notes?.trim() || null
      }
    });

    return res.status(201).json({ success: true, message: 'Supplier created successfully.', supplier });
  } catch (error) {
    console.error('createSupplier error:', error);
    return res.status(500).json({ success: false, message: 'Failed to create supplier.' });
  }
};

const updateSupplier = async (req, res) => {
  try {
    const { id } = req.params;
    const { companyName, contactPerson, phone, email, address, taxNo, notes } = req.body;

    const supplier = await prisma.supplier.update({
      where: { id },
      data: {
        companyName: companyName?.trim(),
        contactPerson: contactPerson?.trim(),
        phone: phone?.trim(),
        email: email?.trim(),
        address: address?.trim(),
        taxNo: taxNo?.trim(),
        notes: notes?.trim()
      }
    });

    return res.status(200).json({ success: true, message: 'Supplier updated successfully.', supplier });
  } catch (error) {
    console.error('updateSupplier error:', error);
    return res.status(500).json({ success: false, message: 'Failed to update supplier.' });
  }
};

const deleteSupplier = async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.supplier.delete({ where: { id } });
    return res.status(200).json({ success: true, message: 'Supplier deleted successfully.' });
  } catch (error) {
    console.error('deleteSupplier error:', error);
    return res.status(500).json({ success: false, message: 'Failed to delete supplier.' });
  }
};

// -------------------------------------------------------------
// STOCK-IN / PURCHASE INVOICES
// -------------------------------------------------------------

const createPurchaseInvoice = async (req, res) => {
  try {
    const {
      supplierId,
      items,
      paidAmount = 0,
      paymentMethod = 'CASH',
      description,
      purchaseDate
    } = req.body;

    if (!supplierId || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Supplier and purchase items are required.' });
    }

    const supplier = await prisma.supplier.findUnique({ where: { id: supplierId } });
    if (!supplier) {
      return res.status(404).json({ success: false, message: 'Supplier not found.' });
    }

    const invoiceNo = generatePurchaseOrderNo();
    const parsedPaid = parseFloat(paidAmount) || 0;

    let totalAmount = 0;
    const itemRecords = items.map(item => {
      const qty = parseFloat(item.quantity) || 1;
      const cost = parseFloat(item.unitCost) || 0;
      const total = qty * cost;
      totalAmount += total;
      return {
        productId: item.productId || null,
        productName: item.productName || item.name || 'Stock Item',
        quantity: qty,
        unitCost: cost,
        totalPrice: total,
        unit: item.unit || 'Pcs'
      };
    });

    const balance = Math.max(0, totalAmount - parsedPaid);
    let paymentStatus = 'PENDING';
    if (parsedPaid >= totalAmount) paymentStatus = 'PAID';
    else if (parsedPaid > 0) paymentStatus = 'PARTIAL';

    const result = await prisma.$transaction(async (tx) => {
      // 1. Restock products and update cost price (handling Multi-Unit conversions: Carton, Pack/Box, Piece)
      for (const item of items) {
        if (item.productId) {
          const product = await tx.product.findUnique({ where: { id: item.productId } });
          let unitMultiplier = 1;
          if (product) {
            const itemUnit = (item.unit || '').toLowerCase();
            if (itemUnit.includes('carton') || itemUnit.includes('ctn')) {
              unitMultiplier = (product.piecesPerPack || 1) * (product.packsPerCarton || 1);
            } else if (itemUnit.includes('pack') || itemUnit.includes('box') || itemUnit.includes('dabbi')) {
              unitMultiplier = product.piecesPerPack || 1;
            }
          }

          const addedQty = (parseFloat(item.quantity) || 1) * unitMultiplier;
          const updateData = {
            stockQuantity: { increment: addedQty }
          };
          if (item.unitCost && parseFloat(item.unitCost) > 0) {
            // Store the per-base-piece cost
            updateData.costPrice = parseFloat(item.unitCost) / unitMultiplier;
          }
          if (item.retailPrice && parseFloat(item.retailPrice) > 0) {
            updateData.retailPrice = parseFloat(item.retailPrice);
          }
          await tx.product.update({
            where: { id: item.productId },
            data: updateData
          });
        }
      }

      // 2. Increment supplier payable balance by unpaid amount
      if (balance > 0) {
        await tx.supplier.update({
          where: { id: supplierId },
          data: { payableBalance: { increment: balance } }
        });
      }

      // 3. Create purchase invoice
      const invoice = await tx.purchaseInvoice.create({
        data: {
          invoiceNo,
          supplierId,
          totalAmount,
          paidAmount: parsedPaid,
          balance,
          paymentStatus,
          paymentMethod,
          description: description?.trim() || null,
          purchaseDate: purchaseDate ? new Date(purchaseDate) : new Date(),
          receivedBy: req.user?.name || 'Store Manager',
          items: {
            create: itemRecords
          }
        },
        include: { items: true, supplier: true }
      });

      return invoice;
    });

    return res.status(201).json({
      success: true,
      message: `Stock-In Invoice '${invoiceNo}' created and inventory updated.`,
      purchase: result
    });
  } catch (error) {
    console.error('createPurchaseInvoice error:', error);
    return res.status(500).json({ success: false, message: 'Failed to process purchase invoice.' });
  }
};

// -------------------------------------------------------------
// SUPPLIER PAYMENTS
// -------------------------------------------------------------

const recordSupplierPayment = async (req, res) => {
  try {
    const { supplierId, amount, paymentMethod, referenceNo, notes } = req.body;

    if (!supplierId || !amount || parseFloat(amount) <= 0) {
      return res.status(400).json({ success: false, message: 'Supplier and payment amount are required.' });
    }

    const payAmount = parseFloat(amount);
    const supplier = await prisma.supplier.findUnique({ where: { id: supplierId } });
    if (!supplier) {
      return res.status(404).json({ success: false, message: 'Supplier not found.' });
    }

    const [updatedSupplier, payment] = await prisma.$transaction([
      prisma.supplier.update({
        where: { id: supplierId },
        data: { payableBalance: { decrement: payAmount } }
      }),
      prisma.supplierPayment.create({
        data: {
          supplierId,
          amount: payAmount,
          paymentMethod: paymentMethod || 'CASH',
          referenceNo: referenceNo?.trim() || null,
          notes: notes?.trim() || null,
          paymentDate: new Date()
        }
      })
    ]);

    return res.status(201).json({
      success: true,
      message: `Payment of ${payAmount} recorded for ${supplier.companyName}.`,
      supplier: updatedSupplier,
      payment
    });
  } catch (error) {
    console.error('recordSupplierPayment error:', error);
    return res.status(500).json({ success: false, message: 'Failed to record supplier payment.' });
  }
};

module.exports = {
  getAllSuppliers,
  getSupplierById,
  createSupplier,
  updateSupplier,
  deleteSupplier,
  createPurchaseInvoice,
  recordSupplierPayment
};

