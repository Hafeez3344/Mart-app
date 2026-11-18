const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Fetching all incubators and admissions...');
  const incubators = await prisma.nurseryIncubator.findMany({
    include: { admissions: true },
  });

  for (const inc of incubators) {
    console.log(`Incubator: ${inc.id} (${inc.code}) - Status: ${inc.status} - Admissions: ${inc.admissions.length}`);
  }

  // Delete admissions for INC-101 and INC-102
  const targetCodes = ['INC-101', 'INC-102', 'BED 01', 'BED 02'];
  const incsToClean = await prisma.nurseryIncubator.findMany({
    where: {
      OR: [
        { id: { in: ['INC-101', 'INC-102'] } },
        { code: { in: ['INC-101', 'INC-102', 'BED 01', 'BED 02'] } }
      ]
    },
    include: { admissions: true }
  });

  for (const inc of incsToClean) {
    console.log(`Cleaning admissions for ${inc.id} (${inc.code})...`);
    await prisma.nurseryAdmission.deleteMany({
      where: {
        OR: [
          { incubatorId: inc.id },
          { incubatorCode: inc.code },
          { incubatorCode: inc.id }
        ]
      }
    });

    await prisma.nurseryIncubator.update({
      where: { id: inc.id },
      data: { status: 'VACANT' }
    });
    console.log(`Set ${inc.id} to VACANT and deleted its admissions.`);
  }

  // Also check if there are orphan admissions matching INC-101 or INC-102 code directly
  const orphanDeleted = await prisma.nurseryAdmission.deleteMany({
    where: {
      incubatorCode: { in: ['INC-101', 'INC-102', 'BED 01', 'BED 02'] }
    }
  });
  console.log(`Deleted orphan admissions: ${orphanDeleted.count}`);

  const remainingAdmissions = await prisma.nurseryAdmission.findMany({
    include: { incubator: true }
  });
  console.log(`Remaining admissions in DB (${remainingAdmissions.length}):`);
  for (const a of remainingAdmissions) {
    console.log(`- ${a.admissionNo}: ${a.babyName} in ${a.incubatorCode || a.incubatorId} (Status: ${a.status})`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
