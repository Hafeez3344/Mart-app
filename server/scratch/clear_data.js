const prisma = require('../src/config/prisma');

async function main() {
  console.log('=== STARTING DATA CLEANUP ===');

  const beforeCounts = {
    patients: await prisma.patient.count(),
    appointments: await prisma.appointment.count(),
    invoices: await prisma.invoice.count(),
    ipdAdmissions: await prisma.ipdAdmission.count(),
    xrayOrders: await prisma.xrayOrder.count(),
    labOrders: await prisma.labOrder.count(),
    surgeryOrders: await prisma.surgeryOrder.count(),
    medicalServiceOrders: await prisma.medicalServiceOrder.count(),
    nurseryAdmissions: await prisma.nurseryAdmission.count(),
    pharmacySales: await prisma.pharmacySale.count(),
    pharmacySaleItems: await prisma.pharmacySaleItem.count(),
    pharmacyReturns: await prisma.pharmacyReturn.count(),
    pharmacyReturnItems: await prisma.pharmacyReturnItem.count(),
    pharmacyCustomerPayments: await prisma.pharmacyCustomerPayment.count(),
    // Profiles to preserve:
    users: await prisma.user.count(),
    staff: await prisma.staff.count(),
    doctors: await prisma.doctor.count(),
    departments: await prisma.department.count(),
    medicines: await prisma.pharmacyMedicine.count(),
    labTestCatalog: await prisma.labTestItem.count()
  };

  console.log('--- Before Cleanup ---');
  console.log(JSON.stringify(beforeCounts, null, 2));

  // Perform clean atomic cleanup
  await prisma.$transaction(async (tx) => {
    // 1. Clear Pharmacy Sales & Returns & Customer Payments
    console.log('Clearing pharmacy sales, returns and payments...');
    await tx.pharmacyReturnItem.deleteMany({});
    await tx.pharmacyReturn.deleteMany({});
    await tx.pharmacyCustomerPayment.deleteMany({});
    await tx.pharmacySaleItem.deleteMany({});
    await tx.pharmacySale.deleteMany({});

    // 2. Free all IPD Beds
    console.log('Resetting IPD beds to free / unoccupied...');
    await tx.ipdBed.updateMany({
      data: {
        isOccupied: false,
        status: 'AVAILABLE',
        admittedAt: null
      }
    });

    // 3. Clear Nursery encounters
    console.log('Clearing nursery encounters...');
    await tx.nurseryFeedingLog.deleteMany({});
    await tx.nurseryCareNote.deleteMany({});
    await tx.nurseryVitalLog.deleteMany({});
    await tx.nurseryAdmission.deleteMany({});

    // 4. Clear Clinical Orders & Encounters
    console.log('Clearing appointments, surgeries, lab orders, xray orders, service orders...');
    await tx.appointment.deleteMany({});
    await tx.surgeryOrder.deleteMany({});
    await tx.medicalServiceOrder.deleteMany({});
    await tx.xrayOrder.deleteMany({});
    await tx.labOrder.deleteMany({});
    await tx.ipdAdmission.deleteMany({});
    await tx.invoice.deleteMany({});

    // 5. Clear Patients
    console.log('Clearing all patients...');
    await tx.patient.deleteMany({});
  });

  const afterCounts = {
    patients: await prisma.patient.count(),
    appointments: await prisma.appointment.count(),
    invoices: await prisma.invoice.count(),
    ipdAdmissions: await prisma.ipdAdmission.count(),
    xrayOrders: await prisma.xrayOrder.count(),
    labOrders: await prisma.labOrder.count(),
    surgeryOrders: await prisma.surgeryOrder.count(),
    medicalServiceOrders: await prisma.medicalServiceOrder.count(),
    nurseryAdmissions: await prisma.nurseryAdmission.count(),
    pharmacySales: await prisma.pharmacySale.count(),
    pharmacySaleItems: await prisma.pharmacySaleItem.count(),
    pharmacyReturns: await prisma.pharmacyReturn.count(),
    pharmacyCustomerPayments: await prisma.pharmacyCustomerPayment.count(),
    // Preserved:
    users: await prisma.user.count(),
    staff: await prisma.staff.count(),
    doctors: await prisma.doctor.count(),
    departments: await prisma.department.count(),
    medicines: await prisma.pharmacyMedicine.count(),
    labTestCatalog: await prisma.labTestItem.count()
  };

  console.log('--- After Cleanup ---');
  console.log(JSON.stringify(afterCounts, null, 2));

  console.log('=== DATA CLEANUP COMPLETED SUCCESSFULLY ===');
}

main()
  .catch((e) => {
    console.error('Cleanup failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
