/**
 * Targeted Cleanup:
 * Clears all Patients, Admissions (IPD, Nursery, Gynecology), Clinical Orders (Lab, X-Ray, Services, Surgeries),
 * Pharmacy Sales/Returns/Customer Payments, and Suppliers (Pharmacy & HMS).
 * PRESERVES ALL PHARMACY MEDICINES / PRODUCTS / ITEMS, CATEGORIES, AND PACKAGING UNITS.
 */

const prisma = require('../src/config/prisma');

async function cleanPatientsAndSuppliers() {
  console.log('========================================================');
  console.log('🚀 PURGING PATIENTS, ADMISSIONS, ORDERS & SUPPLIERS');
  console.log('   (PRESERVING ALL PHARMACY PRODUCTS/ITEMS IN INVENTORY)');
  console.log('========================================================\n');

  try {
    const summary = {};

    // 1. Pharmacy Sales & Returns (Customer Transactions)
    console.log('1️⃣  Purging Pharmacy Customer Sales & Returns...');
    const delReturnItems = await prisma.pharmacyReturnItem.deleteMany({});
    const delReturns = await prisma.pharmacyReturn.deleteMany({});
    const delCustPayments = await prisma.pharmacyCustomerPayment.deleteMany({});
    const delSaleItems = await prisma.pharmacySaleItem.deleteMany({});
    const delSales = await prisma.pharmacySale.deleteMany({});

    summary.pharmacyReturns = delReturns.count;
    summary.pharmacyReturnItems = delReturnItems.count;
    summary.pharmacyCustomerPayments = delCustPayments.count;
    summary.pharmacySaleItems = delSaleItems.count;
    summary.pharmacySales = delSales.count;

    // 2. Pharmacy & HMS Suppliers
    console.log('2️⃣  Removing Suppliers & Supplier Purchase Ledgers...');
    const delSuppPayments = await prisma.pharmacySupplierPayment.deleteMany({});
    const delSuppLedgerItems = await prisma.pharmacySupplierLedgerItem.deleteMany({});
    const delSuppLedgers = await prisma.pharmacySupplierLedger.deleteMany({});
    const delSuppliers = await prisma.pharmacySupplier.deleteMany({});

    // HMS Suppliers if any
    const delHmsAlloc = await prisma.hmsSupplierPaymentAllocation.deleteMany({});
    const delHmsPay = await prisma.hmsSupplierPayment.deleteMany({});
    const delHmsBillItems = await prisma.hmsSupplierBillItem.deleteMany({});
    const delHmsBills = await prisma.hmsSupplierBill.deleteMany({});
    const delHmsSupp = await prisma.hmsSupplier.deleteMany({});

    summary.pharmacySuppliersDeleted = delSuppliers.count;
    summary.pharmacySupplierLedgers = delSuppLedgers.count;
    summary.pharmacySupplierLedgerItems = delSuppLedgerItems.count;
    summary.pharmacySupplierPayments = delSuppPayments.count;
    summary.hmsSuppliersDeleted = delHmsSupp.count;

    // 3. Clinical Diagnostic & Service Orders
    console.log('3️⃣  Purging Lab, X-Ray & Medical Service Orders...');
    const delLab = await prisma.labOrder.deleteMany({});
    const delXray = await prisma.xrayOrder.deleteMany({});
    const delServices = await prisma.medicalServiceOrder.deleteMany({});

    summary.labOrders = delLab.count;
    summary.xrayOrders = delXray.count;
    summary.medicalServiceOrders = delServices.count;

    // 4. Inpatient & Admissions (IPD, Surgeries, Nursery, Gynecology)
    console.log('4️⃣  Purging Admissions & Surgeries...');
    const delSurgeries = await prisma.surgeryOrder.deleteMany({});
    const delIpdAdmissions = await prisma.ipdAdmission.deleteMany({});
    const resetBeds = await prisma.ipdBed.updateMany({
      data: {
        isOccupied: false,
        patientId: null,
        admittedAt: null,
        status: 'AVAILABLE'
      }
    });

    const delFeed = await prisma.nurseryFeedingLog.deleteMany({});
    const delCare = await prisma.nurseryCareNote.deleteMany({});
    const delVitals = await prisma.nurseryVitalLog.deleteMany({});
    const delNurseryAdmissions = await prisma.nurseryAdmission.deleteMany({});
    const resetIncubators = await prisma.nurseryIncubator.updateMany({
      data: { status: 'VACANT' }
    });

    const delGyneVitals = await prisma.gyneVitalLog.deleteMany({});
    const delGyneCare = await prisma.gyneCareNote.deleteMany({});
    const delGyneANC = await prisma.gyneAntenatalVisit.deleteMany({});
    const delGyneAdmissions = await prisma.gyneAdmission.deleteMany({});

    summary.ipdAdmissions = delIpdAdmissions.count;
    summary.surgeryOrders = delSurgeries.count;
    summary.bedsResetToAvailable = resetBeds.count;
    summary.nurseryAdmissions = delNurseryAdmissions.count;
    summary.incubatorsResetToVacant = resetIncubators.count;
    summary.gyneAdmissions = delGyneAdmissions.count;

    // 5. Appointments, Invoices, Transactions, Visits & Patients
    console.log('5️⃣  Purging Appointments, Invoices, Patient Visits & Patient Master Records...');
    const delAppts = await prisma.appointment.deleteMany({});
    const delPayTx = await prisma.paymentTransaction.deleteMany({});
    const delInvoices = await prisma.invoice.deleteMany({});
    const delVisits = await prisma.patientVisit.deleteMany({});
    const delPatients = await prisma.patient.deleteMany({});

    summary.appointments = delAppts.count;
    summary.paymentTransactions = delPayTx.count;
    summary.invoices = delInvoices.count;
    summary.patientVisits = delVisits.count;
    summary.patients = delPatients.count;

    // 6. Expenses & Audit Logs
    console.log('6️⃣  Purging Expenses & Audit Logs...');
    const delExpenses = await prisma.expense.deleteMany({});
    const delAudit = await prisma.auditLog.deleteMany({});

    summary.expenses = delExpenses.count;
    summary.auditLogs = delAudit.count;

    console.log('\n========================================================');
    console.log('✅ CLEANUP COMPLETED SUCCESSFULLY');
    console.log('========================================================\n');
    console.log('SUMMARY OF REMOVED DATA:');
    console.log(JSON.stringify(summary, null, 2));

    // Verify preserved assets
    console.log('\n--- VERIFYING PRESERVED ASSETS ---');
    const preserved = {
      pharmacyProductsKept: await prisma.pharmacyMedicine.count(),
      pharmacyCategoriesKept: await prisma.pharmacyCategory.count(),
      pharmacyPackagingUnitsKept: await prisma.pharmacyPackagingUnit.count(),
      remainingSuppliers: await prisma.pharmacySupplier.count(),
      remainingPatients: await prisma.patient.count(),
      remainingIpdAdmissions: await prisma.ipdAdmission.count(),
      remainingGyneAdmissions: await prisma.gyneAdmission.count(),
      remainingLabOrders: await prisma.labOrder.count(),
      remainingPharmacySales: await prisma.pharmacySale.count(),
      systemUsers: await prisma.user.count(),
      doctors: await prisma.doctor.count(),
      staff: await prisma.staff.count(),
      departments: await prisma.department.count(),
      labTestsCatalog: await prisma.labTestItem.count(),
      xrayCatalog: await prisma.xrayScanType.count()
    };
    console.log(JSON.stringify(preserved, null, 2));

  } catch (error) {
    console.error('❌ Cleanup failed:', error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

cleanPatientsAndSuppliers();
