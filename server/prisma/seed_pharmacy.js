const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function seedPharmacy() {
  console.log('💊 Seeding Pharmacy Store Inventory with Barcodes & Suppliers...');

  // Create Suppliers
  const suppliersData = [
    { companyName: 'Getz Pharma Pakistan', contactPerson: 'Tariq Mehmood', phone: '+92 21 111 111 500', email: 'sales@getzpharma.com', address: 'Plot 29, Sector 27, Korangi Industrial Area, Karachi' },
    { companyName: 'Searle Company Limited', contactPerson: 'Asif Nadeem', phone: '+92 21 35061011', email: 'info@searlecompany.com', address: 'One IBL Centre, Block 7 & 8, D.M.C.H.S, Karachi' },
    { companyName: 'Abbott Laboratories Pakistan', contactPerson: 'Shahid Khan', phone: '+92 21 111 222 688', email: 'contact@abbott.pk', address: 'Opposite Radio Pakistan, Hyderabad Road, Landhi, Karachi' },
    { companyName: 'GSK Pakistan (GlaxoSmithKline)', contactPerson: 'Zubair Ahmed', phone: '+92 21 111 475 754', email: 'pk.customer-service@gsk.com', address: '35-Dockyard Road, West Wharf, Karachi' }
  ];

  for (const s of suppliersData) {
    await prisma.pharmacySupplier.upsert({
      where: { companyName: s.companyName },
      update: s,
      create: s
    });
  }

  // Create Initial Stock Inventory with Barcodes
  const medicinesData = [
    { barcode: '890123456701', name: 'Panadol Extra 500mg', genericName: 'Paracetamol + Caffeine', category: 'TABLETS', unitCost: 25.00, retailPrice: 35.00, stockQuantity: 250, minStockAlert: 30, batchNo: 'BATCH-PX901', manufacturer: 'GSK Pakistan' },
    { barcode: '890123456702', name: 'Augmentin 625mg', genericName: 'Co-Amoxiclav', category: 'TABLETS', unitCost: 180.00, retailPrice: 240.00, stockQuantity: 85, minStockAlert: 20, batchNo: 'BATCH-AG440', manufacturer: 'GSK Pakistan' },
    { barcode: '890123456703', name: 'Cefspan 400mg', genericName: 'Cefixime', category: 'CAPSULE', unitCost: 310.00, retailPrice: 420.00, stockQuantity: 40, minStockAlert: 15, batchNo: 'BATCH-CF771', manufacturer: 'Barrett Hodgson' },
    { barcode: '890123456704', name: 'Brufen 400mg', genericName: 'Ibuprofen', category: 'TABLETS', unitCost: 45.00, retailPrice: 65.00, stockQuantity: 180, minStockAlert: 25, batchNo: 'BATCH-BR201', manufacturer: 'Abbott Laboratories' },
    { barcode: '890123456705', name: 'Amoxil 500mg', genericName: 'Amoxicillin', category: 'CAPSULE', unitCost: 90.00, retailPrice: 130.00, stockQuantity: 120, minStockAlert: 20, batchNo: 'BATCH-AM102', manufacturer: 'GSK Pakistan' },
    { barcode: '890123456706', name: 'Flagyl 400mg', genericName: 'Metronidazole', category: 'TABLETS', unitCost: 35.00, retailPrice: 50.00, stockQuantity: 150, minStockAlert: 20, batchNo: 'BATCH-FL309', manufacturer: 'Sanofi Pakistan' },
    { barcode: '890123456707', name: 'Risek 20mg', genericName: 'Omeprazole', category: 'CAPSULE', unitCost: 140.00, retailPrice: 195.00, stockQuantity: 95, minStockAlert: 20, batchNo: 'BATCH-RK882', manufacturer: 'Getz Pharma' },
    { barcode: '890123456708', name: 'Sancos Cough Syrup 120ml', genericName: 'Pholcodine + Pseudoephedrine', category: 'SYRUP', unitCost: 110.00, retailPrice: 160.00, stockQuantity: 60, minStockAlert: 15, batchNo: 'BATCH-SN505', manufacturer: 'Searle Company' },
    { barcode: '890123456709', name: 'Gravinate 50mg', genericName: 'Dimenhydrinate', category: 'TABLETS', unitCost: 20.00, retailPrice: 30.00, stockQuantity: 140, minStockAlert: 25, batchNo: 'BATCH-GV110', manufacturer: 'Searle Company' },
    { barcode: '890123456710', name: 'Disprin 81mg', genericName: 'Aspirin', category: 'TABLETS', unitCost: 15.00, retailPrice: 25.00, stockQuantity: 12, minStockAlert: 30, batchNo: 'BATCH-DP004', manufacturer: 'Reckitt Benckiser' }
  ];

  for (const m of medicinesData) {
    const existing = await prisma.pharmacyMedicine.findFirst({ where: { name: m.name } });
    if (existing) {
      await prisma.pharmacyMedicine.update({
        where: { id: existing.id },
        data: { barcode: m.barcode }
      });
    } else {
      await prisma.pharmacyMedicine.create({ data: m });
    }
  }

  console.log('✅ Pharmacy Store Barcodes & Inventory Seeded Successfully!');
}

seedPharmacy()
  .catch(err => {
    console.error('❌ Pharmacy Seed Error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
