const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const salaryDups = await prisma.$queryRawUnsafe(`
    SELECT "staffId", month, year, COUNT(*) as cnt
    FROM salary_records
    GROUP BY "staffId", month, year
    HAVING COUNT(*) > 1
  `);
  console.log('Duplicate salary records count:', salaryDups.length);

  const bedDups = await prisma.$queryRawUnsafe(`
    SELECT "bedNo", COUNT(*) as cnt
    FROM ipd_beds
    GROUP BY "bedNo"
    HAVING COUNT(*) > 1
  `);
  console.log('Duplicate beds count:', bedDups.length);

  const mrnDups = await prisma.$queryRawUnsafe(`
    SELECT mrn, COUNT(*) as cnt
    FROM patients
    GROUP BY mrn
    HAVING COUNT(*) > 1
  `);
  console.log('Duplicate MRN count:', mrnDups.length);

  await prisma.$disconnect();
}

check().catch(console.error);
