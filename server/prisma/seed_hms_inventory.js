const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function seedHmsInventory() {
  console.log('Seeding HMS Stock Inventory & Suppliers...');

  const count = await prisma.hmsInventoryItem.count();
  if (count > 0) {
    console.log(`HMS Inventory already contains ${count} items. Skipping initial seed.`);
    return;
  }

  // Categories
  const categoriesData = [
    { name: 'Surgical Disposables', description: 'Sterile scalpel blades, gloves, suture materials, drapes' },
    { name: 'General Medical Supplies', description: 'Cannulas, syringes, IV infusion sets, bandages, gauze' },
    { name: 'PPE & Sanitization', description: 'Masks, gowns, aprons, surface disinfectants, hand rubs' },
    { name: 'Linen & Bedding', description: 'Patient bed sheets, pillow covers, blankets, OT towels' },
    { name: 'Diagnostic Consumables', description: 'Blood collection tubes, urine containers, test strips' }
  ];

  const catMap = {};
  for (const cat of categoriesData) {
    const created = await prisma.hmsInventoryCategory.upsert({
      where: { name: cat.name },
      update: {},
      create: cat
    });
    catMap[cat.name] = created.id;
  }

  // Inventory Items
  const itemsData = [
    { itemCode: 'HMS-INV-1001', name: 'Surgical Latex Gloves (Size 7.5)', categoryName: 'Surgical Disposables', unit: 'BOX', unitCost: 850, currentStock: 65, minStockAlert: 15, location: 'Central Store - Shelf A1', department: 'OT / Surgery' },
    { itemCode: 'HMS-INV-1002', name: 'IV Cannula 20G (Pink)', categoryName: 'General Medical Supplies', unit: 'BOX', unitCost: 1200, currentStock: 40, minStockAlert: 10, location: 'Emergency Ward Store', department: 'Emergency' },
    { itemCode: 'HMS-INV-1003', name: 'Disposable Syringes 5ml with Needle', categoryName: 'General Medical Supplies', unit: 'BOX', unitCost: 650, currentStock: 90, minStockAlert: 20, location: 'Central Store - Shelf A2', department: 'General Hospital' },
    { itemCode: 'HMS-INV-1004', name: 'Cotton Crepe Bandage 10cm x 4m', categoryName: 'General Medical Supplies', unit: 'PACK', unitCost: 320, currentStock: 55, minStockAlert: 15, location: 'OPD Dressing Room', department: 'OPD' },
    { itemCode: 'HMS-INV-1005', name: 'Hospital Patient Bed Sheets (White Cotton)', categoryName: 'Linen & Bedding', unit: 'PCS', unitCost: 1450, currentStock: 120, minStockAlert: 25, location: 'Linen Central Depot', department: 'Inpatient Wards' },
    { itemCode: 'HMS-INV-1006', name: 'Sterile Surgical Gowns (Waterproof)', categoryName: 'PPE & Sanitization', unit: 'PCS', unitCost: 450, currentStock: 8, minStockAlert: 10, location: 'OT Sterile Storage', department: 'OT' },
    { itemCode: 'HMS-INV-1007', name: 'N95 Medical Protective Masks', categoryName: 'PPE & Sanitization', unit: 'BOX', unitCost: 950, currentStock: 25, minStockAlert: 10, location: 'Central Store - Shelf B2', department: 'General Hospital' },
    { itemCode: 'HMS-INV-1008', name: 'Hand Sanitizer Gel 500ml Dispenser', categoryName: 'PPE & Sanitization', unit: 'BOTTLE', unitCost: 280, currentStock: 35, minStockAlert: 10, location: 'Sanitation Store', department: 'Housekeeping' },
    { itemCode: 'HMS-INV-1009', name: 'Vacuum Blood Collection Tubes (EDTA K3)', categoryName: 'Diagnostic Consumables', unit: 'PACK', unitCost: 1100, currentStock: 50, minStockAlert: 15, location: 'Pathology Storage', department: 'Laboratory' },
    { itemCode: 'HMS-INV-1010', name: 'Surgical Scalpel Blades #15 Sterile', categoryName: 'Surgical Disposables', unit: 'BOX', unitCost: 400, currentStock: 0, minStockAlert: 5, location: 'OT Sterile Storage', department: 'OT' }
  ];

  const itemMap = {};
  for (const itm of itemsData) {
    const createdItem = await prisma.hmsInventoryItem.create({
      data: {
        ...itm,
        categoryId: catMap[itm.categoryName] || null
      }
    });
    itemMap[itm.name] = createdItem.id;
  }

  // Suppliers
  const sup1 = await prisma.hmsSupplier.create({
    data: {
      supplierCode: 'SUP-HMS-001',
      companyName: 'MediEquip Surgical Supplies Ltd',
      contactPerson: 'Engr. Tariq Mehmood',
      phone: '+92 321 4455667',
      email: 'tariq@mediequip.pk',
      address: 'Plot 14-B, Industrial Area, Lahore',
      payableBalance: 58500,
      totalBilled: 78500,
      totalPaid: 20000
    }
  });

  const sup2 = await prisma.hmsSupplier.create({
    data: {
      supplierCode: 'SUP-HMS-002',
      companyName: 'Al-Shifa Healthcare Linens & Disposables',
      contactPerson: 'Haji Muhammad Aslam',
      phone: '+92 300 8877665',
      email: 'aslam@alshifalinens.com',
      address: 'Suit 4, Market Plaza, Faisalabad',
      payableBalance: 0,
      totalBilled: 145000,
      totalPaid: 145000
    }
  });

  const sup3 = await prisma.hmsSupplier.create({
    data: {
      supplierCode: 'SUP-HMS-003',
      companyName: 'BioHealth Diagnostic Reagents & PPE Co.',
      contactPerson: 'Dr. Salman Farooq',
      phone: '+92 333 5511223',
      email: 'info@biohealthreagents.pk',
      address: 'Sector I-9, Industrial Zone, Islamabad',
      payableBalance: 24000,
      totalBilled: 24000,
      totalPaid: 0
    }
  });

  // Bills for MediEquip (Demonstrating FIFO state)
  const d1 = new Date();
  d1.setDate(d1.getDate() - 10);
  const bill1 = await prisma.hmsSupplierBill.create({
    data: {
      billNo: 'BILL-HMS-2026-001',
      supplierId: sup1.id,
      billDate: d1,
      totalAmount: 42500,
      paidAmount: 20000,
      balance: 22500,
      paymentStatus: 'PARTIAL',
      notes: 'Initial consignment of Surgical Gloves and Blades',
      items: {
        create: [
          { itemName: 'Surgical Latex Gloves (Size 7.5)', quantity: 50, unitCost: 850, totalPrice: 42500, itemId: itemMap['Surgical Latex Gloves (Size 7.5)'] }
        ]
      }
    }
  });

  // Initial payment for bill 1
  const pay1 = await prisma.hmsSupplierPayment.create({
    data: {
      paymentNo: 'PAY-HMS-2026-001',
      supplierId: sup1.id,
      amount: 20000,
      paymentDate: d1,
      paymentMethod: 'CHEQUE',
      referenceNo: 'CHQ-778899',
      notes: 'Advance cheque paid upon delivery for BILL-HMS-2026-001'
    }
  });
  await prisma.hmsSupplierPaymentAllocation.create({
    data: {
      paymentId: pay1.id,
      billId: bill1.id,
      allocatedAmount: 20000
    }
  });

  const d2 = new Date();
  d2.setDate(d2.getDate() - 3);
  await prisma.hmsSupplierBill.create({
    data: {
      billNo: 'BILL-HMS-2026-002',
      supplierId: sup1.id,
      billDate: d2,
      totalAmount: 36000,
      paidAmount: 0,
      balance: 36000,
      paymentStatus: 'PENDING',
      notes: 'Emergency IV Cannula Pink boxes restocking',
      items: {
        create: [
          { itemName: 'IV Cannula 20G (Pink)', quantity: 30, unitCost: 1200, totalPrice: 36000, itemId: itemMap['IV Cannula 20G (Pink)'] }
        ]
      }
    }
  });

  // Bill for Al-Shifa (Fully Paid)
  const d3 = new Date();
  d3.setDate(d3.getDate() - 5);
  const bill3 = await prisma.hmsSupplierBill.create({
    data: {
      billNo: 'BILL-HMS-2026-003',
      supplierId: sup2.id,
      billDate: d3,
      totalAmount: 145000,
      paidAmount: 145000,
      balance: 0,
      paymentStatus: 'PAID',
      notes: 'Bulk order of 100 Hospital Bed Sheets',
      items: {
        create: [
          { itemName: 'Hospital Patient Bed Sheets (White Cotton)', quantity: 100, unitCost: 1450, totalPrice: 145000, itemId: itemMap['Hospital Patient Bed Sheets (White Cotton)'] }
        ]
      }
    }
  });

  const pay2 = await prisma.hmsSupplierPayment.create({
    data: {
      paymentNo: 'PAY-HMS-2026-002',
      supplierId: sup2.id,
      amount: 145000,
      paymentDate: d3,
      paymentMethod: 'BANK_TRANSFER',
      referenceNo: 'TXN-HBL-990022',
      notes: 'Full online payment cleared'
    }
  });
  await prisma.hmsSupplierPaymentAllocation.create({
    data: {
      paymentId: pay2.id,
      billId: bill3.id,
      allocatedAmount: 145000
    }
  });

  // Bill for BioHealth (Pending, created today)
  await prisma.hmsSupplierBill.create({
    data: {
      billNo: 'BILL-HMS-2026-004',
      supplierId: sup3.id,
      billDate: new Date(),
      totalAmount: 24000,
      paidAmount: 0,
      balance: 24000,
      paymentStatus: 'PENDING',
      notes: 'Monthly N95 Masks and Sanitizers supply',
      items: {
        create: [
          { itemName: 'N95 Medical Protective Masks', quantity: 20, unitCost: 950, totalPrice: 19000, itemId: itemMap['N95 Medical Protective Masks'] },
          { itemName: 'Hand Sanitizer Gel 500ml Dispenser', quantity: 18, unitCost: 280, totalPrice: 5040, itemId: itemMap['Hand Sanitizer Gel 500ml Dispenser'] }
        ]
      }
    }
  });

  console.log('HMS Stock Inventory & Suppliers seeded successfully!');
}

seedHmsInventory()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
