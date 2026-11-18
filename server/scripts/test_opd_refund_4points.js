/**
 * Test Suite: 4 Verification Points for OPD Refund & Cancellation Accounting Integrity
 * 
 * Verifies:
 * 1. Server-side reconciliation: financials.remainingBalance excludes cancelled/refunded charges
 *    without hiding legitimate unpaid charges.
 * 2. Item-level balances: Cancelled appointment reports remainingBalance = 0, with original bill preserved for auditing.
 * 3. Partial refunds: If Rs. 1,000 paid and Rs. 400 refunded on cancelled appointment, remaining Rs. 400 is NOT treated as debt.
 * 4. Other patient charges: If patient also owes Rs. 2,000 for lab, cancelling & refunding OPD preserves lab debt (Rs. 2,000).
 * 5. getPatientMasterBill and getPatientById consistency.
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { refundPatient } = require('../src/controllers/billingController');
const { getPatientMasterBill, getPatientById } = require('../src/controllers/patientController');

// Mock Express response helper
function mockResponse() {
  const res = {
    statusCode: 200,
    data: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.data = payload;
      return this;
    }
  };
  return res;
}

async function runTest() {
  console.log('===============================================================');
  console.log('🧪 Starting OPD Refund 4-Point Verification Test Suite');
  console.log('===============================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ [PASS] ${message}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${message}`);
      failed++;
    }
  }

  const testSuffix = Math.floor(100000 + Math.random() * 900000);
  const mrn = `MRN-VERIF-${testSuffix}`;

  // Find existing doctor
  const testDoctor = await prisma.doctor.findFirst({
    include: { user: true }
  });
  const doctorUserId = testDoctor.userId || testDoctor.user?.id;

  // Create isolated patient
  const patient = await prisma.patient.create({
    data: {
      name: `Verification Patient ${testSuffix}`,
      mrn,
      phone: `0300${testSuffix}`,
      gender: 'MALE',
      age: 35
    }
  });

  try {
    console.log(`Created test patient: ${patient.name} (${mrn})`);

    // Scenario A: Patient books OPD Appointment for Rs. 1,000, pays full amount.
    const appt = await prisma.appointment.create({
      data: {
        patientId: patient.id,
        doctorId: testDoctor.id,
        tokenNo: 1,
        appointmentNo: `APT-VERIF-${testSuffix}`,
        consultationFee: 1000,
        paidAmount: 1000,
        paymentStatus: 'PAID',
        status: 'SCHEDULED',
        date: new Date(),
        time: '10:00 AM'
      }
    });

    const paymentTx = await prisma.paymentTransaction.create({
      data: {
        patientId: patient.id,
        amount: 1000,
        transactionType: 'PAYMENT',
        paymentMethod: 'CASH',
        department: 'OPD_APPOINTMENT',
        departmentLabel: 'OPD Consultation',
        referenceId: appt.id,
        referenceNo: appt.appointmentNo,
        receiptNo: `REC-VERIF-${testSuffix}`,
        transactionNo: `TXN-VERIF-${testSuffix}`
      }
    });

    // Also create Lab Order for Rs. 2,000 unpaid
    const labOrder = await prisma.labOrder.create({
      data: {
        patientId: patient.id,
        patientName: patient.name,
        mrn: patient.mrn,
        orderNo: `LAB-VERIF-${testSuffix}`,
        totalFee: 2000,
        netTotal: 2000,
        paidAmount: 0,
        paymentStatus: 'UNPAID',
        status: 'PENDING',
        testsJson: JSON.stringify([{ name: 'Complete Blood Count', fee: 2000 }])
      }
    });

    console.log('\n--- Initial State Before Refund ---');
    console.log('OPD Appointment: Rs. 1,000 (PAID)');
    console.log('Lab Order: Rs. 2,000 (UNPAID)');

    // Verify initial master bill
    const resInitial = mockResponse();
    await getPatientMasterBill({ params: { id: patient.id } }, resInitial);
    assert(resInitial.statusCode === 200, 'getPatientMasterBill returns 200');
    assert(resInitial.data.financials.remainingBalance === 2000, 'Initial active remaining dues is Rs. 2,000 (Lab debt only)');
    assert(resInitial.data.financials.grossTotal === 3000, 'Gross historical total is Rs. 3,000 (1000 OPD + 2000 Lab)');

    // Execute Full Refund of OPD (Rs. 1,000) and Cancel Appointment
    console.log('\n--- Executing Full OPD Refund & Cancellation ---');
    const reqRefund = {
      body: {
        appointmentId: appt.id,
        amount: 1000,
        paymentMethod: 'CASH',
        reason: 'Patient waiting too long / Doctor delayed',
        cancelOrder: true
      },
      user: { id: doctorUserId }
    };
    const resRefund = mockResponse();
    await refundPatient(reqRefund, resRefund);
    assert(resRefund.statusCode === 200, 'Refund executes with HTTP 200');

    // Fetch master bill after refund
    const resPostRefund = mockResponse();
    await getPatientMasterBill({ params: { id: patient.id } }, resPostRefund);
    const postFin = resPostRefund.data.financials;
    const postAppts = resPostRefund.data.appointments;
    const postLab = resPostRefund.data.labOrders;

    console.log('\n--- POINT 1 & 4 Verification: Server-side reconciliation & Other patient charges ---');
    assert(postFin.remainingBalance === 2000, 'POINT 1 & 4: financials.remainingBalance is exactly Rs. 2,000 (preserves Lab debt, excludes cancelled OPD)');
    assert(postFin.grossTotal === 3000, 'POINT 1: Original OPD bill (1000) preserved in historical grossTotal (3000)');
    assert(postFin.totalPaid === 1000, 'POINT 1: Original payment preserved in totalPaid (1000)');
    assert(postFin.totalRefunds === 1000, 'POINT 1: Refund disbursed reported as 1000');
    assert(postFin.netPaidCash === 0, 'POINT 1: Net cash retained is Rs. 0');
    assert(postFin.isFullyPaid === false, 'POINT 4: Patient is NOT fully paid because Rs. 2,000 Lab debt remains');

    console.log('\n--- POINT 2 Verification: Item-level balances ---');
    const refundedAppt = postAppts.find(a => a.id === appt.id);
    assert(refundedAppt !== undefined, 'Refunded appointment exists in itemized statement');
    assert(refundedAppt.status === 'CANCELLED', 'POINT 2: Appointment clinical status is CANCELLED');
    assert(refundedAppt.paymentStatus === 'REFUNDED', 'POINT 2: Appointment payment status is REFUNDED');
    assert(refundedAppt.fee === 1000, 'POINT 2: Original fee remains available for auditing (Rs. 1,000)');
    assert(refundedAppt.remainingBalance === 0, 'POINT 2: Cancelled appointment reports remainingBalance = 0');
    assert(refundedAppt.paidAmount === 0, 'POINT 2: Cancelled appointment reports retained paidAmount = 0');
    assert(refundedAppt.refundAmount === 1000, 'POINT 2: Cancelled appointment reports refundAmount = 1000');

    const labItem = postLab.find(l => l.id === labOrder.id);
    assert(labItem.remainingBalance === 2000, 'POINT 4: Lab item remaining balance is exactly Rs. 2,000');
    assert(labItem.paymentStatus === 'UNPAID', 'POINT 4: Lab item paymentStatus is UNPAID');

    console.log('\n--- POINT 5 Verification: Consistent getPatientById Ledger ---');
    const resPatientById = mockResponse();
    await getPatientById({ params: { id: patient.id } }, resPatientById);
    assert(resPatientById.statusCode === 200, 'getPatientById returns HTTP 200');
    const ledger = resPatientById.data.patient.financialLedger;
    assert(ledger.netOutstandingBalance === 2000, 'POINT 5: getPatientById netOutstandingBalance is exactly Rs. 2,000');
    assert(ledger.grandTotalBilled === 3000, 'POINT 5: getPatientById grandTotalBilled is Rs. 3,000');
    assert(ledger.totalRefunded === 1000, 'POINT 5: getPatientById totalRefunded is Rs. 1,000');
    assert(ledger.netGrandTotalPaid === 0, 'POINT 5: getPatientById netGrandTotalPaid is Rs. 0');

    // Settle the Lab Order so remaining balance is 0
    await prisma.labOrder.update({
      where: { id: labOrder.id },
      data: { paidAmount: 2000, paymentStatus: 'PAID' }
    });

    const resAllCleared = mockResponse();
    await getPatientMasterBill({ params: { id: patient.id } }, resAllCleared);
    assert(resAllCleared.data.financials.remainingBalance === 0, 'After lab settlement: active remaining dues is Rs. 0');
    assert(resAllCleared.data.financials.isFullyPaid === true, 'After lab settlement: patient is fully paid');

    // Scenario B: POINT 3 Verification - Partial Refund on Cancelled Order
    console.log('\n--- POINT 3 Verification: Partial Refund on Cancelled Order ---');
    // Patient books a 2nd appointment for Rs. 1,000, pays Rs. 1,000
    const appt2 = await prisma.appointment.create({
      data: {
        patientId: patient.id,
        doctorId: testDoctor.id,
        tokenNo: 2,
        appointmentNo: `APT2-VERIF-${testSuffix}`,
        consultationFee: 1000,
        paidAmount: 1000,
        paymentStatus: 'PAID',
        status: 'SCHEDULED',
        date: new Date(),
        time: '11:00 AM'
      }
    });

    await prisma.paymentTransaction.create({
      data: {
        patientId: patient.id,
        amount: 1000,
        transactionType: 'PAYMENT',
        paymentMethod: 'CASH',
        department: 'OPD_APPOINTMENT',
        referenceId: appt2.id,
        referenceNo: appt2.appointmentNo,
        receiptNo: `REC2-VERIF-${testSuffix}`,
        transactionNo: `TXN2-VERIF-${testSuffix}`
      }
    });

    // Patient requests partial refund of Rs. 400 (hospital retains Rs. 600) and CANCELS appointment
    const reqRefund2 = {
      body: {
        appointmentId: appt2.id,
        amount: 400,
        paymentMethod: 'CASH',
        reason: 'Partial refund / cancellation policy',
        cancelOrder: true
      },
      user: { id: doctorUserId }
    };
    const resRefund2 = mockResponse();
    await refundPatient(reqRefund2, resRefund2);
    assert(resRefund2.statusCode === 200, 'Partial refund executes with HTTP 200');

    // Check DB state of appt2
    const dbAppt2 = await prisma.appointment.findUnique({ where: { id: appt2.id } });
    assert(dbAppt2.status === 'CANCELLED', 'POINT 3: Appointment status is CANCELLED');
    assert(dbAppt2.paidAmount === 600, 'POINT 3: Retained paidAmount in DB is Rs. 600');
    assert(dbAppt2.paymentStatus === 'PARTIAL', 'POINT 3: Payment status in DB is PARTIAL');

    // Check master bill for appt2
    const resPartialMasterBill = mockResponse();
    await getPatientMasterBill({ params: { id: patient.id } }, resPartialMasterBill);
    const partialAppt = resPartialMasterBill.data.appointments.find(a => a.id === appt2.id);

    assert(partialAppt.remainingBalance === 0, 'POINT 3: Item remainingBalance is Rs. 0 (cancelled order must NOT report debt)');
    assert(partialAppt.paid === 600, 'POINT 3: Item retained cash is Rs. 600');
    assert(partialAppt.refundAmount === 400, 'POINT 3: Item refundAmount is Rs. 400');
    assert(resPartialMasterBill.data.financials.remainingBalance === 0, 'POINT 3: financials.remainingBalance is Rs. 0 (system does NOT treat unrefunded Rs. 400 or Rs. 600 as debt)');

    // Check getPatientById for appt2
    const resPartialPatientById = mockResponse();
    await getPatientById({ params: { id: patient.id } }, resPartialPatientById);
    assert(resPartialPatientById.data.patient.financialLedger.netOutstandingBalance === 0, 'POINT 3: getPatientById netOutstandingBalance is Rs. 0');

  } catch (err) {
    console.error('Test error:', err);
    failed++;
  } finally {
    // Cleanup test data
    console.log('\n--- Cleaning up test fixtures ---');
    await prisma.paymentTransaction.deleteMany({ where: { patientId: patient.id } });
    await prisma.appointment.deleteMany({ where: { patientId: patient.id } });
    await prisma.labOrder.deleteMany({ where: { patientId: patient.id } });
    await prisma.patient.delete({ where: { id: patient.id } });
    console.log('Cleanup completed.');
  }

  console.log('\n===============================================================');
  console.log(`📊 OPD Refund 4-Point Test Finished: ${passed} PASSED, ${failed} FAILED`);
  console.log('===============================================================');

  if (failed > 0) process.exit(1);
}

runTest();
