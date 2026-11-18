const prisma = require('../src/config/prisma');

const CORE_USER_EMAILS = [
  'admin@hospital.com',
  'accountant@hospital.com',
  'doctor@hospital.com',
  'staff@hospital.com',
  'frontdesk@gmail.com',
  'pharmacy@hospital.com',
  'lab@hospital.com',
  'nursery@hospital.com',
  'xray@hospital.com'
];

async function resetAllData() {
  console.log('🚀 Starting Clean Hospital System Data Reset...\n');

  try {
    // 1. Pharmacy Sales & Returns
    console.log('-> Clearing Pharmacy Sales, Items, Returns, and Payments...');
    const delReturnItems = await prisma.pharmacyReturnItem.deleteMany({});
    const delReturns = await prisma.pharmacyReturn.deleteMany({});
    const delCustPayments = await prisma.pharmacyCustomerPayment.deleteMany({});
    const delSaleItems = await prisma.pharmacySaleItem.deleteMany({});
    const delSales = await prisma.pharmacySale.deleteMany({});
    console.log(`   Cleared ${delSales.count} sales, ${delSaleItems.count} sale items, ${delReturns.count} returns, ${delCustPayments.count} customer payments.`);

    // 2. Expenses & Salary Disbursals
    console.log('-> Clearing Operating Expenses and Staff Salary Records...');
    const delExpenses = await prisma.expense.deleteMany({});
    const delSalaries = await prisma.salaryRecord.deleteMany({});
    console.log(`   Cleared ${delExpenses.count} expenses and ${delSalaries.count} salary records.`);

    // 3. Invoices & Billing
    console.log('-> Clearing Invoices...');
    const delInvoices = await prisma.invoice.deleteMany({});
    console.log(`   Cleared ${delInvoices.count} invoices.`);

    // 4. Nursery & NICU Admissions & Care Logs
    console.log('-> Clearing Nursery / NICU Admissions and Logs...');
    const delFeed = await prisma.nurseryFeedingLog.deleteMany({});
    const delCare = await prisma.nurseryCareNote.deleteMany({});
    const delVitals = await prisma.nurseryVitalLog.deleteMany({});
    const delNurseryAdmissions = await prisma.nurseryAdmission.deleteMany({});
    const resetIncubators = await prisma.nurseryIncubator.updateMany({
      data: { status: 'VACANT' }
    });
    console.log(`   Cleared ${delNurseryAdmissions.count} nursery admissions, ${delFeed.count} feed logs, ${delCare.count} care notes, ${delVitals.count} vitals logs.`);
    console.log(`   Reset ${resetIncubators.count} incubators to VACANT.`);

    // 5. IPD Admissions, Beds & Surgeries
    console.log('-> Clearing IPD Admissions, Surgeries, and Resetting Beds...');
    const delIpdAdmissions = await prisma.ipdAdmission.deleteMany({});
    const delSurgeries = await prisma.surgeryOrder.deleteMany({});
    const resetBeds = await prisma.ipdBed.updateMany({
      data: {
        isOccupied: false,
        patientId: null,
        admittedAt: null,
        status: 'AVAILABLE'
      }
    });
    console.log(`   Cleared ${delIpdAdmissions.count} IPD admissions, ${delSurgeries.count} surgery orders.`);
    console.log(`   Reset ${resetBeds.count} IPD beds to AVAILABLE.`);

    // 6. Diagnostic Orders (Lab, X-Ray, Medical Services) & Appointments
    console.log('-> Clearing Lab Orders, X-Ray Orders, Service Orders, and Appointments...');
    const delLabOrders = await prisma.labOrder.deleteMany({});
    const delXrayOrders = await prisma.xrayOrder.deleteMany({});
    const delServiceOrders = await prisma.medicalServiceOrder.deleteMany({});
    const delAppointments = await prisma.appointment.deleteMany({});
    console.log(`   Cleared ${delLabOrders.count} lab orders, ${delXrayOrders.count} X-ray orders, ${delServiceOrders.count} service orders, ${delAppointments.count} appointments.`);

    // 7. Patients Master Records
    console.log('-> Clearing All Patient Records...');
    const delPatients = await prisma.patient.deleteMany({});
    console.log(`   Cleared ${delPatients.count} patients.`);

    // 8. Non-Core Staff & Users
    console.log('-> Cleaning up non-core Staff and User Accounts...');
    // Find all users not in core list
    const nonCoreUsers = await prisma.user.findMany({
      where: {
        email: { notIn: CORE_USER_EMAILS }
      },
      select: { id: true, email: true }
    });
    const nonCoreUserIds = nonCoreUsers.map(u => u.id);

    // Delete non-core staff profiles
    const delStaff = await prisma.staff.deleteMany({
      where: {
        userId: { in: nonCoreUserIds }
      }
    });

    // Delete non-core doctors
    const delDoctors = await prisma.doctor.deleteMany({
      where: {
        userId: { in: nonCoreUserIds }
      }
    });

    // Delete non-core users
    const delUsers = await prisma.user.deleteMany({
      where: {
        id: { in: nonCoreUserIds }
      }
    });
    console.log(`   Removed ${delStaff.count} non-core staff, ${delDoctors.count} non-core doctors, and ${delUsers.count} non-core users.`);

    // Ensure core users are active
    await prisma.user.updateMany({
      where: {
        email: { in: CORE_USER_EMAILS }
      },
      data: { active: true }
    });

    console.log('\n✅ All data reset successfully to ZERO!');

    // Print final summary counts
    console.log('\n--- FINAL AUDIT COUNTS ---');
    const finalCounts = {
      patients: await prisma.patient.count(),
      appointments: await prisma.appointment.count(),
      ipdAdmissions: await prisma.ipdAdmission.count(),
      nurseryAdmissions: await prisma.nurseryAdmission.count(),
      surgeryOrders: await prisma.surgeryOrder.count(),
      labOrders: await prisma.labOrder.count(),
      xrayOrders: await prisma.xrayOrder.count(),
      pharmacySales: await prisma.pharmacySale.count(),
      expenses: await prisma.expense.count(),
      salaryRecords: await prisma.salaryRecord.count(),
      activeStaff: await prisma.staff.count(),
      systemUsers: await prisma.user.count(),
      preservedMedicinesCatalog: await prisma.pharmacyMedicine.count(),
      preservedLabTestsCatalog: await prisma.labTestItem.count()
    };
    console.log(JSON.stringify(finalCounts, null, 2));

  } catch (error) {
    console.error('❌ Data Reset Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

resetAllData();
