const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function clearAllPatients() {
  console.log('🗑️  Starting complete hospital-wide patient data cleanup...\n');

  try {
    // 1. Diagnostics & Clinical Orders
    const delLabItems = await prisma.labTestItem.deleteMany({});
    console.log(`✅ Lab Test Items deleted: ${delLabItems.count}`);

    const delLabOrders = await prisma.labOrder.deleteMany({});
    console.log(`✅ Lab Orders deleted: ${delLabOrders.count}`);

    const delServiceOrders = await prisma.medicalServiceOrder.deleteMany({});
    console.log(`✅ Medical Service Orders deleted: ${delServiceOrders.count}`);

    const delXrayOrders = await prisma.xrayOrder.deleteMany({});
    console.log(`✅ X-Ray Orders deleted: ${delXrayOrders.count}`);

    const delSurgeryOrders = await prisma.surgeryOrder.deleteMany({});
    console.log(`✅ Surgery & OT Orders deleted: ${delSurgeryOrders.count}`);

    // 2. IPD Inpatient & Bed Inventory
    const delIpdAdmissions = await prisma.ipdAdmission.deleteMany({});
    console.log(`✅ IPD Admissions deleted: ${delIpdAdmissions.count}`);

    const resetBeds = await prisma.ipdBed.updateMany({
      data: {
        isOccupied: false,
        admittedAt: null,
        status: 'AVAILABLE'
      }
    });
    console.log(`✅ IPD Beds reset to AVAILABLE: ${resetBeds.count}`);

    // 3. Nursery & NICU Incubator Units
    const delNurseryFeeding = await prisma.nurseryFeedingLog.deleteMany({});
    console.log(`✅ Nursery Feeding Logs deleted: ${delNurseryFeeding.count}`);

    const delNurseryNotes = await prisma.nurseryCareNote.deleteMany({});
    console.log(`✅ Nursery Care Notes deleted: ${delNurseryNotes.count}`);

    const delNurseryVitals = await prisma.nurseryVitalLog.deleteMany({});
    console.log(`✅ Nursery Vital Logs deleted: ${delNurseryVitals.count}`);

    const delNurseryAdmissions = await prisma.nurseryAdmission.deleteMany({});
    console.log(`✅ Nursery Admissions deleted: ${delNurseryAdmissions.count}`);

    const resetIncubators = await prisma.nurseryIncubator.updateMany({
      data: {
        status: 'VACANT'
      }
    });
    console.log(`✅ Incubators reset to VACANT: ${resetIncubators.count}`);

    // 4. Gynecology & Obstetrics
    const delGyneVitals = await prisma.gyneVitalLog.deleteMany({});
    console.log(`✅ Gyne Vitals deleted: ${delGyneVitals.count}`);

    const delGyneNotes = await prisma.gyneCareNote.deleteMany({});
    console.log(`✅ Gyne Care Notes deleted: ${delGyneNotes.count}`);

    const delGyneVisits = await prisma.gyneAntenatalVisit.deleteMany({});
    console.log(`✅ Gyne Antenatal Visits deleted: ${delGyneVisits.count}`);

    const delGyneAdmissions = await prisma.gyneAdmission.deleteMany({});
    console.log(`✅ Gyne Admissions deleted: ${delGyneAdmissions.count}`);

    // 5. Pharmacy Patient Sales
    const delPharmSaleItems = await prisma.pharmacySaleItem.deleteMany({});
    console.log(`✅ Pharmacy Sale Items deleted: ${delPharmSaleItems.count}`);

    const delPharmReturnsItems = await prisma.pharmacyReturnItem.deleteMany({});
    console.log(`✅ Pharmacy Return Items deleted: ${delPharmReturnsItems.count}`);

    const delPharmReturns = await prisma.pharmacyReturn.deleteMany({});
    console.log(`✅ Pharmacy Returns deleted: ${delPharmReturns.count}`);

    const delPharmCustPayments = await prisma.pharmacyCustomerPayment.deleteMany({});
    console.log(`✅ Pharmacy Customer Payments deleted: ${delPharmCustPayments.count}`);

    const delPharmSales = await prisma.pharmacySale.deleteMany({});
    console.log(`✅ Pharmacy Sales deleted: ${delPharmSales.count}`);

    // 6. Invoices, Payments & Patient Expenses
    const delTxs = await prisma.paymentTransaction.deleteMany({});
    console.log(`✅ Payment Transactions deleted: ${delTxs.count}`);

    const delInvoices = await prisma.invoice.deleteMany({});
    console.log(`✅ Invoices deleted: ${delInvoices.count}`);

    const delRefundExpenses = await prisma.expense.deleteMany({
      where: { category: 'Patient Refund' }
    });
    console.log(`✅ Patient Refund Expenses deleted: ${delRefundExpenses.count}`);

    // 7. Appointments & Patients
    const delAppts = await prisma.appointment.deleteMany({});
    console.log(`✅ Appointments deleted: ${delAppts.count}`);

    const delPatients = await prisma.patient.deleteMany({});
    console.log(`✅ Patients deleted: ${delPatients.count}`);

    console.log('\n🎉 All patient records and department data cleared successfully!');
  } catch (error) {
    console.error('\n❌ Error during cleanup:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

clearAllPatients();
