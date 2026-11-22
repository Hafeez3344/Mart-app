const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🛒 Seeding Super Mart Point of Sale Database...');

  // 1. Seed Store Settings
  const storeSetting = await prisma.storeSetting.upsert({
    where: { id: 'default-mart-setting' },
    update: {},
    create: {
      id: 'default-mart-setting',
      storeName: 'Al Masoom Supar Mart',
      tagline: 'Fresh Quality Products, Best Daily Prices',
      phone: '+92 300 1234567',
      email: 'info@almasoommart.pk',
      address: 'Main Commercial Boulevard, Phase 4, City Center',
      taxNumber: 'NTN-5829104-1',
      currencyCode: 'PKR',
      currencySymbol: 'Rs.',
      receiptHeader: 'Thank you for shopping at Al Masoom Supar Mart!',
      receiptFooter: 'Items can be exchanged within 7 days with valid receipt.',
      printerType: 'ESC_POS',
      paperWidth: 80,
      enableSound: true,
      enableCashDrawer: true
    }
  });
  console.log('✅ Store Settings created:', storeSetting.storeName);

  // 2. Seed Default Department
  const deptCheckout = await prisma.department.upsert({
    where: { code: 'POS_COUNTERS' },
    update: {},
    create: {
      name: 'Cash Counters & POS',
      code: 'POS_COUNTERS',
      description: 'Front-of-store cashier checkout stations'
    }
  });

  const deptInventory = await prisma.department.upsert({
    where: { code: 'WAREHOUSE' },
    update: {},
    create: {
      name: 'Inventory & Warehouse',
      code: 'WAREHOUSE',
      description: 'Stock management, receiving & shelves'
    }
  });

  // 3. Seed Users
  const passwordHash = await bcrypt.hash('admin123', 10);

  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@mart.com' },
    update: { password: passwordHash },
    create: {
      email: 'admin@mart.com',
      password: passwordHash,
      name: 'Super Admin',
      role: 'ADMIN',
      phone: '+92 300 1112233'
    }
  });

  const cashierUser = await prisma.user.upsert({
    where: { email: 'cashier@mart.com' },
    update: { password: passwordHash },
    create: {
      email: 'cashier@mart.com',
      password: passwordHash,
      name: 'Ali Raza (Cashier 1)',
      role: 'CASHIER',
      phone: '+92 321 4445566'
    }
  });

  const managerUser = await prisma.user.upsert({
    where: { email: 'manager@mart.com' },
    update: { password: passwordHash },
    create: {
      email: 'manager@mart.com',
      password: passwordHash,
      name: 'Tariq Mehmood (Store Manager)',
      role: 'MANAGER',
      phone: '+92 333 7778899'
    }
  });

  // Seed Staff Profiles
  await prisma.staff.upsert({
    where: { employeeId: 'EMP-ADM-001' },
    update: {},
    create: {
      userId: adminUser.id,
      employeeId: 'EMP-ADM-001',
      firstName: 'Super',
      lastName: 'Admin',
      email: 'admin@mart.com',
      phone: '+92 300 1112233',
      designation: 'General Manager & Administrator',
      departmentId: deptInventory.id,
      baseSalary: 120000
    }
  });

  await prisma.staff.upsert({
    where: { employeeId: 'EMP-CSH-001' },
    update: {},
    create: {
      userId: cashierUser.id,
      employeeId: 'EMP-CSH-001',
      firstName: 'Ali',
      lastName: 'Raza',
      email: 'cashier@mart.com',
      phone: '+92 321 4445566',
      designation: 'Head Cashier',
      departmentId: deptCheckout.id,
      baseSalary: 35000
    }
  });

  console.log('✅ Staff & Users seeded (admin@mart.com, cashier@mart.com, password: admin123)');

  // 4. Seed Product Categories
  const categoriesData = [
    { name: 'BEVERAGES', description: 'Soft drinks, juices, mineral water, tea & coffee', color: '#3b82f6' },
    { name: 'SNACKS & CONFECTIONERY', description: 'Chips, biscuits, chocolates, candies, nuts', color: '#f59e0b' },
    { name: 'DAIRY & EGGS', description: 'Milk, cheese, butter, yogurt, fresh eggs', color: '#06b6d4' },
    { name: 'BAKERY & BREAD', description: 'Fresh bread, buns, cakes, rusks', color: '#eab308' },
    { name: 'GROCERY & STAPLES', description: 'Flour, rice, cooking oil, pulses, sugar, spices', color: '#10b981' },
    { name: 'PERSONAL CARE', description: 'Soaps, shampoos, toothpaste, skin care', color: '#ec4899' },
    { name: 'HOUSEHOLD & CLEANING', description: 'Detergents, cleaners, dishwashers', color: '#14b8a6' },
    { name: 'FROZEN FOODS', description: 'Ice cream, frozen meats, nuggets, parathas', color: '#6366f1' },
    { name: 'FRUITS & VEGETABLES', description: 'Fresh seasonal farm produce', color: '#84cc16' }
  ];

  for (const cat of categoriesData) {
    await prisma.productCategory.upsert({
      where: { name: cat.name },
      update: {},
      create: cat
    });
  }
  console.log('✅ Retail Product Categories seeded');

  // 5. Seed Suppliers
  const supplierNestle = await prisma.supplier.upsert({
    where: { companyName: 'Nestle Pakistan Ltd.' },
    update: {},
    create: {
      companyName: 'Nestle Pakistan Ltd.',
      contactPerson: 'Khurram Shehzad',
      phone: '+92 42 111 637 853',
      email: 'orders@nestle.com.pk',
      address: '308 Upper Mall, Lahore',
      payableBalance: 45000
    }
  });

  const supplierUnilever = await prisma.supplier.upsert({
    where: { companyName: 'Unilever Pakistan' },
    update: {},
    create: {
      companyName: 'Unilever Pakistan',
      contactPerson: 'Farhan Qureshi',
      phone: '+92 21 111 864 538',
      email: 'distributors@unilever.com.pk',
      address: 'Avari Plaza, Fatima Jinnah Road, Karachi',
      payableBalance: 78000
    }
  });

  const supplierPepsi = await prisma.supplier.upsert({
    where: { companyName: 'PepsiCo Beverages' },
    update: {},
    create: {
      companyName: 'PepsiCo Beverages',
      contactPerson: 'Zubair Butt',
      phone: '+92 42 357 512 34',
      email: 'sales@pepsico.com.pk',
      address: 'Industrial Area, Kot Lakhpat, Lahore',
      payableBalance: 22000
    }
  });

  console.log('✅ Suppliers seeded');

  // 6. Seed Customers
  await prisma.customer.upsert({
    where: { phone: '03001234567' },
    update: {},
    create: {
      name: 'Muhammad Imran Khan',
      phone: '03001234567',
      email: 'imran.k@gmail.com',
      address: 'House 42, Street 15, Sector F-8/2',
      creditLimit: 50000,
      currentBalance: 3450,
      loyaltyPoints: 120
    }
  });

  await prisma.customer.upsert({
    where: { phone: '03219876543' },
    update: {},
    create: {
      name: 'Dr. Ayesha Siddiqa',
      phone: '03219876543',
      email: 'ayesha.sid@yahoo.com',
      address: 'Apartment 304, Green Heights',
      creditLimit: 30000,
      currentBalance: 0,
      loyaltyPoints: 450
    }
  });

  console.log('✅ Customers seeded');

  // 7. Seed Sample Mart Products
  const products = [
    {
      name: 'Coca-Cola 1.5 Litre Bottle',
      barcode: '890123400001',
      sku: 'BEV-COKE-15L',
      category: 'BEVERAGES',
      brand: 'Coca-Cola',
      costPrice: 155,
      retailPrice: 190,
      stockQuantity: 120,
      minStockAlert: 24,
      unit: 'Bottle',
      supplierId: supplierPepsi.id
    },
    {
      name: 'Sprite 1.5 Litre Bottle',
      barcode: '890123400002',
      sku: 'BEV-SPRITE-15L',
      category: 'BEVERAGES',
      brand: 'Coca-Cola',
      costPrice: 155,
      retailPrice: 190,
      stockQuantity: 95,
      minStockAlert: 20,
      unit: 'Bottle',
      supplierId: supplierPepsi.id
    },
    {
      name: 'Nestle Pure Life Water 1.5L',
      barcode: '890123400003',
      sku: 'BEV-WATER-15L',
      category: 'BEVERAGES',
      brand: 'Nestle',
      costPrice: 85,
      retailPrice: 110,
      stockQuantity: 240,
      minStockAlert: 48,
      unit: 'Bottle',
      supplierId: supplierNestle.id
    },
    {
      name: 'Olpers Full Cream Milk 1 Litre',
      barcode: '890123400004',
      sku: 'DAI-OLPERS-1L',
      category: 'DAIRY & EGGS',
      brand: 'Olpers',
      costPrice: 280,
      retailPrice: 320,
      stockQuantity: 80,
      minStockAlert: 20,
      unit: 'Pack'
    },
    {
      name: 'Lays French Cheese Family Pack 65g',
      barcode: '890123400005',
      sku: 'SNK-LAYS-FC65',
      category: 'SNACKS & CONFECTIONERY',
      brand: 'Lays',
      costPrice: 85,
      retailPrice: 100,
      stockQuantity: 150,
      minStockAlert: 30,
      unit: 'Pack',
      supplierId: supplierPepsi.id
    },
    {
      name: 'Lays Masala Family Pack 65g',
      barcode: '890123400006',
      sku: 'SNK-LAYS-MAS65',
      category: 'SNACKS & CONFECTIONERY',
      brand: 'Lays',
      costPrice: 85,
      retailPrice: 100,
      stockQuantity: 160,
      minStockAlert: 30,
      unit: 'Pack',
      supplierId: supplierPepsi.id
    },
    {
      name: 'Dawn Plain Bread Large 850g',
      barcode: '890123400007',
      sku: 'BAK-DAWN-BRDL',
      category: 'BAKERY & BREAD',
      brand: 'Dawn',
      costPrice: 170,
      retailPrice: 200,
      stockQuantity: 35,
      minStockAlert: 10,
      unit: 'Pcs'
    },
    {
      name: 'Tapal Danedar Tea Pouch 450g',
      barcode: '890123400008',
      sku: 'GRO-TAPAL-450G',
      category: 'GROCERY & STAPLES',
      brand: 'Tapal',
      costPrice: 690,
      retailPrice: 770,
      stockQuantity: 65,
      minStockAlert: 15,
      unit: 'Pack'
    },
    {
      name: 'Dalda Cooking Oil 1 Litre Pouch',
      barcode: '890123400009',
      sku: 'GRO-DALDA-1L',
      category: 'GROCERY & STAPLES',
      brand: 'Dalda',
      costPrice: 485,
      retailPrice: 530,
      stockQuantity: 70,
      minStockAlert: 15,
      unit: 'Pouch'
    },
    {
      name: 'Surf Excel Quick Wash Powder 1kg',
      barcode: '890123400010',
      sku: 'HOU-SURF-1KG',
      category: 'HOUSEHOLD & CLEANING',
      brand: 'Surf Excel',
      costPrice: 620,
      retailPrice: 710,
      stockQuantity: 50,
      minStockAlert: 10,
      unit: 'Pack',
      supplierId: supplierUnilever.id
    },
    {
      name: 'Lifebuoy Total 10 Soap Bar 135g',
      barcode: '890123400011',
      sku: 'PER-LIFE-135G',
      category: 'PERSONAL CARE',
      brand: 'Lifebuoy',
      costPrice: 125,
      retailPrice: 150,
      stockQuantity: 180,
      minStockAlert: 25,
      unit: 'Pcs',
      supplierId: supplierUnilever.id
    },
    {
      name: 'Farm Fresh Brown Eggs (Pack of 12)',
      barcode: '890123400012',
      sku: 'DAI-EGGS-12PK',
      category: 'DAIRY & EGGS',
      brand: 'Farm Fresh',
      costPrice: 310,
      retailPrice: 360,
      stockQuantity: 45,
      minStockAlert: 12,
      unit: 'Box'
    },
    {
      name: 'Fresh Red Apples (Kala Kulu)',
      barcode: '890123400013',
      sku: 'FRU-APPLE-KG',
      category: 'FRUITS & VEGETABLES',
      brand: 'Local Farm',
      costPrice: 220,
      retailPrice: 280,
      stockQuantity: 60.5,
      minStockAlert: 10,
      unit: 'Kg',
      allowFractional: true
    },
    {
      name: 'Fresh Farm Potatoes (Aloo)',
      barcode: '890123400014',
      sku: 'VEG-POTATO-KG',
      category: 'FRUITS & VEGETABLES',
      brand: 'Local Farm',
      costPrice: 65,
      retailPrice: 90,
      stockQuantity: 140.0,
      minStockAlert: 20,
      unit: 'Kg',
      allowFractional: true
    },
    {
      name: 'K&Ns Chicken Tempura Nuggets 720g',
      barcode: '890123400015',
      sku: 'FRO-KNS-NUG720',
      category: 'FROZEN FOODS',
      brand: 'K&Ns',
      costPrice: 1250,
      retailPrice: 1450,
      stockQuantity: 28,
      minStockAlert: 8,
      unit: 'Box'
    }
  ];

  for (const p of products) {
    await prisma.product.upsert({
      where: { barcode: p.barcode },
      update: {},
      create: p
    });
  }
  console.log(`✅ ${products.length} sample retail mart products seeded!`);

  // 8. Seed Retail Brands
  const brands = [
    { name: 'Nestle', description: 'Packaged foods, juices & dairy' },
    { name: 'Unilever', description: 'Personal care & home supplies' },
    { name: 'PepsiCo', description: 'Beverages, snacks & chips' },
    { name: 'Coca-Cola', description: 'Carbonated drinks & mineral water' },
    { name: 'National Foods', description: 'Spices, recipe mixes & pickles' },
    { name: 'Shan Foods', description: 'Traditional recipe mixes & pastes' },
    { name: 'Olpers', description: 'Pure milk, cream & dairy' },
    { name: 'Lipton', description: 'Black tea & green tea' }
  ];

  for (const b of brands) {
    await prisma.brand.upsert({
      where: { name: b.name },
      update: {},
      create: b
    });
  }
  console.log(`✅ ${brands.length} retail brands seeded!`);

  // 9. Seed Units of Measurement & Conversions
  const units = [
    { name: 'Piece', shortCode: 'pcs', allowDecimal: false },
    { name: 'Kilogram', shortCode: 'kg', allowDecimal: true },
    { name: 'Gram', shortCode: 'g', allowDecimal: true },
    { name: 'Liter', shortCode: 'l', allowDecimal: true },
    { name: 'Milliliter', shortCode: 'ml', allowDecimal: true },
    { name: 'Pack', shortCode: 'pk', allowDecimal: false },
    { name: 'Box', shortCode: 'bx', allowDecimal: false },
    { name: 'Carton', shortCode: 'ctn', allowDecimal: false },
    { name: 'Dozen', shortCode: 'dz', allowDecimal: false }
  ];

  for (const u of units) {
    await prisma.unit.upsert({
      where: { shortCode: u.shortCode },
      update: {},
      create: u
    });
  }
  console.log(`✅ ${units.length} measurement units seeded!`);

  console.log('🎉 Mart Point of Sale database seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
