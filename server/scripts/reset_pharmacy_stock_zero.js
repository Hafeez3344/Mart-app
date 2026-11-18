const prisma = require('../src/config/prisma');

async function resetStockToZero() {
  console.log('🔄 Setting all pharmacy medicine stock quantities to 0...');

  try {
    const totalBefore = await prisma.pharmacyMedicine.count();
    const result = await prisma.pharmacyMedicine.updateMany({
      data: {
        stockQuantity: 0
      }
    });

    console.log(`✅ Successfully reset stock to 0 across all ${result.count} medicine items (out of ${totalBefore} total in catalog).`);

    // Verify sample
    const sample = await prisma.pharmacyMedicine.findMany({
      take: 5,
      select: {
        id: true,
        name: true,
        category: true,
        stockQuantity: true
      }
    });

    console.log('\nSample items verified:');
    console.log(JSON.stringify(sample, null, 2));

  } catch (error) {
    console.error('❌ Failed to reset stock quantities:', error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

resetStockToZero();
