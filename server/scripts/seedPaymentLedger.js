const prisma = require('../src/config/prisma');

async function seedPaymentLedger() {
  console.log('🔄 Checking and backfilling payment transactions...');

  // 1. Specific backfill for qaseb (MRN-2026-F8PFR)
  const qaseb = await prisma.patient.findFirst({
    where: {
      OR: [
        { mrn: 'MRN-2026-F8PFR' },
        { name: 'qaseb' }
      ]
    },
    include: { appointments: true }
  });

  if (qaseb) {
    const existingQasebTx = await prisma.paymentTransaction.count({
      where: { patientId: qaseb.id }
    });

    if (existingQasebTx === 0) {
      console.log(`📌 Seeding 3 payment transactions for qaseb (${qaseb.mrn})...`);
      const appt = qaseb.appointments[0];

      await prisma.paymentTransaction.createMany({
        data: [
          {
            transactionNo: 'PAY-20261010-001',
            receiptNo: 'RCP-2026-1001',
            patientId: qaseb.id,
            department: 'OPD_APPOINTMENT',
            departmentLabel: 'OPD Consultation (Dr. Yaseen)',
            referenceId: appt?.id || null,
            referenceNo: appt?.appointmentNo || 'APT-2026-637049-21AC03',
            amount: 500,
            discountApplied: 0,
            paymentMethod: 'Cash Payment at Desk',
            transactionType: 'PAYMENT',
            status: 'SUCCESS',
            receivedByName: 'Front Desk Cashier',
            notes: 'First installment payment',
            createdAt: new Date('2026-10-10T09:30:00.000Z')
          },
          {
            transactionNo: 'PAY-20261010-002',
            receiptNo: 'RCP-2026-1002',
            patientId: qaseb.id,
            department: 'OPD_APPOINTMENT',
            departmentLabel: 'OPD Consultation (Dr. Yaseen)',
            referenceId: appt?.id || null,
            referenceNo: appt?.appointmentNo || 'APT-2026-637049-21AC03',
            amount: 200,
            discountApplied: 0,
            paymentMethod: 'Cash Payment at Desk',
            transactionType: 'PAYMENT',
            status: 'SUCCESS',
            receivedByName: 'Front Desk Cashier',
            notes: 'Second installment payment',
            createdAt: new Date('2026-10-10T09:45:00.000Z')
          },
          {
            transactionNo: 'PAY-20261010-003',
            receiptNo: 'RCP-2026-1003',
            patientId: qaseb.id,
            department: 'OPD_APPOINTMENT',
            departmentLabel: 'OPD Consultation (Dr. Yaseen)',
            referenceId: appt?.id || null,
            referenceNo: appt?.appointmentNo || 'APT-2026-637049-21AC03',
            amount: 100,
            discountApplied: 0,
            paymentMethod: 'Cash Payment at Desk',
            transactionType: 'PAYMENT',
            status: 'SUCCESS',
            receivedByName: 'Front Desk Cashier',
            notes: 'Third installment payment',
            createdAt: new Date('2026-10-10T10:05:00.000Z')
          }
        ]
      });
      console.log('✅ qaseb 3 transactions seeded: 500 + 200 + 100 = 800 total paid.');
    }
  }

  // 2. Backfill other appointments that have paidAmount > 0 and no transactions yet
  const otherAppts = await prisma.appointment.findMany({
    where: {
      paidAmount: { gt: 0 },
      patientId: { not: qaseb?.id }
    },
    include: {
      doctor: { include: { user: true } },
      patient: true
    }
  });

  for (const appt of otherAppts) {
    const existing = await prisma.paymentTransaction.findFirst({
      where: {
        patientId: appt.patientId,
        referenceId: appt.id
      }
    });

    if (!existing) {
      const docName = appt.doctor?.user?.name ? `Dr. ${appt.doctor.user.name}` : 'Doctor';
      await prisma.paymentTransaction.create({
        data: {
          transactionNo: `PAY-HIST-${appt.appointmentNo.slice(-6)}`,
          receiptNo: `RCP-${appt.appointmentNo}`,
          patientId: appt.patientId,
          department: 'OPD_APPOINTMENT',
          departmentLabel: `OPD Consultation (${docName})`,
          referenceId: appt.id,
          referenceNo: appt.appointmentNo,
          amount: parseFloat(appt.paidAmount || 0),
          discountApplied: parseFloat(appt.discountAmount || 0),
          paymentMethod: 'Cash Payment at Desk',
          transactionType: 'PAYMENT',
          status: 'SUCCESS',
          receivedByName: 'Front Desk Cashier',
          notes: 'Baseline historical payment record',
          createdAt: appt.createdAt || new Date()
        }
      });
      console.log(`✅ Seeded historical payment for ${appt.patient?.name || 'patient'}: Rs. ${appt.paidAmount}`);
    }
  }

  const totalTx = await prisma.paymentTransaction.count();
  console.log(`🎉 Backfill completed. Total payment transactions in database: ${totalTx}`);
  process.exit(0);
}

seedPaymentLedger().catch(err => {
  console.error('Error seeding payment ledger:', err);
  process.exit(1);
});
