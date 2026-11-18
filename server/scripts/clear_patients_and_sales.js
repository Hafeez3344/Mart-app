const prisma = require('../src/config/prisma');

async function clearPatientsAndSales() {
  console.log('🚀 Starting targeted cleanup of Patients and Pharmacy Sales...\n');

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1. Pharmacy Sales, Items, Returns, and Customer Payments
      const delReturnItems = await tx.pharmacyReturnItem.deleteMany({});
      const delReturns = await tx.pharmacyReturn.deleteMany({});
      const delCustPayments = await tx.pharmacyCustomerPayment.deleteMany({});
      const delSaleItems = await tx.pharmacySaleItem.deleteMany({});
      const delSales = await tx.pharmacySale.deleteMany({});

      // 2. Nursery admissions & baby care logs
      const delFeed = await tx.nurseryFeedingLog.deleteMany({});
      const delCare = await tx.nurseryCareNote.deleteMany({});
      const delVitals = await tx.nurseryVitalLog.deleteMany({});
      const delNurseryAdmissions = await tx.nurseryAdmission.deleteMany({});
      const resetIncubators = await tx.nurseryIncubator.updateMany({
        data: { status: 'VACANT' }
      });

      // 3. IPD Admissions, Beds & Surgeries
      const resetBeds = await tx.ipdBed.updateMany({
        data: {
          isOccupied: false,
          patientId: null,
          admittedAt: null,
          status: 'AVAILABLE'
        }
      });
      const delIpdAdmissions = await tx.ipdAdmission.deleteMany({});
      const delSurgeries = await tx.surgeryOrder.deleteMany({});

      // 4. Clinical Orders, Invoices & Appointments
      const delLabOrders = await tx.labOrder.deleteMany({});
      const delXrayOrders = await tx.xrayOrder.deleteMany({});
      const delServiceOrders = await tx.medicalServiceOrder.deleteMany({});
      const delInvoices = await tx.invoice.deleteMany({});
      const delAppointments = await tx.appointment.deleteMany({});

      // 5. Patients
      const delPatients = await tx.patient.deleteMany({});

      return {
        pharmacySales: delSales.count,
        pharmacySaleItems: delSaleItems.count,
        pharmacyReturns: delReturns.count,
        pharmacyReturnItems: delReturnItems.count,
        pharmacyCustomerPayments: delCustPayments.count,
        patients: delPatients.count,
        appointments: delAppointments.count,
        invoices: delInvoices.count,
        ipdAdmissions: delIpdAdmissions.count,
        surgeryOrders: delSurgeries.count,
        labOrders: delLabOrders.count,
        xrayOrders: delXrayOrders.count,
        serviceOrders: delServiceOrders.count,
        nurseryAdmissions: delNurseryAdmissions.count,
        bedsReset: resetBeds.count,
        incubatorsReset: resetIncubators.count
      };
    });

    console.log('✅ Cleanup completed successfully:');
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('❌ Error clearing patients and pharmacy sales:', error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

clearPatientsAndSales();
